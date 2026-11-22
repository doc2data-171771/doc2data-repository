// Mesa de conferência: todos os documentos lidos pela IA e ainda não conferidos.
// Modo lote: tabela com os campos principais, edição rápida e aprovação em massa.

import { Fragment, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { AlertTriangle, ArrowRight, Check, CheckCheck, Filter } from 'lucide-react'
import { api, extracaoAtual, type DocumentoDetalhe } from '../lib/api'
import { alertaDoCampo, exibirValor, fmt, LIMIAR_CONFIANCA, partePrincipal, valorPrincipal } from '../lib/format'
import { Botao, BotaoLink, Caixa, Cabecalho, Carregando, Confianca, Falha, Painel, Vazio, mensagemDe, useAvisos } from '../components/ui'

const LIMITE = 50

interface Linha {
  doc: DocumentoDetalhe
  confianca: number | null
  parte: string | null
  valor: number | null
  alertas: number
  campos: [string, unknown][]
  extraidoId: string | null
}

function montarLinha(doc: DocumentoDetalhe): Linha {
  const { extraido, dadosFinais } = extracaoAtual(doc)
  const dados = dadosFinais ?? {}
  return {
    doc,
    confianca: extraido?.confianca ?? null,
    parte: partePrincipal(dados),
    valor: valorPrincipal(dados),
    alertas: Object.entries(dados).filter(([k, v]) => alertaDoCampo(k, v)).length,
    campos: Object.entries(dados),
    extraidoId: extraido?.id ?? null,
  }
}

export function Conferencia() {
  const navegar = useNavigate()
  const qc = useQueryClient()
  const avisar = useAvisos()
  const [soAtencao, setSoAtencao] = useState(false)
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [aprovando, setAprovando] = useState(false)
  const [aberto, setAberto] = useState<string | null>(null)

  const lista = useQuery({
    queryKey: ['documentos', 'fila-conferencia'],
    queryFn: () => api.listarDocumentos({ status: 'extraido', limit: LIMITE }),
  })
  // A listagem não traz os dados extraídos; buscamos o detalhe de cada um.
  const detalhes = useQueries({
    queries: (lista.data?.dados ?? []).map((d) => ({
      queryKey: ['documento', d.id],
      queryFn: () => api.obterDocumento(d.id),
      staleTime: 30_000,
    })),
  })

  const carregandoDetalhes = detalhes.some((q) => q.isLoading)
  const linhas = useMemo(
    () => detalhes.flatMap((q) => (q.data && q.data.status === 'extraido' ? [montarLinha(q.data)] : [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detalhes.map((q) => q.dataUpdatedAt).join()],
  )
  const precisaAtencao = (l: Linha) => l.alertas > 0 || (l.confianca !== null && l.confianca < LIMIAR_CONFIANCA)
  const visiveis = soAtencao ? linhas.filter(precisaAtencao) : linhas
  const qtdAtencao = linhas.filter(precisaAtencao).length
  const tranquilos = linhas.filter((l) => !precisaAtencao(l))
  const somaMarcados = linhas.filter((l) => marcados.has(l.doc.id)).reduce((a, l) => a + (l.valor ?? 0), 0)

  async function aprovarMarcados(ids = [...marcados]) {
    const alvo = linhas.filter((l) => ids.includes(l.doc.id) && l.extraidoId)
    if (!alvo.length) return
    setAprovando(true)
    let ok = 0
    const falhas: string[] = []
    for (const l of alvo) {
      try {
        await api.validar({ dados_extraidos_id: l.extraidoId!, status: 'aprovado' })
        ok++
      } catch (e) {
        falhas.push(`${l.doc.nome_arquivo}: ${mensagemDe(e)}`)
      }
    }
    setAprovando(false)
    setMarcados(new Set())
    qc.invalidateQueries({ queryKey: ['documentos'] })
    qc.invalidateQueries({ queryKey: ['contagens'] })
    alvo.forEach((l) => qc.invalidateQueries({ queryKey: ['documento', l.doc.id] }))
    if (ok) avisar(`${ok} ${ok === 1 ? 'documento conferido' : 'documentos conferidos'}.`)
    if (falhas.length) avisar(`Não foi possível aprovar ${falhas.length}: ${falhas[0]}`, 'erro')
  }

  const todosVisiveisMarcados = visiveis.length > 0 && visiveis.every((l) => marcados.has(l.doc.id))

  return (
    <>
      <Cabecalho
        sobretitulo="Etapa 3 · Conferência"
        titulo="Mesa de conferência"
        descricao="O que a IA leu e ainda espera o olho de uma pessoa. Abra um por um, ou aprove em lote o que está tranquilo."
        acoes={
          linhas.length > 0 && (
            <BotaoLink para={`/documentos/${(linhas.find(precisaAtencao) ?? linhas[0])!.doc.id}`} variante="primario" icone={<ArrowRight className="size-4" />}>
              Conferir um a um
            </BotaoLink>
          )
        }
      />

      {lista.isError && <Falha erro={lista.error} tentar={() => lista.refetch()} />}

      {lista.isLoading || (carregandoDetalhes && linhas.length === 0) ? (
        <Carregando texto="Reunindo os documentos lidos…" />
      ) : lista.data?.dados.length === 0 ? (
        <Vazio titulo="Mesa limpa." icone={<CheckCheck className="size-8" />}>
          Nenhum documento esperando conferência.{' '}
          <Link to="/planilhas" className="underline underline-offset-4">
            Gerar a planilha
          </Link>{' '}
          com o que já foi conferido.
        </Vazio>
      ) : (
        <>
          {/* Resumo e ações */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="inline-flex rounded-[6px] border border-rule-strong p-0.5 bg-sheet">
              <button
                onClick={() => setSoAtencao(false)}
                className={clsx('h-8 px-3 text-[13px] rounded-[4px]', !soAtencao ? 'bg-ink text-sheet' : 'text-ink-2 hover:text-ink')}
              >
                Todos <span className="font-mono text-[11px] opacity-70 ml-1">{linhas.length}</span>
              </button>
              <button
                onClick={() => setSoAtencao(true)}
                className={clsx('h-8 px-3 text-[13px] rounded-[4px] inline-flex items-center gap-1.5', soAtencao ? 'bg-ink text-sheet' : 'text-ink-2 hover:text-ink')}
              >
                <Filter className="size-3" /> Pedem atenção <span className="font-mono text-[11px] opacity-70">{qtdAtencao}</span>
              </button>
            </div>
            <div className="flex-1" />
            {marcados.size === 0 && tranquilos.length > 0 && (
              <Botao onClick={() => setMarcados(new Set(tranquilos.map((l) => l.doc.id)))} icone={<CheckCheck className="size-4" />}>
                Marcar os {tranquilos.length} sem alertas
              </Botao>
            )}
            {marcados.size > 0 && (
              <>
                <span className="text-sm text-ink-2">
                  {marcados.size} {marcados.size === 1 ? 'marcado' : 'marcados'}
                  {somaMarcados > 0 && <span className="font-mono tnum"> · {fmt.moeda(somaMarcados)}</span>}
                </span>
                <Botao variante="fantasma" onClick={() => setMarcados(new Set())}>
                  Desmarcar
                </Botao>
                <Botao variante="ok" carregando={aprovando} onClick={() => aprovarMarcados()} icone={<Check className="size-4" />}>
                  Aprovar {marcados.size}
                </Botao>
              </>
            )}
          </div>

          <Painel className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-ink-3 border-b border-rule bg-paper/40">
                    <th className="pl-5 pr-2 py-3 w-8">
                      {(
                        <Caixa
                          label="Marcar todos visíveis"
                          checked={todosVisiveisMarcados}
                          indeterminate={!todosVisiveisMarcados && visiveis.some((l) => marcados.has(l.doc.id))}
                          onChange={(v) => setMarcados(v ? new Set(visiveis.map((l) => l.doc.id)) : new Set())}
                        />
                      )}
                    </th>
                    <th className="px-2 py-3 font-medium">Documento</th>
                    <th className="px-2 py-3 font-medium hidden md:table-cell">Emitente / pessoa</th>
                    <th className="px-2 py-3 font-medium text-right">Valor</th>
                    <th className="px-2 py-3 font-medium">Confiança</th>
                    <th className="px-2 py-3 font-medium hidden sm:table-cell">Alertas</th>
                    <th className="pl-2 pr-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((l) => {
                    const expandido = aberto === l.doc.id
                    return (
                      <Fragment key={l.doc.id}>
                        <tr
                          onClick={() => setAberto(expandido ? null : l.doc.id)}
                          className={clsx('border-t border-rule cursor-pointer transition-colors', expandido ? 'bg-paper/70' : 'hover:bg-paper/50', marcados.has(l.doc.id) && 'bg-ok-soft/40')}
                        >
                          <td className="pl-5 pr-2 py-3">
                            {(
                              <Caixa
                                label={`Marcar ${l.doc.nome_arquivo}`}
                                checked={marcados.has(l.doc.id)}
                                onChange={(v) =>
                                  setMarcados((s) => {
                                    const n = new Set(s)
                                    v ? n.add(l.doc.id) : n.delete(l.doc.id)
                                    return n
                                  })
                                }
                              />
                            )}
                          </td>
                          <td className="px-2 py-3 max-w-[240px]">
                            <p className="font-medium truncate">{l.doc.nome_arquivo}</p>
                            <p className="text-xs text-ink-3 truncate">{l.doc.tipos_documento?.nome ?? 'Tipo a definir'}</p>
                          </td>
                          <td className="px-2 py-3 hidden md:table-cell text-ink-2 max-w-[220px] truncate">{l.parte ?? '—'}</td>
                          <td className="px-2 py-3 text-right font-mono tnum whitespace-nowrap">{l.valor !== null ? fmt.moeda(l.valor) : <span className="text-ink-3">—</span>}</td>
                          <td className="px-2 py-3">
                            <Confianca valor={l.confianca} compacto />
                          </td>
                          <td className="px-2 py-3 hidden sm:table-cell">
                            {l.alertas > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs text-warn">
                                <AlertTriangle className="size-3.5" /> {l.alertas}
                              </span>
                            ) : (
                              <span className="text-xs text-ink-3">—</span>
                            )}
                          </td>
                          <td className="pl-2 pr-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <Link to={`/documentos/${l.doc.id}`} className="text-[13px] font-medium text-stamp hover:underline underline-offset-4 whitespace-nowrap">
                              Abrir →
                            </Link>
                          </td>
                        </tr>
                        {expandido && (
                          <tr className="bg-paper/70">
                            <td />
                            <td colSpan={6} className="pr-5 pb-4">
                              <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5 pt-1">
                                {l.campos.map(([k, v]) => {
                                  const alerta = alertaDoCampo(k, v)
                                  return (
                                    <div key={k} className="min-w-0">
                                      <dt className="text-[11px] uppercase tracking-[0.06em] text-ink-3 truncate">{k.replace(/_/g, ' ')}</dt>
                                      <dd className={clsx('text-[13px] truncate', alerta ? 'text-warn' : 'text-ink')} title={alerta ?? undefined}>
                                        {exibirValor(k, v)}
                                      </dd>
                                    </div>
                                  )
                                })}
                              </dl>
                              <div className="flex gap-2 mt-4">
                                <Botao tamanho="sm" onClick={() => navegar(`/documentos/${l.doc.id}`)}>
                                  Abrir para corrigir
                                </Botao>
                                {(
                                  <Botao tamanho="sm" variante="ok" icone={<Check className="size-3.5" />} carregando={aprovando} onClick={() => aprovarMarcados([l.doc.id])}>
                                    Aprovar como está
                                  </Botao>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {(lista.data?.paginacao.total ?? 0) > LIMITE && (
              <p className="px-5 py-3 border-t border-rule text-xs text-ink-3">
                Mostrando os {LIMITE} mais recentes de {lista.data?.paginacao.total}. Confira estes para ver os próximos.
              </p>
            )}
          </Painel>
          <p className="text-xs text-ink-3 mt-3">
            Clique numa linha para ver todos os campos. A aprovação em lote mantém os dados exatamente como a IA leu.
          </p>
        </>
      )}
    </>
  )
}
