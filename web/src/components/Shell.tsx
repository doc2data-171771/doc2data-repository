import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { FileStack, Inbox, LayoutGrid, LogOut, Moon, ScanLine, Sheet, Sparkles, Sun } from 'lucide-react'
import { MODO_DEMO } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useContagens } from '../lib/consultas'
import { fmt } from '../lib/format'
import { useProcessador } from '../lib/processador'
import { Logo } from './ui'

function useTema() {
  const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', escuro)
    try {
      localStorage.setItem('doc2data.tema', escuro ? 'escuro' : 'claro')
    } catch {
      /* ignora */
    }
  }, [escuro])
  return [escuro, setEscuro] as const
}

function ItemNav({ para, icone, children, contador, destaque }: { para: string; icone: ReactNode; children: ReactNode; contador?: number; destaque?: boolean }) {
  return (
    <NavLink
      to={para}
      end={para === '/'}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-2.5 h-8 lg:h-7 px-2 rounded-[6px] text-[13px] transition-colors shrink-0',
          isActive
            ? 'bg-sunk text-ink font-medium shadow-[inset_0_0_0_1px_var(--rule-strong)]'
            : 'text-ink-2 hover:text-ink hover:bg-sunk/60',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className={clsx('size-4 [&>svg]:size-4 transition-colors', isActive ? 'text-stamp' : 'text-ink-3')}>{icone}</span>
          <span className="flex-1">{children}</span>
          {!!contador && (
            <span className={clsx('font-mono text-[11px] tnum', destaque && 'px-1.5 rounded-full bg-stamp-soft text-stamp', !destaque && 'text-ink-3')}>
              {contador}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="contents lg:block">
      <p className="hidden lg:block px-2 mb-1 text-[11.5px] font-medium text-ink-3">{titulo}</p>
      <div className="contents lg:flex lg:flex-col lg:gap-px">{children}</div>
    </div>
  )
}

export function Shell() {
  const { usuario, sair } = useAuth()
  const [escuro, setEscuro] = useTema()
  const { data: contagens } = useContagens()
  const { ativos } = useProcessador()
  const aConferir = contagens?.porStatus.extraido ?? 0

  const nav = (
    <>
      <Secao titulo="Trabalho">
        <ItemNav para="/" icone={<LayoutGrid />}>Visão geral</ItemNav>
        <ItemNav para="/entrada" icone={<Inbox />}>Entrada</ItemNav>
        <ItemNav para="/documentos" icone={<FileStack />} contador={ativos || undefined}>
          Documentos
        </ItemNav>
        <ItemNav para="/conferencia" icone={<ScanLine />} contador={aConferir} destaque>
          Conferência
        </ItemNav>
      </Secao>
      <Secao titulo="Dados">
        <ItemNav para="/assistente" icone={<Sparkles />}>Assistente IA</ItemNav>
        <ItemNav para="/planilhas" icone={<Sheet />}>Planilhas</ItemNav>
      </Secao>
    </>
  )

  const botaoTema = (
    <button
      onClick={() => setEscuro(!escuro)}
      className="p-1.5 rounded-[6px] text-ink-3 hover:text-ink hover:bg-sunk"
      aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
    >
      {escuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
  const botaoSair = (
    <button onClick={sair} className="p-1.5 rounded-[6px] text-ink-3 hover:text-err hover:bg-sunk" aria-label="Sair" title="Sair">
      <LogOut className="size-4" />
    </button>
  )

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[224px_1fr] bg-paper">
      {/* Barra lateral (desktop) */}
      <aside className="hidden lg:flex flex-col sticky top-0 h-dvh px-3 py-3 gap-5">
        <div className="flex items-center px-2 h-8">
          <Logo />
        </div>
        <nav className="flex flex-col gap-5">{nav}</nav>

        <div className="mt-auto space-y-2">
          {MODO_DEMO && (
            <p className="px-2 py-1.5 rounded-[6px] bg-stamp-soft text-[11.5px] text-stamp leading-snug">
              Modo demonstração: dados fictícios, nada é salvo.
            </p>
          )}
          <div className="flex items-center gap-2 px-1.5 py-1.5">
            <div className="size-6 rounded-full bg-gradient-to-br from-stamp to-[#a855f7] text-white grid place-items-center text-[10px] font-semibold shrink-0">
              {usuario ? fmt.iniciais(usuario.nome) : '?'}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[12.5px] font-medium truncate">{usuario?.nome}</p>
              <p className="text-[11px] text-ink-3 truncate">{usuario?.email}</p>
            </div>
            {botaoTema}
            {botaoSair}
          </div>
        </div>
      </aside>

      {/* Barra superior (celular e tablet) */}
      <header className="lg:hidden sticky top-0 z-30 bg-paper/95 backdrop-blur border-b border-rule">
        <div className="flex items-center justify-between px-4 h-12">
          <Logo />
          <div className="flex items-center gap-1">
            {botaoTema}
            {botaoSair}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">{nav}</nav>
        {MODO_DEMO && <p className="px-4 pb-2 text-[11px] text-stamp">Modo demonstração · dados fictícios</p>}
      </header>

      {/* Conteúdo em um painel recuado, como no Linear */}
      <div className="min-w-0 lg:py-2 lg:pr-2">
        <main className="lg:min-h-[calc(100dvh-16px)] painel-luz lg:bg-sheet lg:border lg:border-rule lg:rounded-[12px] lg:shadow-[0_1px_3px_rgb(0_0_0/0.04)] px-4 sm:px-8 lg:px-10 py-6 lg:py-8">
          <div className="max-w-[1240px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
