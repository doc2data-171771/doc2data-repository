import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, History, Plus, RotateCw, Sparkles, Trash2, X } from 'lucide-react'
import { api, extracaoAtual, type Dados } from '../lib/api'
import { chaveDe, montarDados, textosIniciais } from '../lib/campos'
import { nomeCanal, useCatalogos } from '../lib/consultas'
import { alertaDoCampo, alertasDoServidor, fmt, LIMIAR_CONFIANCA, rotuloCampo, tipoDoCampo } from '../lib/format'
import { useProcessador } from '../lib/processador'
import { Botao, Carimbo, Carregando, Confianca, Entrada, Falha, Modal, Rotulo, Seletor, SeloStatus, mensagemDe, useAvisos } from '../components/ui'
import { Visualizador } from '../components/Visualizador'

export function Documento() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const qc = useQueryClient()
  const avisar = useAvisos()
  const { tipos } = useCatalogos()
  const { estados, enfileirar } = useProcessador()

  const consulta = useQuery({
    queryKey: ['documento', id],
    queryFn: () => api.obterDocumento(id),
    refetchInterval: (q) => (q.state.data?.status === 'processando' ? 3000 : false),
  })
  // Fila de conferência, para "anterior / próximo"
  const fila = useQuery({
    queryKey: ['documentos', 'fila-conferencia'],
    queryFn: () => api.listarDocumentos({ status: 'extraido', limit: 100 }),
  })

  const doc = consulta.data
  const atual = useMemo(() => (doc ? extracaoAtual(doc) : null), [doc])
  const originais: Dados = atual?.dadosFinais ?? {}

  const [textos, setTextos] = useState<Record<string, string>>({})
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [rejeitando, setRejeitando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [novoCampo, setNovoCampo] = useState('')
  const [refazer, setRefazer] = useState(false)
  const [carimbou, setCarimbou] = useState(false)

  // Reinicia o formulário quando muda o documento ou chega uma nova extração
  const idExtracao = atual?.extraido?.id
  useEffect(() => {
    setTextos(textosIniciais(originais))
    setErroForm(null)
    setRefazer(false)
    setCarimbou(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, idExtracao, atual?.ultimaValidacao?.id])

  const listaFila = fila.data?.dados ?? []
  const pos = listaFila.findIndex((d) => d.id === id)
  const proximo = listaFila.filter((d) => d.id !== id)[pos >= 0 ? pos : 0]
  const anterior = pos > 0 ? listaFila[pos - 1] : undefined

  const alteracoes = useMemo(() => {
    try {
      return montarDados(originais, textos).alterados
    } catch {
      return Object.keys(textos)
    }
  }, [originais, textos])

  const validar = useMutation({
    mutationFn: api.validar,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['documentos'] })
      qc.invalidateQueries({ queryKey: ['contagens'] })
      qc.invalidateQueries({ queryKey: ['documento', id] })
      setRejeitando(false)
      setMotivo('')
      if (r.documento.status === 'validado') {
        setCarimbou(true)
        avisar('Conferido.')
        if (proximo) setTimeout(() => navegar(`/documentos/${proximo.id}`), 650)
      } else {
        avisar('Documento rejeitado.', 'info')
        if (proximo) navegar(`/documentos/${proximo.id}`)
      }
    },
    onError: (e) => avisar(mensagemDe(e), 'erro'),
  })

  const trocarTipo = useMutation({
    mutationFn: (tipoId: string) => api.atualizarDocumento(id, { tipo_documento_id: tipoId || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documento', id] })
      qc.invalidateQueries({ queryKey: ['documentos'] })
    },
    onError: (e) => avisar(mensagemDe(e), 'erro'),
  })

  const podeValidar = !!atual?.extraido
  const jaDecidido = doc?.status === 'validado' || doc?.status === 'rejeitado'
  const editavel = podeValidar && (!jaDecidido || refazer)
  const filaEstado = estados[id]?.estado
  const lendo = doc?.status === 'processando' || filaEstado === 'lendo' || filaEstado === 'na_fila'

  function aprovar() {
    if (!atual?.extraido) return
    setErroForm(null)
    try {
      const { final, alterados } = montarDados(originais, textos)
      // Correções são sempre relativas à extração original da IA
      const relativoAIA = montarDados(atual.extraido.dados, textosIniciais(final)).alterados
      const corrigido = alterados.length > 0 || relativoAIA.length > 0
      validar.mutate({
        dados_extraidos_id: atual.extraido.id,
        status: corrigido ? 'corrigido' : 'aprovado',
        dados_corrigidos: corrigido ? final : undefined,
      })
    } catch (e) {
      setErroForm(mensagemDe(e))
    }
  }

  function rejeitar() {
    if (!atual?.extraido || !motivo.trim()) return
    validar.mutate({ dados_extraidos_id: atual.extraido.id, status: 'rejeitado', observacao: motivo.trim() })
  }

  // Atalhos: Ctrl+Enter aprova; fora de campos de texto, A aprova, R rejeita, J/K navegam.
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const emCampo = (e.target as HTMLElement)?.closest('input, textarea, select, dialog')
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && editavel) {
        e.preventDefault()
        aprovar()
        return
      }
      if (emCampo || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'a' && editavel) aprovar()
      if (e.key === 'r' && editavel) setRejeitando(true)
      if (e.key === 'j' && proximo) navegar(`/documentos/${proximo.id}`)
      if (e.key === 'k' && anterior) navegar(`/documentos/${anterior.id}`)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  if (consulta.isLoading) return <Carregando texto="Abrindo documento…" />
  if (consulta.isError || !doc) return <Falha erro={consulta.error ?? 'Documento não encontrado'} tentar={() => consulta.refetch()} />

  const confianca = atual?.extraido?.confianca ?? null
  const chaves = Object.keys(textos)
  const alertas = chaves.map((k) => {
    try {
      return alertaDoCampo(k, montarDados({ [k]: originais[k] }, { [k]: textos[k]! }).final[k])
    } catch (e) {
      return mensagemDe(e)
    }
  })
  const qtdAlertas = alertas.filter(Boolean).length
  // Alertas da conferência automática feita pela API (dígitos verificadores, soma dos itens...)
  const alertasServidor = alertasDoServidor(originais)

  return (
    <div className="flex flex-col gap-5">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/conferencia" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" /> Mesa de conferência
        </Link>
        <div className="flex-1" />
        {listaFila.length > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <span className="font-mono text-xs text-ink-3 tnum mr-1">
              {pos >= 0 ? `${pos + 1} de ${listaFila.length}` : `${listaFila.length} na fila`}
            </span>
            <Botao tamanho="sm" variante="fantasma" disabled={!anterior} onClick={() => anterior && navegar(`/documentos/${anterior.id}`)} aria-label="Anterior (K)" title="Anterior (K)">
              <ChevronLeft className="size-4" />
            </Botao>
            <Botao tamanho="sm" variante="fantasma" disabled={!proximo} onClick={() => proximo && navegar(`/documentos/${proximo.id}`)} aria-label="Próximo (J)" title="Próximo (J)">
              <ChevronRight className="size-4" />
            </Botao>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stamp mb-1.5">Etapa 3 · Conferência</p>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] leading-tight truncate" title={doc.nome_arquivo}>
            {doc.nome_arquivo}
          </h1>
          <p className="text-sm text-ink-3 mt-1">
            {nomeCanal(doc.canais?.nome)} · chegou {fmt.relativo(doc.data_envio)}
            {doc.enviado && <> · por {doc.enviado.nome}</>} · {fmt.bytes(doc.tamanho_bytes)}
          </p>
        </div>
        <SeloStatus status={doc.status} lendo={lendo} />
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,1fr)] gap-5 items-start">
        <div className="xl:sticky xl:top-6 h-[min(78vh,880px)]">
          <Visualizador url={doc.download_url} mime={doc.mime_type} nome={doc.nome_arquivo} lendo={lendo} />
        </div>

        <section className="bg-sheet border border-rule rounded-[10px]">
          {/* Cabeçalho da ficha */}
          <header className="px-5 py-4 border-b border-rule space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold">Ficha extraída</h2>
              {confianca !== null && (
                <div className="text-right">
                  <p className="text-[10.5px] uppercase tracking-[0.08em] text-ink-3 mb-1">Confiança da IA</p>
                  <Confianca valor={confianca} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-[auto_1fr] items-center gap-3">
              <Rotulo htmlFor="tipo-doc">Tipo</Rotulo>
              <Seletor
                id="tipo-doc"
                className="h-9 -mt-1.5"
                value={doc.tipo_documento_id ?? ''}
                disabled={trocarTipo.isPending}
                onChange={(e) => trocarTipo.mutate(e.target.value)}
              >
                <option value="">Não definido</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </Seletor>
            </div>
          </header>

          {/* Estados sem dados */}
          {!atual?.extraido && (
            <div className="p-6 space-y-4">
              {lendo ? (
                <p className="text-sm text-info flex items-center gap-2">
                  <Sparkles className="size-4 animate-pulse" /> A IA está lendo este documento…
                </p>
              ) : (
                <>
                  <p className="text-sm text-ink-2">
                    {doc.status === 'erro' ? 'A última leitura falhou.' : 'Este documento ainda não foi lido pela IA.'}
                  </p>
                  {atual?.ultimoErro && <p className="text-xs font-mono text-err bg-err-soft rounded px-3 py-2">{atual.ultimoErro}</p>}
                                      <Botao variante="primario" icone={doc.status === 'erro' ? <RotateCw className="size-4" /> : <Sparkles className="size-4" />} onClick={() => enfileirar([doc.id])}>
                      {doc.status === 'erro' ? 'Tentar ler de novo' : 'Ler com IA'}
                    </Botao>
                </>
              )}
            </div>
          )}

          {/* Decisão já tomada */}
          {atual?.extraido && jaDecidido && !refazer && (
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-rule bg-paper/50">
              <div className="text-sm">
                {atual.ultimaValidacao && (
                  <p className="text-ink-2">
                    {atual.ultimaValidacao.status === 'corrigido' ? 'Corrigido' : atual.ultimaValidacao.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'} por{' '}
                    <strong className="text-ink">{atual.ultimaValidacao.validador?.nome ?? 'alguém da equipe'}</strong>
                    <span className="block text-xs text-ink-3">{fmt.dataHora(atual.ultimaValidacao.validado_em)}</span>
                  </p>
                )}
                {atual.ultimaValidacao?.observacao && <p className="text-xs text-err mt-1">Motivo: {atual.ultimaValidacao.observacao}</p>}
                {podeValidar && (
                  <button onClick={() => setRefazer(true)} className="text-xs underline underline-offset-4 text-ink-2 hover:text-ink mt-2">
                    Refazer a conferência
                  </button>
                )}
              </div>
              <Carimbo
                tipo={doc.status === 'validado' ? 'conferido' : 'rejeitado'}
                data={atual.ultimaValidacao ? fmt.dataCurta(atual.ultimaValidacao.validado_em) : undefined}
                animar={carimbou}
              />
            </div>
          )}

          {/* Campos */}
          {atual?.extraido && (
            <>
              {editavel && (confianca !== null && confianca < LIMIAR_CONFIANCA || qtdAlertas > 0) && (
                <div className="mx-5 mt-4 flex gap-2.5 px-3 py-2.5 rounded-[6px] bg-warn-soft text-warn text-[13px]">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <p>
                    {qtdAlertas > 0
                      ? `${qtdAlertas} ${qtdAlertas === 1 ? 'campo pede' : 'campos pedem'} atenção. Compare com o original antes de aprovar.`
                      : 'A IA não teve muita certeza nesta leitura. Confira com calma.'}
                  </p>
                </div>
              )}

              {editavel && alertasServidor.length > 0 && (
                <div className="mx-5 mt-3 flex gap-2.5 px-3 py-2.5 rounded-[6px] bg-err-soft text-err text-[13px]">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">A conferência automática encontrou problemas:</p>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      {alertasServidor.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <ul className="px-5 py-3 divide-y divide-rule">
                {chaves.length === 0 && <li className="py-6 text-sm text-ink-3">A IA não encontrou campos neste documento.</li>}
                {chaves.map((k, i) => {
                  const original = originais[k]
                  const tipo = tipoDoCampo(k, original ?? textos[k])
                  const alerta = alertas[i]
                  const mudou = alteracoes.includes(k)
                  const idCampo = `campo-${k}`
                  return (
                    <li key={k} className="py-3 grid sm:grid-cols-[150px_1fr] gap-x-4 gap-y-1.5 items-start">
                      <label htmlFor={idCampo} className="text-[13px] text-ink-2 pt-2 flex items-center gap-1.5">
                        {rotuloCampo(k)}
                        {mudou && <span className="size-1.5 rounded-full bg-stamp" title="Alterado por você" />}
                      </label>
                      <div>
                        {tipo === 'estrutura' ? (
                          <textarea
                            id={idCampo}
                            value={textos[k]}
                            disabled={!editavel}
                            onChange={(e) => setTextos((t) => ({ ...t, [k]: e.target.value }))}
                            rows={Math.min(10, (textos[k] ?? '').split('\n').length)}
                            className="w-full font-mono text-xs bg-paper border border-rule-strong rounded-[6px] p-2.5 disabled:opacity-80 focus:outline-none focus:border-ink"
                          />
                        ) : (
                          <div className="flex gap-1.5">
                            <Entrada
                              id={idCampo}
                              type={tipo === 'data' && /^\d{4}-\d{2}-\d{2}$/.test(textos[k] ?? '') ? 'date' : 'text'}
                              inputMode={tipo === 'moeda' || tipo === 'numero' ? 'decimal' : undefined}
                              value={textos[k]}
                              disabled={!editavel}
                              onChange={(e) => setTextos((t) => ({ ...t, [k]: e.target.value }))}
                              className={clsx(
                                'h-9 disabled:bg-paper/60 disabled:text-ink',
                                (tipo === 'moeda' || tipo === 'numero' || tipo === 'cpf' || tipo === 'cnpj') && 'font-mono tnum',
                                alerta && editavel && 'border-warn bg-warn-soft/40',
                              )}
                              placeholder="não lido"
                            />
                            {editavel && !(k in (atual.extraido?.dados ?? {})) && (
                              <button
                                onClick={() =>
                                  setTextos((t) => {
                                    const n = { ...t }
                                    delete n[k]
                                    return n
                                  })
                                }
                                className="p-2 rounded text-ink-3 hover:text-err hover:bg-sunk"
                                aria-label={`Remover campo ${rotuloCampo(k)}`}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                        {alerta && editavel && <p className="text-[11.5px] text-warn mt-1">{alerta}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>

              {editavel && (
                <form
                  className="px-5 pb-4 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const k = chaveDe(novoCampo)
                    if (!k || k in textos) return
                    setTextos((t) => ({ ...t, [k]: '' }))
                    setNovoCampo('')
                    setTimeout(() => document.getElementById(`campo-${k}`)?.focus(), 0)
                  }}
                >
                  <Entrada className="h-8 text-[13px]" placeholder="A IA esqueceu algum campo? Nome do campo" value={novoCampo} onChange={(e) => setNovoCampo(e.target.value)} aria-label="Nome do novo campo" />
                  <Botao type="submit" tamanho="sm" icone={<Plus className="size-3.5" />} disabled={!chaveDe(novoCampo)}>
                    Incluir
                  </Botao>
                </form>
              )}

              {erroForm && <p className="mx-5 mb-3 text-sm text-err">{erroForm}</p>}

              {editavel && (
                <footer className="sticky bottom-0 flex flex-wrap items-center gap-2 px-5 py-4 border-t border-rule bg-sheet rounded-b-[10px]">
                  <Botao variante="perigo" onClick={() => setRejeitando(true)} icone={<X className="size-4" />} atalho="R">
                    Rejeitar
                  </Botao>
                  {refazer && (
                    <Botao variante="fantasma" onClick={() => setRefazer(false)}>
                      Cancelar
                    </Botao>
                  )}
                  <div className="flex-1" />
                  <span className="text-xs text-ink-3 hidden sm:inline">
                    {alteracoes.length ? `${alteracoes.length} ${alteracoes.length === 1 ? 'correção' : 'correções'}` : 'sem correções'}
                  </span>
                  <Botao variante="ok" onClick={aprovar} carregando={validar.isPending} icone={<Check className="size-4" />} atalho="A">
                    {alteracoes.length ? 'Salvar correções e aprovar' : 'Aprovar'}
                  </Botao>
                </footer>
              )}
            </>
          )}

          {/* Histórico de leituras */}
          {doc.processamentos.length > 0 && (
            <details className="border-t border-rule group">
              <summary className="px-5 py-3 text-xs text-ink-3 cursor-pointer select-none flex items-center gap-2 hover:text-ink">
                <History className="size-3.5" /> Histórico de leituras ({doc.processamentos.length})
              </summary>
              <ul className="px-5 pb-4 space-y-2">
                {doc.processamentos.map((p) => (
                  <li key={p.id} className="text-xs font-mono flex flex-wrap gap-x-3 text-ink-2">
                    <span className="tnum">{fmt.dataHora(p.iniciado_em)}</span>
                    <span>{p.modelo ?? p.ferramenta}</span>
                    <span className={p.status === 'erro' ? 'text-err' : p.status === 'concluido' ? 'text-ok' : 'text-info'}>{p.status}</span>
                    {p.erro && <span className="text-err basis-full">{p.erro}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>

      <Modal
        aberto={rejeitando}
        aoFechar={() => setRejeitando(false)}
        titulo="Rejeitar documento"
        rodape={
          <>
            <Botao variante="fantasma" onClick={() => setRejeitando(false)}>
              Voltar
            </Botao>
            <Botao variante="perigo" onClick={rejeitar} disabled={!motivo.trim()} carregando={validar.isPending}>
              Rejeitar
            </Botao>
          </>
        }
      >
        <p className="text-sm text-ink-2 mb-4">Documentos rejeitados não entram na planilha. Diga o porquê para quem for olhar depois.</p>
        <Rotulo htmlFor="motivo">Motivo</Rotulo>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {['Ilegível', 'Documento incompleto', 'Não é deste cliente', 'Duplicado'].map((m) => (
            <button key={m} onClick={() => setMotivo(m)} className="text-xs px-2.5 py-1 rounded-full border border-rule-strong hover:border-ink text-ink-2">
              {m}
            </button>
          ))}
        </div>
        <Entrada id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Escreva o motivo" autoFocus onKeyDown={(e) => e.key === 'Enter' && rejeitar()} />
      </Modal>
    </div>
  )
}
