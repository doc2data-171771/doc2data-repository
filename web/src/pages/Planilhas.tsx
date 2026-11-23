import { useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { api, extracaoAtual, type Formato } from '../lib/api'
import { nomeCanal } from '../lib/consultas'
import { fmt, partePrincipal, valorPrincipal } from '../lib/format'
import { Botao, Caixa, Cabecalho, Carregando, Falha, Painel, Selo, Vazio, mensagemDe, useAvisos } from '../components/ui'

function baixar(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  a.download = ''
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function Planilhas() {
  const qc = useQueryClient()
  const avisar = useAvisos()
  const [formato, setFormato] = useState<Formato>('xlsx')
  const [marcados, setMarcados] = useState<Set<string> | null>(null) // null = todos

  const validados = useQuery({
    queryKey: ['documentos', 'validados'],
    queryFn: () => api.listarDocumentos({ status: 'validado', limit: 100 }),
  })
  const detalhes = useQueries({
    queries: (validados.data?.dados ?? []).map((d) => ({
      queryKey: ['documento', d.id],
      queryFn: () => api.obterDocumento(d.id),
      staleTime: 60_000,
    })),
  })
  const historico = useQuery({ queryKey: ['exportacoes'], queryFn: () => api.listarExportacoes() })

  const docs = validados.data?.dados ?? []
  const totalValidados = validados.data?.paginacao.total ?? 0
  const selecionados = marcados ?? new Set(docs.map((d) => d.id))
  const porId = useMemo(
    () => Object.fromEntries(detalhes.flatMap((q) => (q.data ? [[q.data.id, extracaoAtual(q.data).dadosFinais]] : []))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detalhes.map((q) => q.dataUpdatedAt).join()],
  )
  const soma = docs.filter((d) => selecionados.has(d.id)).reduce((a, d) => a + (valorPrincipal(porId[d.id]) ?? 0), 0)


  const exportar = useMutation({
    mutationFn: () => {
      const todos = marcados === null && totalValidados > docs.length
      return api.exportar(formato, todos ? 'todos' : [...selecionados])
    },
    onSuccess: (r) => {
      baixar(r.download_url)
      avisar('Planilha gerada. O download começou.')
      qc.invalidateQueries({ queryKey: ['exportacoes'] })
      setMarcados(null)
    },
    onError: (e) => avisar(mensagemDe(e), 'erro'),
  })

  async function baixarDeNovo(id: string) {
    try {
      baixar(await api.linkExportacao(id))
    } catch (e) {
      avisar(mensagemDe(e), 'erro')
    }
  }

  const todos = docs.length > 0 && docs.every((d) => selecionados.has(d.id))

  return (
    <>
      <Cabecalho
        sobretitulo="Etapa 4 · Saída"
        titulo="Planilhas"
        descricao="Só entra o que foi conferido. Escolha os documentos, o formato, e baixe."
      />

      {validados.isError && <Falha erro={validados.error} tentar={() => validados.refetch()} />}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
        <Painel
          titulo="Conferidos e prontos"
          sub={totalValidados ? `${totalValidados} ${totalValidados === 1 ? 'documento' : 'documentos'}` : undefined}
          className="overflow-hidden"
        >
          {validados.isLoading ? (
            <Carregando />
          ) : docs.length === 0 ? (
            <div className="p-5">
              <Vazio titulo="Nada conferido ainda">Os documentos aprovados na conferência aparecem aqui.</Vazio>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-ink-3 border-b border-rule bg-paper/40">
                    <th className="pl-5 pr-2 py-3 w-8">
                      <Caixa
                        label="Marcar todos"
                        checked={todos}
                        indeterminate={!todos && selecionados.size > 0}
                        onChange={(v) => setMarcados(v ? null : new Set())}
                      />
                    </th>
                    <th className="px-2 py-3 font-medium">Arquivo</th>
                    <th className="px-2 py-3 font-medium hidden md:table-cell">Tipo</th>
                    <th className="px-2 py-3 font-medium hidden lg:table-cell">Emitente / pessoa</th>
                    <th className="pl-2 pr-5 py-3 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {docs.map((d) => {
                    const dados = porId[d.id]
                    const v = valorPrincipal(dados)
                    return (
                      <tr key={d.id} className={clsx(!selecionados.has(d.id) && 'opacity-50')}>
                        <td className="pl-5 pr-2 py-2.5">
                          <Caixa
                            label={`Incluir ${d.nome_arquivo}`}
                            checked={selecionados.has(d.id)}
                            onChange={(on) => {
                              const n = new Set(selecionados)
                              on ? n.add(d.id) : n.delete(d.id)
                              setMarcados(n)
                            }}
                          />
                        </td>
                        <td className="px-2 py-2.5 max-w-[220px]">
                          <p className="truncate">{d.nome_arquivo}</p>
                          <p className="text-[11px] text-ink-3">{nomeCanal(d.canais?.nome)}</p>
                        </td>
                        <td className="px-2 py-2.5 hidden md:table-cell text-ink-2 whitespace-nowrap">{d.tipos_documento?.nome ?? '—'}</td>
                        <td className="px-2 py-2.5 hidden lg:table-cell text-ink-2 max-w-[200px] truncate">{partePrincipal(dados) ?? '—'}</td>
                        <td className="pl-2 pr-5 py-2.5 text-right font-mono tnum whitespace-nowrap">{v !== null ? fmt.moeda(v) : <span className="text-ink-3">—</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
                {soma > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-ink">
                      <td colSpan={5} className="px-5 py-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-ink-2">Soma dos valores selecionados</span>
                          <span className="font-mono tnum font-semibold">{fmt.moeda(soma)}</span>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </Painel>

        <div className="space-y-6 lg:sticky lg:top-10">
          <Painel titulo="Gerar planilha">
            <div className="p-5 space-y-4">
              <fieldset>
                <legend className="text-xs font-medium text-ink-2 mb-2">Formato</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['xlsx', 'Excel', FileSpreadsheet],
                      ['csv', 'CSV', FileText],
                    ] as const
                  ).map(([f, nome, Icone]) => (
                    <button
                      key={f}
                      onClick={() => setFormato(f)}
                      aria-pressed={formato === f}
                      className={clsx(
                        'flex flex-col items-start gap-2 p-3 rounded-[8px] border text-left transition-colors',
                        formato === f ? 'border-ink bg-paper' : 'border-rule-strong hover:border-ink-2',
                      )}
                    >
                      <Icone className={clsx('size-5', formato === f ? 'text-ink' : 'text-ink-3')} />
                      <span className="text-sm font-medium">{nome}</span>
                      <span className="font-mono text-[10.5px] text-ink-3">.{f}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <Botao
                variante="primario"
                className="w-full"
                disabled={selecionados.size === 0}
                carregando={exportar.isPending}
                onClick={() => exportar.mutate()}
                icone={<Download className="size-4" />}
              >
                {marcados === null && totalValidados > docs.length
                  ? `Exportar todos os ${totalValidados}`
                  : `Exportar ${selecionados.size} ${selecionados.size === 1 ? 'documento' : 'documentos'}`}
              </Botao>
              <p className="text-[11.5px] text-ink-3 leading-relaxed">
                Uma linha por documento, com arquivo, tipo, canal, datas, confiança e os campos conferidos (já com as correções feitas na conferência).
              </p>
            </div>
          </Painel>

          <Painel titulo="Geradas antes">
            {historico.isLoading ? (
              <Carregando />
            ) : !historico.data?.dados.length ? (
              <p className="px-5 py-6 text-sm text-ink-3">Nenhuma planilha gerada ainda.</p>
            ) : (
              <ul className="divide-y divide-rule">
                {historico.data.dados.slice(0, 8).map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        {e.exportacao_documentos?.[0]?.count ?? '?'} docs <Selo className="ml-1">{e.formato}</Selo>
                      </p>
                      <p className="text-[11.5px] text-ink-3 truncate">
                        {fmt.dataHora(e.created_at)}
                        {e.solicitante && ` · ${e.solicitante.nome}`}
                      </p>
                    </div>
                    {e.status === 'gerado' ? (
                      <button onClick={() => baixarDeNovo(e.id)} className="p-2 rounded text-ink-2 hover:bg-sunk hover:text-ink" aria-label="Baixar de novo">
                        <Download className="size-4" />
                      </button>
                    ) : (
                      <Selo tom={e.status === 'erro' ? 'err' : 'neutro'}>{e.status}</Selo>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        </div>
      </div>
    </>
  )
}
