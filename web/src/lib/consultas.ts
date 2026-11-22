// Consultas compartilhadas (TanStack Query). As chaves usadas aqui são as mesmas
// invalidadas pelo processador e pelas ações de conferência.

import { useQuery } from '@tanstack/react-query'
import { api, type StatusDocumento } from './api'

const TODOS: StatusDocumento[] = ['recebido', 'processando', 'extraido', 'validado', 'rejeitado', 'erro']

export function useContagens() {
  return useQuery({
    queryKey: ['contagens'],
    queryFn: async () => {
      const totais = await Promise.all(TODOS.map((status) => api.listarDocumentos({ status, limit: 1 })))
      const porStatus = Object.fromEntries(TODOS.map((s, i) => [s, totais[i]!.paginacao.total])) as Record<StatusDocumento, number>
      const total = Object.values(porStatus).reduce((a, b) => a + b, 0)
      return { porStatus, total }
    },
    refetchInterval: 30_000,
  })
}

export function useCatalogos() {
  const canais = useQuery({ queryKey: ['canais'], queryFn: api.listarCanais, staleTime: 5 * 60_000 })
  const tipos = useQuery({ queryKey: ['tipos'], queryFn: api.listarTipos, staleTime: 5 * 60_000 })
  return { canais: canais.data ?? [], tipos: tipos.data ?? [] }
}

export const NOME_CANAL: Record<string, string> = {
  upload_web: 'Upload',
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  lote: 'Lote',
}
export const nomeCanal = (n?: string | null) => (n ? (NOME_CANAL[n] ?? n) : '—')
