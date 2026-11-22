import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, definirAoExpirar, sessaoStore, type Usuario } from './api'

interface AuthCtx {
  usuario: Usuario | null
  entrar: (email: string, senha: string) => Promise<void>
  registrar: (nome: string, email: string, senha: string) => Promise<void>
  sair: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [usuario, setUsuario] = useState<Usuario | null>(() => sessaoStore.ler()?.usuario ?? null)

  const sair = useCallback(() => {
    sessaoStore.limpar()
    setUsuario(null)
    qc.clear()
  }, [qc])

  useEffect(() => {
    definirAoExpirar(() => setUsuario(null))
  }, [])

  const entrar = useCallback(async (email: string, senha: string) => {
    const sessao = await api.login(email, senha)
    sessaoStore.salvar(sessao)
    setUsuario(sessao.usuario)
  }, [])

  const registrar = useCallback(async (nome: string, email: string, senha: string) => {
    const sessao = await api.registrar(nome, email, senha)
    sessaoStore.salvar(sessao)
    setUsuario(sessao.usuario)
  }, [])

  const valor = useMemo(() => ({ usuario, entrar, registrar, sair }), [usuario, entrar, registrar, sair])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth fora do AuthProvider')
  return c
}
