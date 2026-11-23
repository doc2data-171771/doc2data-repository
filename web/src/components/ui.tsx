import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, Info, Loader2, X } from 'lucide-react'
import type { StatusDocumento } from '../lib/api'
import { LIMIAR_CONFIANCA, STATUS, type Tom } from '../lib/format'

// ---------------------------------------------------------------- marca

export function Logo({ className, tamanho = 'md' }: { className?: string; tamanho?: 'md' | 'lg' }) {
  return (
    <span className={clsx('inline-flex items-center gap-2 select-none font-semibold tracking-[-0.02em]', tamanho === 'lg' ? 'text-2xl' : 'text-[14px]', className)}>
      <span className={clsx('grid place-items-center rounded-[6px] bg-stamp text-white font-mono font-bold', tamanho === 'lg' ? 'size-9 text-base' : 'size-5 text-[11px]')}>2</span>
      doc2data
    </span>
  )
}

// ---------------------------------------------------------------- botões e campos

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo' | 'ok'

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-stamp text-white border-stamp hover:brightness-110 shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]',
  secundario: 'bg-sunk/50 text-ink border-rule-strong hover:bg-sunk',
  fantasma: 'bg-transparent text-ink-2 border-transparent hover:bg-sunk hover:text-ink',
  perigo: 'bg-transparent text-err border-err/40 hover:bg-err-soft',
  ok: 'bg-ok text-white border-ok hover:brightness-110',
}

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamanho?: 'sm' | 'md'
  carregando?: boolean
  icone?: ReactNode
  atalho?: string
}

const classesBotao = (variante: Variante, tamanho: 'sm' | 'md', className?: string) =>
  clsx(
    'inline-flex items-center justify-center gap-1.5 border rounded-[6px] font-medium transition-[background,filter,border-color] whitespace-nowrap',
    'disabled:opacity-45 disabled:pointer-events-none cursor-pointer',
    tamanho === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8 px-3 text-[13px]',
    VARIANTES[variante],
    className,
  )

/** Link de navegação com aparência de botão (evita <button> dentro de <a>). */
export function BotaoLink({ para, variante = 'secundario', tamanho = 'md', icone, className, children }: { para: string; variante?: Variante; tamanho?: 'sm' | 'md'; icone?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Link to={para} className={classesBotao(variante, tamanho, className)}>
      {icone}
      {children}
    </Link>
  )
}

export function Botao({ variante = 'secundario', tamanho = 'md', carregando, icone, atalho, className, children, disabled, ...rest }: BotaoProps) {
  return (
    <button
      {...rest}
      disabled={disabled || carregando}
      className={classesBotao(variante, tamanho, className)}
    >
      {carregando ? <Loader2 className="size-4 animate-spin" /> : icone}
      {children}
      {atalho && (
        <kbd className="ml-1 font-mono text-[10px] px-1 py-px rounded border border-current/25 opacity-60">{atalho}</kbd>
      )}
    </button>
  )
}

const campoBase =
  'w-full bg-paper border border-rule-strong rounded-[6px] px-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:outline-none focus:border-stamp focus:ring-2 focus:ring-stamp/20 transition'

