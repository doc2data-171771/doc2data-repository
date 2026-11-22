import { useMemo, useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Check, FileImage, FileText, Loader2, Trash2, Upload, X } from 'lucide-react'
import { api, ARQUIVOS_ACEITOS, TAMANHO_MAXIMO, type UploadPreparado } from '../lib/api'
import { nomeCanal, useCatalogos } from '../lib/consultas'
import { fmt } from '../lib/format'
import { useProcessador } from '../lib/processador'
import { Botao, BotaoLink, Cabecalho, Painel, Rotulo, Seletor, mensagemDe, useAvisos } from '../components/ui'

type Etapa = 'pronto' | 'invalido' | 'enviando' | 'enviado' | 'falhou'

interface Item {
  chave: string
  arquivo: File
  etapa: Etapa
  motivo?: string
  documentoId?: string
}

function validar(f: File): string | undefined {
  if (!ARQUIVOS_ACEITOS.includes(f.type)) return 'Formato não aceito (use PDF, PNG, JPG ou WEBP)'
  if (f.size > TAMANHO_MAXIMO) return `Maior que ${TAMANHO_MAXIMO / 1024 / 1024} MB`
  if (f.size === 0) return 'Arquivo vazio'
  return undefined
}

async function emParalelo<T>(itens: T[], limite: number, fn: (t: T) => Promise<void>) {
  const fila = [...itens]
  await Promise.all(
    Array.from({ length: Math.min(limite, fila.length) }, async () => {
      while (fila.length) await fn(fila.shift()!)
    }),
  )
}

