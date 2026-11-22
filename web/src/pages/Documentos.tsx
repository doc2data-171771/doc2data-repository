import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight, RotateCw, Search, Sparkles } from 'lucide-react'
import { api, type StatusDocumento } from '../lib/api'
import { nomeCanal, useCatalogos, useContagens } from '../lib/consultas'
import { fmt, STATUS } from '../lib/format'
import { useProcessador } from '../lib/processador'
import { Botao, Caixa, Cabecalho, Carregando, Entrada as Campo, Falha, Painel, Seletor, SeloStatus, Vazio, useAvisos } from '../components/ui'

const ABAS: (StatusDocumento | '')[] = ['', 'recebido', 'processando', 'extraido', 'validado', 'rejeitado', 'erro']
const POR_PAGINA = 25
const LEGIVEIS: StatusDocumento[] = ['recebido', 'erro']

export function Documentos() {
  const navegar = useNavigate()
  const avisar = useAvisos()
  const [params, setParams] = useSearchParams()
  const { canais, tipos } = useCatalogos()
  const contagens = useContagens()
  const { estados, enfileirar } = useProcessador()

  const status = (params.get('status') ?? '') as StatusDocumento | ''
  const pagina = Number(params.get('pagina') ?? 1)
  const tipoId = params.get('tipo') ?? ''
  const canalId = params.get('canal') ?? ''
  const [busca, setBusca] = useState(params.get('busca') ?? '')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  // Busca com atraso para não disparar uma requisição por tecla
  useEffect(() => {
    if (busca.trim() === (params.get('busca') ?? '')) return
    const t = setTimeout(() => mudar({ busca: busca.trim() || null, pagina: null }), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca])

  function mudar(p: Record<string, string | null>) {
    const n = new URLSearchParams(params)
    for (const [k, v] of Object.entries(p)) v ? n.set(k, v) : n.delete(k)
    setParams(n, { replace: true })
    setSelecionados(new Set())
  }

  const consulta = useQuery({
    queryKey: ['documentos', { status, pagina, tipoId, canalId, busca: params.get('busca') }],
    queryFn: () =>
      api.listarDocumentos({
        status: status || undefined,
        tipo_documento_id: tipoId || undefined,
        canal_id: canalId || undefined,
        busca: params.get('busca') || undefined,
        page: pagina,
        limit: POR_PAGINA,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data?.dados.some((d) => d.status === 'processando') ? 4000 : false),
  })

  const docs = consulta.data?.dados ?? []
  const total = consulta.data?.paginacao.total ?? 0
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const selecionaveis = docs.filter((d) => LEGIVEIS.includes(d.status))
  const todosMarcados = selecionaveis.length > 0 && selecionaveis.every((d) => selecionados.has(d.id))

  function lerSelecionados() {
    const ids = [...selecionados]
    enfileirar(ids)
    setSelecionados(new Set())
    avisar(`${ids.length} na fila de leitura.`, 'info')
  }

  function alternar(id: string, v: boolean) {
    setSelecionados((s) => {
      const n = new Set(s)
      v ? n.add(id) : n.delete(id)
      return n
    })
  }

  return (
    <>
      <Cabecalho
        sobretitulo="Etapa 2 · Leitura"
        titulo="Documentos"
        descricao="Tudo o que entrou, em que pé está, e a leitura pela IA."
        acoes={
          selecionados.size > 0 && (
            <Botao variante="primario" onClick={lerSelecionados} icone={<Sparkles className="size-4" />}>
              Ler {selecionados.size} com IA
            </Botao>
          )
        }
      />

      {/* Abas de status */}
      <div className="flex gap-1 overflow-x-auto border-b border-rule mb-5 -mx-1 px-1">
        {ABAS.map((s) => {
          const n = s ? contagens.data?.porStatus[s] : contagens.data?.total
          const ativo = status === s
          return (
            <button
              key={s || 'todos'}
              onClick={() => mudar({ status: s || null, pagina: null })}
              className={clsx(
                'relative h-10 px-3 text-[13.5px] whitespace-nowrap transition-colors',
                ativo ? 'text-ink font-medium' : 'text-ink-3 hover:text-ink',
              )}
            >
              {s ? STATUS[s].rotulo : 'Todos'}
              {n !== undefined && <span className="ml-1.5 font-mono text-[11px] tnum text-ink-3">{n}</span>}
              {ativo && <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-ink" />}
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <Campo placeholder="Buscar pelo nome do arquivo" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" aria-label="Buscar" />
        </div>
        <Seletor className="sm:w-52" value={tipoId} onChange={(e) => mudar({ tipo: e.target.value || null, pagina: null })} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </Seletor>
        <Seletor className="sm:w-48" value={canalId} onChange={(e) => mudar({ canal: e.target.value || null, pagina: null })} aria-label="Canal">
          <option value="">Todos os canais</option>
          {canais.map((c) => (
            <option key={c.id} value={c.id}>
              {nomeCanal(c.nome)}
            </option>
          ))}
        </Seletor>
      </div>

      {consulta.isError && <Falha erro={consulta.error} tentar={() => consulta.refetch()} />}

      <Painel className="overflow-hidden">
        {consulta.isLoading ? (
          <Carregando />
        ) : docs.length === 0 ? (
          <div className="p-5">
            <Vazio titulo="Nada por aqui">Nenhum documento com esses filtros.</Vazio>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-ink-3 border-b border-rule">
                  <th className="pl-5 pr-2 py-3 w-8">
                    {selecionaveis.length > 0 && (
                      <Caixa
                        label="Marcar todos que podem ser lidos"
                        checked={todosMarcados}
                        indeterminate={!todosMarcados && selecionaveis.some((d) => selecionados.has(d.id))}
                        onChange={(v) => setSelecionados(v ? new Set(selecionaveis.map((d) => d.id)) : new Set())}
                      />
                    )}
                  </th>
                  <th className="px-2 py-3 font-medium">Arquivo</th>
                  <th className="px-2 py-3 font-medium hidden md:table-cell">Tipo</th>
                  <th className="px-2 py-3 font-medium hidden lg:table-cell">Canal</th>
                  <th className="px-2 py-3 font-medium hidden sm:table-cell">Chegou</th>
                  <th className="px-2 py-3 font-medium">Situação</th>
                  <th className="pl-2 pr-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {docs.map((d) => {
                  const fila = estados[d.id]
                  const lendo = fila?.estado === 'lendo' || fila?.estado === 'na_fila'
                  const legivel = LEGIVEIS.includes(d.status) && !lendo
                  return (
                    <tr
                      key={d.id}
                      onClick={() => navegar(`/documentos/${d.id}`)}
                      className={clsx('cursor-pointer hover:bg-paper/70 transition-colors', lendo && 'scanline')}
                    >
                      <td className="pl-5 pr-2 py-3">
                        {legivel && (
                          <Caixa label={`Marcar ${d.nome_arquivo}`} checked={selecionados.has(d.id)} onChange={(v) => alternar(d.id, v)} />
                        )}
                      </td>
                      <td className="px-2 py-3 max-w-[280px]">
                        <Link to={`/documentos/${d.id}`} onClick={(e) => e.stopPropagation()} className="font-medium truncate block hover:underline underline-offset-4">
                          {d.nome_arquivo}
                        </Link>
                        <span className="font-mono text-[11px] text-ink-3">{fmt.bytes(d.tamanho_bytes)}</span>
                      </td>
                      <td className="px-2 py-3 hidden md:table-cell text-ink-2">{d.tipos_documento?.nome ?? <span className="text-ink-3">—</span>}</td>
                      <td className="px-2 py-3 hidden lg:table-cell text-ink-2">{nomeCanal(d.canais?.nome)}</td>
                      <td className="px-2 py-3 hidden sm:table-cell font-mono text-xs text-ink-3 tnum" title={fmt.dataHora(d.data_envio)}>
                        {fmt.relativo(d.data_envio)}
                      </td>
                      <td className="px-2 py-3">
                        <SeloStatus status={d.status} lendo={lendo} />
                        {fila?.estado === 'na_fila' && <span className="ml-2 text-[11px] text-ink-3">na fila</span>}
                        {fila?.estado === 'falhou' && d.status === 'erro' && (
                          <p className="text-[11px] text-err mt-1 max-w-[220px] truncate" title={fila.erro}>
                            {fila.erro}
                          </p>
                        )}
                      </td>
                      <td className="pl-2 pr-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {legivel && (
                          <Botao
                            tamanho="sm"
                            variante={d.status === 'erro' ? 'secundario' : 'fantasma'}
                            onClick={() => enfileirar([d.id])}
                            icone={d.status === 'erro' ? <RotateCw className="size-3.5" /> : <Sparkles className="size-3.5" />}
                          >
                            {d.status === 'erro' ? 'Reler' : 'Ler'}
                          </Botao>
                        )}
                        {d.status === 'extraido' && (
                          <Link to={`/documentos/${d.id}`} className="text-[13px] font-medium text-stamp hover:underline underline-offset-4">
                            Conferir →
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {paginas > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-rule text-sm">
            <span className="text-ink-3 font-mono text-xs tnum">
              {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total}
            </span>
            <div className="flex gap-1">
              <Botao tamanho="sm" variante="fantasma" disabled={pagina <= 1} onClick={() => mudar({ pagina: String(pagina - 1) })} aria-label="Página anterior">
                <ChevronLeft className="size-4" />
              </Botao>
              <Botao tamanho="sm" variante="fantasma" disabled={pagina >= paginas} onClick={() => mudar({ pagina: String(pagina + 1) })} aria-label="Próxima página">
                <ChevronRight className="size-4" />
              </Botao>
            </div>
          </div>
        )}
      </Painel>
    </>
  )
}
