// Fila de leitura por IA no navegador.
// A API processa um documento por chamada (até ~60 s na Vercel), então o front
// enfileira e roda poucas chamadas em paralelo. A fila sobrevive à troca de tela.

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from './api'

const PARALELO = 2

export type EstadoFila = 'na_fila' | 'lendo' | 'pronto' | 'falhou'

interface ProcCtx {
  estados: Record<string, { estado: EstadoFila; erro?: string }>
  enfileirar: (ids: string[]) => void
  ativos: number
}

const Ctx = createContext<ProcCtx | null>(null)

export function ProcessadorProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [estados, setEstados] = useState<ProcCtx['estados']>({})
  const fila = useRef<string[]>([])
  const rodando = useRef(0)

  const marcar = useCallback((id: string, estado: EstadoFila, erro?: string) => {
    setEstados((s) => ({ ...s, [id]: { estado, erro } }))
  }, [])

  const bombear = useCallback(() => {
    while (rodando.current < PARALELO && fila.current.length) {
      const id = fila.current.shift()!
      rodando.current++
      marcar(id, 'lendo')
      api
        .processar(id)
        .then(() => marcar(id, 'pronto'))
        .catch((e: unknown) => marcar(id, 'falhou', e instanceof ApiError ? e.message : 'Falha inesperada'))
        .finally(() => {
          rodando.current--
          qc.invalidateQueries({ queryKey: ['documentos'] })
          qc.invalidateQueries({ queryKey: ['documento', id] })
          qc.invalidateQueries({ queryKey: ['contagens'] })
          bombear()
        })
    }
  }, [marcar, qc])

  const enfileirar = useCallback(
    (ids: string[]) => {
      for (const id of ids) {
        if (fila.current.includes(id)) continue
        fila.current.push(id)
        marcar(id, 'na_fila')
      }
      bombear()
    },
    [bombear, marcar],
  )

  const ativos = Object.values(estados).filter((e) => e.estado === 'na_fila' || e.estado === 'lendo').length
  const valor = useMemo(() => ({ estados, enfileirar, ativos }), [estados, enfileirar, ativos])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useProcessador() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useProcessador fora do ProcessadorProvider')
  return c
}
