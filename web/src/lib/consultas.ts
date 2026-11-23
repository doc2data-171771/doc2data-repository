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
  // Esconde canais repetidos com o mesmo rótulo (ex.: "email" e "E-mail"), mantendo o primeiro ativo
  const vistos = new Set<string>()
  const unicos = [...(canais.data ?? [])]
    .sort((x, y) => Number(y.ativo) - Number(x.ativo))
    .filter((c) => {
      const rotulo = nomeCanal(c.nome)
      if (vistos.has(rotulo)) return false
      vistos.add(rotulo)
      return true
    })
  return { canais: unicos, tipos: tipos.data ?? [] }
}

export const NOME_CANAL: Record<string, string> = {
  upload_web: 'Upload',
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  lote: 'Lote',
}
const chaveCanal = (n: string) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const ROTULO_POR_CHAVE: Record<string, string> = Object.fromEntries(
  Object.entries(NOME_CANAL).map(([k, v]) => [chaveCanal(k), v])
)
export const nomeCanal = (n?: string | null) => (n ? (ROTULO_POR_CHAVE[chaveCanal(n)] ?? n) : '—')
