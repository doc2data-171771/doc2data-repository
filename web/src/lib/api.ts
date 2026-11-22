// Cliente da doc2data-api. Os tipos espelham as tabelas do Supabase
// (supabase/migrations) e as respostas das rotas em doc2data-api/src/routes.

export type Perfil = 'admin' | 'operador' | 'validador'
export type StatusDocumento = 'recebido' | 'processando' | 'extraido' | 'validado' | 'rejeitado' | 'erro'
export type StatusValidacao = 'aprovado' | 'corrigido' | 'rejeitado'
export type Formato = 'xlsx' | 'csv'
export type Dados = Record<string, unknown>

export interface Usuario {
  id: string
  email?: string
  nome: string
  perfil: Perfil
  ativo?: boolean
  created_at?: string
}

export interface Sessao {
  access_token: string
  refresh_token: string
  expires_at: number
  usuario: Usuario
}

export interface Catalogo {
  id: string
  nome: string
  descricao: string | null
  ativo: boolean
}

export interface Documento {
  id: string
  nome_arquivo: string
  caminho_arquivo: string
  mime_type: string
  tamanho_bytes: number
  status: StatusDocumento
  canal_id: string | null
  tipo_documento_id: string | null
  data_envio: string
  canais: { id: string; nome: string } | null
  tipos_documento: { id: string; nome: string } | null
  enviado: { id: string; nome: string } | null
}

export interface Validacao {
  id: string
  dados_extraidos_id: string
  status: StatusValidacao
  dados_corrigidos: Dados | null
  observacao: string | null
  validado_em: string
  validador?: { id: string; nome: string } | null
}

export interface DadosExtraidos {
  id: string
  processamento_id: string
  dados: Dados
  confianca: number | null
  created_at: string
  validacoes?: Validacao[]
}

export interface Processamento {
  id: string
  documento_id: string
  status: 'em_andamento' | 'concluido' | 'erro'
  ferramenta: string
  modelo: string | null
  iniciado_em: string
  finalizado_em: string | null
  erro: string | null
  dados_extraidos?: DadosExtraidos | DadosExtraidos[] | null
}

export interface DocumentoDetalhe extends Documento {
  processamentos: Processamento[]
  download_url: string | null
}

export interface Exportacao {
  id: string
  formato: Formato
  status: 'pendente' | 'gerado' | 'erro'
  created_at: string
  solicitante: { id: string; nome: string } | null
  exportacao_documentos: { count: number }[]
}

export interface Paginado<T> {
  dados: T[]
  paginacao: { page: number; limit: number; total: number }
}

export interface FiltroDocumentos {
  status?: StatusDocumento
  canal_id?: string
  tipo_documento_id?: string
  busca?: string
  page?: number
  limit?: number
}

export interface NovoArquivo {
  nome_arquivo: string
  mime_type: string
  tamanho_bytes: number
  canal_id?: string
  tipo_documento_id?: string
}

export interface UploadPreparado {
  documento: Documento
  upload: { caminho: string; token: string; signed_url: string }
}

export interface NovaValidacao {
  dados_extraidos_id: string
  status: StatusValidacao
  dados_corrigidos?: Dados
  observacao?: string
}

