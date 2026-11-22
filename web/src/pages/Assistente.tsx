import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowUp, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { fmt } from '../lib/format'
import { Cabecalho, mensagemDe } from '../components/ui'

interface Mensagem {
  de: 'voce' | 'ia'
  texto: string
  erro?: boolean
  analisados?: number
}

const SUGESTOES = [
  'Qual é a soma dos valores de todos os documentos?',
  'Liste os boletos com vencimento nos próximos 30 dias.',
  'Quais documentos têm CNPJ ou CPF repetido?',
  'Resuma os documentos que ainda faltam conferir.',
]

/** Assistente: a pessoa dá instruções e a IA analisa os dados extraídos dos documentos da conta dela. */
export function Assistente() {
  const { usuario } = useAuth()
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  const fim = useRef<HTMLDivElement>(null)

  const perguntar = useMutation({
    mutationFn: (pergunta: string) => api.perguntar(pergunta),
    onSuccess: (r) => setMensagens((m) => [...m, { de: 'ia', texto: r.resposta, analisados: r.documentos_analisados }]),
    onError: (e) => setMensagens((m) => [...m, { de: 'ia', texto: mensagemDe(e), erro: true }]),
  })

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensagens.length, perguntar.isPending])

  function enviar(pergunta: string) {
    const p = pergunta.trim()
    if (!p || perguntar.isPending) return
    setMensagens((m) => [...m, { de: 'voce', texto: p }])
    setTexto('')
    perguntar.mutate(p)
  }

  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    enviar(texto)
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-140px)]">
      <Cabecalho
        sobretitulo="Dados"
        titulo="Assistente IA"
        descricao="Dê instruções em linguagem natural. A IA analisa os dados já extraídos dos seus documentos (só da sua conta) e responde."
      />

      <div className="flex-1 space-y-5 pb-6" aria-live="polite">
        {!mensagens.length && (
          <div className="max-w-[640px] mx-auto pt-8 text-center">
            <div className="inline-grid place-items-center size-10 rounded-[10px] bg-stamp-soft text-stamp mb-4">
              <Sparkles className="size-5" />
            </div>
            <p className="text-[15px] font-medium">O que você quer saber dos seus documentos?</p>
            <p className="text-[13px] text-ink-3 mt-1">Ela usa os documentos já lidos, conferidos ou não.</p>
            <div className="mt-6 grid sm:grid-cols-2 gap-2 text-left">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="px-3 py-2.5 rounded-[8px] border border-rule bg-paper/40 hover:bg-sunk hover:border-rule-strong text-[13px] text-ink-2 hover:text-ink transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensagens.map((m, i) => (
          <div key={i} className={clsx('flex gap-3 max-w-[820px]', m.de === 'voce' && 'ml-auto flex-row-reverse')}>
            <div
              className={clsx(
                'size-7 shrink-0 rounded-full grid place-items-center text-[10px] font-semibold',
                m.de === 'voce' ? 'bg-sunk text-ink-2' : 'bg-stamp text-white',
              )}
              aria-hidden
            >
              {m.de === 'voce' ? (usuario ? fmt.iniciais(usuario.nome) : 'VC') : <Sparkles className="size-3.5" />}
            </div>
            <div
              className={clsx(
                'rounded-[10px] px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words min-w-0',
                m.de === 'voce' ? 'bg-stamp-soft text-ink' : m.erro ? 'bg-err-soft text-err border border-err/25' : 'bg-paper/50 border border-rule',
              )}
            >
              {m.texto}
              {m.analisados !== undefined && (
                <p className="mt-2 text-[11.5px] text-ink-3">
                  {m.analisados} {m.analisados === 1 ? 'documento analisado' : 'documentos analisados'}
                </p>
              )}
            </div>
          </div>
        ))}

        {perguntar.isPending && (
          <div className="flex gap-3" role="status">
            <div className="size-7 rounded-full grid place-items-center bg-stamp text-white">
              <Sparkles className="size-3.5 animate-pulse" />
            </div>
            <p className="text-[13px] text-ink-3 py-1.5">Analisando seus documentos…</p>
          </div>
        )}
        <div ref={fim} />
      </div>

      <form onSubmit={aoEnviar} className="sticky bottom-3 mt-auto">
        <div className="flex items-end gap-2 rounded-[12px] border border-rule-strong bg-paper p-2 shadow-xl focus-within:border-stamp focus-within:ring-2 focus-within:ring-stamp/20">
          <label htmlFor="instrucao" className="sr-only">Instrução para a IA</label>
          <textarea
            id="instrucao"
            rows={1}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                enviar(texto)
              }
            }}
            maxLength={2000}
            placeholder="Ex.: some o valor total das notas fiscais de novembro"
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-[13.5px] text-ink placeholder:text-ink-3 focus:outline-none max-h-40 field-sizing-content"
          />
          <button
            type="submit"
            disabled={!texto.trim() || perguntar.isPending}
            className="size-8 shrink-0 grid place-items-center rounded-[8px] bg-stamp text-white disabled:opacity-40 hover:brightness-110"
            aria-label="Enviar instrução"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
        <p className="text-[11px] text-ink-3 mt-1.5 px-1">Enter envia · Shift+Enter quebra a linha · a IA pode errar, confira os números importantes.</p>
      </form>
    </div>
  )
}