export function Entrada() {
  const qc = useQueryClient()
  const avisar = useAvisos()
  const { enfileirar } = useProcessador()
  const { canais, tipos } = useCatalogos()
  const input = useRef<HTMLInputElement>(null)

  const [itens, setItens] = useState<Item[]>([])
  const [arrastando, setArrastando] = useState(false)
  const [canalId, setCanalId] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [lerAgora, setLerAgora] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const canalEfetivo = canalId || canais.find((c) => c.nome === 'upload_web')?.id || ''
  const validos = itens.filter((i) => i.etapa === 'pronto')
  const enviados = itens.filter((i) => i.etapa === 'enviado')
  const tamanhoTotal = useMemo(() => validos.reduce((a, i) => a + i.arquivo.size, 0), [validos])

  function adicionar(lista: FileList | null) {
    if (!lista?.length) return
    const novos: Item[] = Array.from(lista).map((f) => {
      const motivo = validar(f)
      return { chave: `${f.name}-${f.size}-${f.lastModified}-${Math.random()}`, arquivo: f, etapa: motivo ? 'invalido' : 'pronto', motivo }
    })
    setItens((atual) => [...atual.filter((i) => i.etapa !== 'enviado'), ...novos])
  }

  const atualizar = (chave: string, p: Partial<Item>) => setItens((l) => l.map((i) => (i.chave === chave ? { ...i, ...p } : i)))

  async function enviar() {
    const alvo = itens.filter((i) => i.etapa === 'pronto')
    if (!alvo.length) return
    setEnviando(true)
    alvo.forEach((i) => atualizar(i.chave, { etapa: 'enviando' }))

    const prontosParaLer: string[] = []
    try {
      for (let ini = 0; ini < alvo.length; ini += 50) {
        const lote = alvo.slice(ini, ini + 50)
        let preparados: UploadPreparado[]
        try {
          preparados = await api.prepararUpload(
            lote.map((i) => ({
              nome_arquivo: i.arquivo.name,
              mime_type: i.arquivo.type,
              tamanho_bytes: i.arquivo.size,
              canal_id: canalEfetivo || undefined,
              tipo_documento_id: tipoId || undefined,
            })),
          )
        } catch (e) {
          lote.forEach((i) => atualizar(i.chave, { etapa: 'falhou', motivo: mensagemDe(e) }))
          continue
        }
        await emParalelo(
          lote.map((item, k) => ({ item, prep: preparados[k]! })),
          3,
          async ({ item, prep }) => {
            try {
              await api.enviarArquivo(prep, item.arquivo)
              atualizar(item.chave, { etapa: 'enviado', documentoId: prep.documento.id })
              prontosParaLer.push(prep.documento.id)
            } catch (e) {
              atualizar(item.chave, { etapa: 'falhou', motivo: mensagemDe(e), documentoId: prep.documento.id })
            }
          },
        )
      }
    } finally {
      setEnviando(false)
      qc.invalidateQueries({ queryKey: ['documentos'] })
      qc.invalidateQueries({ queryKey: ['contagens'] })
    }

    if (prontosParaLer.length) {
      if (lerAgora) enfileirar(prontosParaLer)
      avisar(
        `${prontosParaLer.length} ${prontosParaLer.length === 1 ? 'documento enviado' : 'documentos enviados'}${lerAgora ? ' — leitura iniciada' : ''}.`,
      )
    }
  }

  function soltar(e: DragEvent) {
    e.preventDefault()
    setArrastando(false)
    adicionar(e.dataTransfer.files)
  }

  return (
    <>
      <Cabecalho
        sobretitulo="Etapa 1 · Entrada"
        titulo="Receber documentos"
        descricao="Solte aqui o que chegou por WhatsApp, e-mail ou qualquer outro canal. Um arquivo ou um lote inteiro."
      />

      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => input.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setArrastando(true)
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={soltar}
            className={clsx(
              'relative cursor-pointer rounded-[10px] border-2 border-dashed transition-colors px-6 py-14 text-center',
              arrastando ? 'border-stamp bg-stamp-soft/60' : 'border-rule-strong bg-sheet hover:border-ink-2',
            )}
          >
            <div className="mx-auto mb-4 size-12 rounded-full border border-rule-strong bg-paper grid place-items-center">
              <Upload className={clsx('size-5 transition-transform', arrastando ? 'text-stamp -translate-y-0.5' : 'text-ink-2')} />
            </div>
            <p className="text-[17px] font-semibold tracking-[-0.01em]">{arrastando ? 'Pode soltar.' : 'Arraste os arquivos para cá'}</p>
            <p className="text-sm text-ink-3 mt-1.5">
              ou <span className="underline underline-offset-4 text-ink">escolha no computador</span> · PDF, PNG, JPG ou WEBP até 20 MB
            </p>
            <input
              ref={input}
              type="file"
              multiple
              accept={ARQUIVOS_ACEITOS.join(',')}
              className="hidden"
              onChange={(e) => {
                adicionar(e.target.files)
                e.target.value = ''
              }}
            />
          </div>

          {itens.length > 0 && (
            <Painel
              titulo={`${itens.length} ${itens.length === 1 ? 'arquivo' : 'arquivos'}`}
              sub={validos.length ? `${validos.length} prontos · ${fmt.bytes(tamanhoTotal)}` : undefined}
              acoes={
                !enviando && (
                  <Botao tamanho="sm" variante="fantasma" onClick={() => setItens([])} icone={<Trash2 className="size-3.5" />}>
                    Limpar
                  </Botao>
                )
              }
            >
              <ul className="divide-y divide-rule max-h-[420px] overflow-y-auto">
                {itens.map((i) => (
                  <li key={i.chave} className="flex items-center gap-3 px-5 py-2.5">
                    {i.arquivo.type === 'application/pdf' ? (
                      <FileText className="size-4 text-ink-3 shrink-0" />
                    ) : (
                      <FileImage className="size-4 text-ink-3 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={clsx('text-sm truncate', i.etapa === 'invalido' && 'text-ink-3 line-through')}>{i.arquivo.name}</p>
                      {i.motivo && <p className="text-xs text-err truncate">{i.motivo}</p>}
                    </div>
                    <span className="font-mono text-[11px] text-ink-3 tnum w-16 text-right">{fmt.bytes(i.arquivo.size)}</span>
                    <span className="w-24 flex justify-end">
                      {i.etapa === 'enviando' && <Loader2 className="size-4 animate-spin text-info" aria-label="Enviando" />}
                      {i.etapa === 'enviado' && (
                        <span className="inline-flex items-center gap-1 text-xs text-ok">
                          <Check className="size-3.5" /> enviado
                        </span>
                      )}
                      {i.etapa === 'falhou' && <span className="text-xs text-err">falhou</span>}
                      {(i.etapa === 'pronto' || i.etapa === 'invalido') && !enviando && (
                        <button
                          onClick={() => setItens((l) => l.filter((x) => x.chave !== i.chave))}
                          className="p-1 rounded text-ink-3 hover:text-ink hover:bg-sunk"
                          aria-label={`Remover ${i.arquivo.name}`}
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Painel>
          )}

          {enviados.length > 0 && !enviando && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 rounded-[10px] bg-ok-soft border border-ok/25">
              <p className="text-sm text-ok">
                <strong>{enviados.length}</strong> na mesa. {lerAgora ? 'A IA já está lendo — acompanhe em Documentos.' : 'Dispare a leitura em Documentos.'}
              </p>
              <BotaoLink para="/documentos" tamanho="sm">
                Ir para Documentos
              </BotaoLink>
            </div>
          )}
        </div>

        {/* Opções do lote */}
        <Painel titulo="Deste lote" className="lg:sticky lg:top-10">
          <div className="p-5 space-y-5">
            <div>
              <Rotulo htmlFor="canal">Chegou por</Rotulo>
              <Seletor id="canal" value={canalEfetivo} onChange={(e) => setCanalId(e.target.value)}>
                <option value="">Não informar</option>
                {canais
                  .filter((c) => c.ativo)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {nomeCanal(c.nome)}
                    </option>
                  ))}
              </Seletor>
            </div>
            <div>
              <Rotulo htmlFor="tipo">Tipo de documento</Rotulo>
              <Seletor id="tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
                <option value="">Vários / não sei</option>
                {tipos
                  .filter((t) => t.ativo)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
              </Seletor>
              <p className="text-xs text-ink-3 mt-1.5">Informar o tipo ajuda a IA a procurar os campos certos.</p>
            </div>
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" checked={lerAgora} onChange={(e) => setLerAgora(e.target.checked)} className="size-4 mt-0.5 accent-[var(--ink)]" />
              <span>
                Ler com IA assim que enviar
                <span className="block text-xs text-ink-3">Dois por vez, em segundo plano.</span>
              </span>
            </label>
            <Botao variante="primario" className="w-full" disabled={!validos.length} carregando={enviando} onClick={enviar} icone={<Upload className="size-4" />}>
              {validos.length ? `Enviar ${validos.length} ${validos.length === 1 ? 'arquivo' : 'arquivos'}` : 'Enviar'}
            </Botao>
            <p className="text-[11.5px] text-ink-3 leading-relaxed border-t border-rule pt-4">
              Nada vai para a planilha sem passar pela conferência de uma pessoa.{' '}
              <Link to="/conferencia" className="underline underline-offset-2">
                Ver a mesa de conferência
              </Link>
            </p>
          </div>
        </Painel>
      </div>
    </>
  )
}