/** Contrato usado pelas telas. Implementado pela API real e pelo modo demonstração. */
export interface Backend {
  login(email: string, senha: string): Promise<Sessao>
  registrar(nome: string, email: string, senha: string): Promise<Sessao>
  me(): Promise<Usuario>
  listarDocumentos(f?: FiltroDocumentos): Promise<Paginado<Documento>>
  obterDocumento(id: string): Promise<DocumentoDetalhe>
  atualizarDocumento(id: string, dados: { tipo_documento_id?: string | null; canal_id?: string | null }): Promise<Documento>
  excluirDocumento(id: string): Promise<void>
  prepararUpload(arquivos: NovoArquivo[]): Promise<UploadPreparado[]>
  enviarArquivo(preparado: UploadPreparado, arquivo: File): Promise<void>
  processar(id: string): Promise<{ processamento: Processamento; dados_extraidos: DadosExtraidos }>
  validar(v: NovaValidacao): Promise<{ validacao: Validacao; documento: { id: string; status: StatusDocumento } }>
  exportar(formato: Formato, documentoIds: string[] | 'todos'): Promise<{ download_url: string }>
  listarExportacoes(page?: number): Promise<Paginado<Exportacao>>
  linkExportacao(id: string): Promise<string>
  listarCanais(): Promise<Catalogo[]>
  listarTipos(): Promise<Catalogo[]>
  /** Assistente: a IA analisa os dados extraídos dos documentos do usuário e responde à instrução. */
  perguntar(pergunta: string, documentoIds?: string[]): Promise<{ resposta: string; documentos_analisados: number }>
}

export class ApiError extends Error {
  status: number
  detalhes?: unknown
  constructor(status: number, message: string, detalhes?: unknown) {
    super(message)
    this.status = status
    this.detalhes = detalhes
  }
}

// ---------------------------------------------------------------- sessão

const CHAVE_SESSAO = 'doc2data.sessao'

export const sessaoStore = {
  ler(): Sessao | null {
    try {
      const raw = localStorage.getItem(CHAVE_SESSAO)
      return raw ? (JSON.parse(raw) as Sessao) : null
    } catch {
      return null
    }
  },
  salvar(s: Sessao) {
    try {
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s))
    } catch {
      /* navegação privada: a sessão vale só nesta aba */
    }
  },
  limpar() {
    try {
      localStorage.removeItem(CHAVE_SESSAO)
    } catch {
      /* ignora */
    }
  },
}

/** Chamado quando a sessão expira de vez; o AuthProvider registra o handler. */
let aoExpirar: () => void = () => {}
export function definirAoExpirar(fn: () => void) {
  aoExpirar = fn
}

// ---------------------------------------------------------------- API real

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

function qs(params: Record<string, unknown>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

let renovando: Promise<Sessao | null> | null = null

async function renovarSessao(): Promise<Sessao | null> {
  const atual = sessaoStore.ler()
  if (!atual?.refresh_token) return null
  renovando ??= fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: atual.refresh_token }),
  })
    .then(async (r) => {
      if (!r.ok) return null
      const nova = (await r.json()) as Sessao
      sessaoStore.salvar(nova)
      return nova
    })
    .catch(() => null)
    .finally(() => {
      renovando = null
    })
  return renovando
}

