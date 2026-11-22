import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Inbox, ScanLine } from 'lucide-react'
import clsx from 'clsx'
import { api, type StatusDocumento } from '../lib/api'
import { useAuth } from '../lib/auth'
import { nomeCanal, useContagens } from '../lib/consultas'
import { fmt, STATUS } from '../lib/format'
import { BotaoLink, Cabecalho, Carregando, Falha, Painel, SeloStatus, Vazio } from '../components/ui'

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

const ORDEM: StatusDocumento[] = ['recebido', 'processando', 'extraido', 'validado', 'rejeitado', 'erro']
const COR_BARRA: Record<StatusDocumento, string> = {
  recebido: 'bg-rule-strong',
  processando: 'bg-info',
  extraido: 'bg-warn',
  validado: 'bg-ok',
  rejeitado: 'bg-err/60',
  erro: 'bg-err',
}

export function VisaoGeral() {
  const { usuario } = useAuth()
  const contagens = useContagens()
  const recentes = useQuery({ queryKey: ['documentos', 'recentes'], queryFn: () => api.listarDocumentos({ limit: 8 }) })

  const c = contagens.data?.porStatus
  const total = contagens.data?.total ?? 0
  const primeiroNome = usuario?.nome.split(' ')[0] ?? ''

  return (
    <>
      <Cabecalho
        sobretitulo={new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        titulo={
          <>
            {saudacao()}, <span className="italic">{primeiroNome}</span>.
          </>
        }
        descricao={
          c
            ? c.extraido > 0
              ? `Há ${c.extraido} ${c.extraido === 1 ? 'documento esperando' : 'documentos esperando'} a sua conferência.`
              : 'Nada esperando conferência agora.'
            : undefined
        }
        acoes={
          <>
                          <BotaoLink para="/entrada" icone={<Inbox className="size-4" />}>
                Enviar documentos
              </BotaoLink>
            <BotaoLink para="/conferencia" variante="primario" icone={<ScanLine className="size-4" />}>
              Conferir agora
            </BotaoLink>
          </>
        }
      />

      {contagens.isError && <Falha erro={contagens.error} tentar={() => contagens.refetch()} />}

      {/* Números do dia: régua contábil */}
      <div className="grid grid-cols-2 md:grid-cols-4 border-y border-ink mb-8">
        {(
          [
            ['A conferir', c?.extraido, 'text-warn', '/conferencia'],
            ['Na leitura', c ? c.recebido + c.processando : undefined, 'text-info', '/documentos?status=recebido'],
            ['Conferidos', c?.validado, 'text-ok', '/planilhas'],
            ['Falhas', c ? c.erro + c.rejeitado : undefined, 'text-err', '/documentos?status=erro'],
          ] as const
        ).map(([rotulo, valor, cor, para], i) => (
          <Link
            key={rotulo}
            to={para}
            className={clsx(
              'group px-5 py-5 hover:bg-sheet transition-colors',
              i > 0 && 'md:border-l border-rule',
              i % 2 === 1 && 'border-l md:border-l',
              i >= 2 && 'border-t md:border-t-0',
            )}
          >
            <p className="text-xs text-ink-3 flex items-center justify-between">
              {rotulo}
              <ArrowUpRight className="size-3.5 opacity-0 group-hover:opacity-100 transition" />
            </p>
            <p className={clsx('text-[32px] font-semibold tracking-[-0.03em] leading-none mt-2 tnum', valor ? cor : 'text-ink-3')}>{valor ?? '·'}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <Painel
          titulo="Chegaram por último"
          acoes={
            <Link to="/documentos" className="text-xs text-ink-2 hover:text-ink underline underline-offset-4">
              Ver todos
            </Link>
          }
        >
          {recentes.isLoading && <Carregando />}
          {recentes.isError && (
            <div className="p-4">
              <Falha erro={recentes.error} tentar={() => recentes.refetch()} />
            </div>
          )}
          {recentes.data?.dados.length === 0 && (
            <div className="p-5">
              <Vazio titulo="Mesa vazia">Envie os primeiros documentos pela Entrada.</Vazio>
            </div>
          )}
          <ul className="divide-y divide-rule">
            {recentes.data?.dados.map((d) => (
              <li key={d.id}>
                <Link to={`/documentos/${d.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-paper/60 transition-colors">
                  <span className="font-mono text-[11px] text-ink-3 w-16 shrink-0 tnum whitespace-nowrap">{fmt.relativo(d.data_envio)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.nome_arquivo}</p>
                    <p className="text-xs text-ink-3 truncate">
                      {d.tipos_documento?.nome ?? 'Tipo a definir'} · {nomeCanal(d.canais?.nome)}
                    </p>
                  </div>
                  <SeloStatus status={d.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Painel>

        <Painel titulo="Onde estão os documentos" sub={`${total} no total`}>
          <div className="p-5">
            {contagens.isLoading ? (
              <Carregando />
            ) : (
              <>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-rule mb-5" aria-hidden>
                  {total > 0 &&
                    ORDEM.map((s) => (c?.[s] ? <span key={s} className={COR_BARRA[s]} style={{ width: `${(c[s] / total) * 100}%` }} /> : null))}
                </div>
                <dl className="space-y-2.5">
                  {ORDEM.map((s) => (
                    <div key={s} className="flex items-center gap-3 text-sm">
                      <span className={clsx('size-2.5 rounded-sm', COR_BARRA[s])} />
                      <dt className="flex-1 text-ink-2">{STATUS[s].rotulo}</dt>
                      <dd className="font-mono tnum">{c?.[s] ?? 0}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </div>
        </Painel>
      </div>
    </>
  )
}