export function Entrada({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={clsx(campoBase, 'h-9', className)} />
}

export function Seletor({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={clsx(campoBase, 'h-9 pr-8 cursor-pointer', className)}>
      {children}
    </select>
  )
}

export function Rotulo({ children, htmlFor, extra }: { children: ReactNode; htmlFor?: string; extra?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="flex items-center justify-between text-xs font-medium text-ink-2 mb-1.5">
      <span>{children}</span>
      {extra}
    </label>
  )
}

// ---------------------------------------------------------------- status

const TOM_SELO: Record<Tom, string> = {
  neutro: 'text-ink-2 bg-sunk border-rule-strong',
  info: 'text-info bg-info-soft border-info/30',
  warn: 'text-warn bg-warn-soft border-warn/30',
  ok: 'text-ok bg-ok-soft border-ok/30',
  err: 'text-err bg-err-soft border-err/30',
  stamp: 'text-stamp bg-stamp-soft border-stamp/30',
}

export function Selo({ tom = 'neutro', children, className }: { tom?: Tom; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full border text-[11.5px] font-medium whitespace-nowrap',
        TOM_SELO[tom],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function SeloStatus({ status, lendo }: { status: StatusDocumento; lendo?: boolean }) {
  const s = STATUS[lendo ? 'processando' : status]
  return (
    <Selo tom={s.tom}>
      {(lendo || status === 'processando') && <span className="size-1.5 rounded-full bg-current animate-pulse" />}
      {s.rotulo}
    </Selo>
  )
}

/** Carimbo grande da conferência: CONFERIDO / REJEITADO. */
export function Carimbo({ tipo, data, animar }: { tipo: 'conferido' | 'rejeitado'; data?: string; animar?: boolean }) {
  return (
    <div
      className={clsx(
        'stamp-mark inline-flex flex-col items-center px-4 py-1.5 rounded-[4px] font-mono uppercase',
        tipo === 'conferido' ? 'text-ok' : 'text-err',
        animar && 'stamp-in',
      )}
      aria-label={tipo === 'conferido' ? 'Documento conferido' : 'Documento rejeitado'}
    >
      <span className="text-[15px] font-semibold tracking-[0.18em]">{tipo}</span>
      {data && <span className="text-[9.5px] tracking-[0.12em] opacity-80">{data}</span>}
    </div>
  )
}

/** Medidor de confiança da IA (0–100). */
export function Confianca({ valor, compacto }: { valor: number | null | undefined; compacto?: boolean }) {
  if (valor === null || valor === undefined) return <span className="font-mono text-xs text-ink-3">—</span>
  const baixa = valor < LIMIAR_CONFIANCA
  const cor = valor < 65 ? 'bg-err' : baixa ? 'bg-warn' : 'bg-ok'
  return (
    <span className="inline-flex items-center gap-2" title={`Confiança da IA: ${valor}%`}>
      <span className={clsx('relative h-1.5 rounded-full bg-rule overflow-hidden', compacto ? 'w-10' : 'w-16')}>
        <span className={clsx('absolute inset-y-0 left-0 rounded-full', cor)} style={{ width: `${valor}%` }} />
      </span>
      <span className={clsx('font-mono text-xs tnum', baixa ? 'text-warn font-semibold' : 'text-ink-2')}>{Math.round(valor)}%</span>
    </span>
  )
}

// ---------------------------------------------------------------- estrutura

export function Painel({ children, className, titulo, acoes, sub }: { children: ReactNode; className?: string; titulo?: ReactNode; acoes?: ReactNode; sub?: ReactNode }) {
  return (
    <section className={clsx('bg-sheet border border-rule rounded-[10px] shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]', className)}>
      {(titulo || acoes) && (
        <header className="flex items-center justify-between gap-3 px-4 h-11 border-b border-rule">
          <div className="min-w-0">
            <h2 className="text-[13px] font-medium truncate">{titulo}</h2>
            {sub && <p className="text-xs text-ink-3 truncate">{sub}</p>}
          </div>
          {acoes && <div className="flex items-center gap-2 shrink-0">{acoes}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Cabecalho({ sobretitulo, titulo, descricao, acoes }: { sobretitulo?: string; titulo: ReactNode; descricao?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pb-5 border-b border-rule">
      <div className="min-w-0">
        {sobretitulo && <p className="text-[12px] text-ink-3 mb-1">{sobretitulo}</p>}
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.025em]">{titulo}</h1>
        {descricao && <p className="text-ink-2 text-[13.5px] mt-1.5 max-w-[68ch]">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  )
}

export function Vazio({ titulo, children, icone }: { titulo: string; children?: ReactNode; icone?: ReactNode }) {
  return (
    <div className="rounded-[8px] border border-dashed border-rule-strong px-6 py-14 text-center">
      <div className="inline-flex flex-col items-center">
        {icone && <div className="text-ink-3 mb-3">{icone}</div>}
        <p className="text-[15px] font-medium">{titulo}</p>
        {children && <div className="text-sm text-ink-2 mt-1.5 max-w-[46ch]">{children}</div>}
      </div>
    </div>
  )
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ink-3 py-10 justify-center" role="status">
      <Loader2 className="size-4 animate-spin" /> {texto}
    </div>
  )
}

export function Falha({ erro, tentar }: { erro: unknown; tentar?: () => void }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-[8px] bg-err-soft text-err border border-err/25" role="alert">
      <AlertTriangle className="size-4 mt-0.5 shrink-0" />
      <div className="text-sm flex-1">
        <p className="font-medium">Não foi possível carregar.</p>
        <p className="opacity-85">{erro instanceof Error ? erro.message : String(erro)}</p>
      </div>
      {tentar && (
        <Botao tamanho="sm" variante="perigo" onClick={tentar}>
          Tentar de novo
        </Botao>
      )}
    </div>
  )
}

export function Caixa({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className="size-4 accent-[var(--stamp)] cursor-pointer align-middle"
    />
  )
}

// ---------------------------------------------------------------- modal

export function Modal({ aberto, aoFechar, titulo, children, rodape }: { aberto: boolean; aoFechar: () => void; titulo: string; children: ReactNode; rodape?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])
  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      onClick={(e) => e.target === ref.current && aoFechar()}
      className="m-auto w-[min(520px,calc(100vw-32px))] rounded-[12px] bg-sheet text-ink border border-rule-strong p-0 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-center justify-between px-5 h-12 border-b border-rule">
        <h2 className="text-[15px] font-semibold">{titulo}</h2>
        <button onClick={aoFechar} className="p-1.5 rounded hover:bg-sunk text-ink-3" aria-label="Fechar">
          <X className="size-4" />
        </button>
      </div>
      <div className="p-5">{children}</div>
      {rodape && <div className="flex justify-end gap-2 px-5 py-4 border-t border-rule bg-paper/50">{rodape}</div>}
    </dialog>
  )
}

// ---------------------------------------------------------------- avisos

type TipoAviso = 'ok' | 'erro' | 'info'
interface Aviso {
  id: number
  tipo: TipoAviso
  texto: string
}

const AvisoCtx = createContext<(texto: string, tipo?: TipoAviso) => void>(() => {})

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const avisar = useCallback((texto: string, tipo: TipoAviso = 'ok') => {
    const id = Date.now() + Math.random()
    setAvisos((a) => [...a.slice(-3), { id, tipo, texto }])
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'erro' ? 7000 : 3800)
  }, [])
  return (
    <AvisoCtx.Provider value={avisar}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2 items-end pointer-events-none" aria-live="polite">
        {avisos.map((a) => (
          <div
            key={a.id}
            className="pointer-events-auto flex items-start gap-2.5 max-w-sm w-full sm:w-auto bg-sheet text-ink border border-rule-strong text-[13px] pl-3 pr-4 py-2.5 rounded-[8px] shadow-xl"
          >
            {a.tipo === 'ok' && <Check className="size-4 mt-0.5 text-ok shrink-0" />}
            {a.tipo === 'erro' && <AlertTriangle className="size-4 mt-0.5 text-err shrink-0" />}
            {a.tipo === 'info' && <Info className="size-4 mt-0.5 shrink-0 opacity-70" />}
            <span>{a.texto}</span>
          </div>
        ))}
      </div>
    </AvisoCtx.Provider>
  )
}

export const useAvisos = () => useContext(AvisoCtx)

/** Mensagem de erro amigável a partir de qualquer exceção. */
export function mensagemDe(e: unknown) {
  return e instanceof Error ? e.message : 'Algo deu errado'
}