async function request<T>(caminho: string, init: RequestInit = {}, tentouRenovar = false): Promise<T> {
  const sessao = sessaoStore.ler()
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (sessao) headers.set('Authorization', `Bearer ${sessao.access_token}`)

  let resp: Response
  try {
    resp = await fetch(`${BASE}${caminho}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'Não foi possível falar com o servidor. Verifique sua conexão.')
  }

  if (resp.status === 401 && sessao && !tentouRenovar && !caminho.startsWith('/auth/')) {
    const nova = await renovarSessao()
    if (nova) return request<T>(caminho, init, true)
    sessaoStore.limpar()
    aoExpirar()
  }

  if (resp.status === 204) return undefined as T
  const corpo = await resp.json().catch(() => null)
  if (!resp.ok) {
    throw new ApiError(resp.status, corpo?.erro ?? `Erro ${resp.status}`, corpo?.detalhes)
  }
  return corpo as T
}

const json = (body: unknown) => JSON.stringify(body)

export const apiReal: Backend = {
  login: (email, senha) => request('/auth/login', { method: 'POST', body: json({ email, senha }) }),
  registrar: (nome, email, senha) => request('/auth/registro', { method: 'POST', body: json({ nome, email, senha }) }),
  me: () => request('/me'),

  listarDocumentos: (f = {}) => request(`/documentos${qs({ ...f })}`),
  obterDocumento: (id) => request(`/documentos/${id}`),
  atualizarDocumento: (id, dados) => request(`/documentos/${id}`, { method: 'PATCH', body: json(dados) }),
  excluirDocumento: (id) => request(`/documentos/${id}`, { method: 'DELETE' }),

  prepararUpload: async (arquivos) => {
    const r = await request<{ arquivos: UploadPreparado[] }>('/documentos/upload-url', {
      method: 'POST',
      body: json({ arquivos }),
    })
    return r.arquivos
  },
  enviarArquivo: async (preparado, arquivo) => {
    // Envio direto ao Storage do Supabase pela URL assinada (o arquivo não passa pela API).
    let r: Response
    try {
      r = await fetch(preparado.upload.signed_url, {
        method: 'PUT',
        headers: { 'Content-Type': arquivo.type, 'x-upsert': 'false' },
        body: arquivo,
      })
    } catch {
      throw new ApiError(0, `Falha de rede ao enviar "${arquivo.name}"`)
    }
    if (!r.ok) throw new ApiError(r.status, `O armazenamento recusou "${arquivo.name}" (${r.status})`)
  },
  processar: (id) => request(`/documentos/${id}/processar`, { method: 'POST' }),

  validar: (v) => request('/validacoes', { method: 'POST', body: json(v) }),

  exportar: (formato, ids) =>
    request('/exportacoes', {
      method: 'POST',
      body: json(ids === 'todos' ? { formato, todos_validados: true } : { formato, documento_ids: ids }),
    }),
  listarExportacoes: (page = 1) => request(`/exportacoes${qs({ page, limit: 20 })}`),
  linkExportacao: async (id) => (await request<{ download_url: string }>(`/exportacoes/${id}/download`)).download_url,

  listarCanais: async () => (await request<{ dados: Catalogo[] }>('/canais')).dados,
  listarTipos: async () => (await request<{ dados: Catalogo[] }>('/tipos-documento')).dados,

  perguntar: (pergunta, documentoIds) =>
    request('/assistente', { method: 'POST', body: json({ pergunta, documento_ids: documentoIds?.length ? documentoIds : undefined }) }),
}

// ---------------------------------------------------------------- seleção

export const MODO_DEMO = import.meta.env.VITE_MOCK === 'true'

let backend: Backend = apiReal
export function usarBackend(b: Backend) {
  backend = b
}

/** Proxy para que as telas sempre usem o backend ativo (real ou demonstração). */
export const api: Backend = new Proxy({} as Backend, {
  get: (_t, prop: keyof Backend) => backend[prop],
})

// ---------------------------------------------------------------- utilidades de dados

/** Normaliza relações 1-1 que o Supabase às vezes devolve como array. */
export function um<T>(x: T | T[] | null | undefined): T | null {
  if (Array.isArray(x)) return x[0] ?? null
  return x ?? null
}

/** Extração mais recente de um documento e sua última validação. */
export function extracaoAtual(doc: DocumentoDetalhe) {
  const proc = doc.processamentos.find((p) => p.status === 'concluido' && um(p.dados_extraidos))
  const extraido = proc ? um(proc.dados_extraidos) : null
  const validacoes = [...(extraido?.validacoes ?? [])].sort((a, b) => b.validado_em.localeCompare(a.validado_em))
  const ultimaValidacao = validacoes[0] ?? null
  const dadosFinais =
    ultimaValidacao?.status === 'corrigido' && ultimaValidacao.dados_corrigidos
      ? ultimaValidacao.dados_corrigidos
      : (extraido?.dados ?? null)
  const ultimoErro = doc.processamentos.find((p) => p.status === 'erro')?.erro ?? null
  return { proc, extraido, ultimaValidacao, dadosFinais, ultimoErro }
}

export const ARQUIVOS_ACEITOS = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
export const TAMANHO_MAXIMO = 20 * 1024 * 1024
