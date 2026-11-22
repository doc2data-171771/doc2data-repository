import type { StatusDocumento } from './api'

export type Tom = 'neutro' | 'info' | 'warn' | 'ok' | 'err' | 'stamp'

export const STATUS: Record<StatusDocumento, { rotulo: string; tom: Tom; descricao: string }> = {
  recebido: { rotulo: 'Recebido', tom: 'neutro', descricao: 'Aguardando leitura pela IA' },
  processando: { rotulo: 'Lendo', tom: 'info', descricao: 'A IA está lendo o documento' },
  extraido: { rotulo: 'A conferir', tom: 'warn', descricao: 'Dados extraídos, aguardando conferência' },
  validado: { rotulo: 'Conferido', tom: 'ok', descricao: 'Aprovado por uma pessoa' },
  rejeitado: { rotulo: 'Rejeitado', tom: 'err', descricao: 'Recusado na conferência' },
  erro: { rotulo: 'Falhou', tom: 'err', descricao: 'A leitura falhou; pode ser refeita' },
}

/** Abaixo disso, a confiança da IA é tratada como "conferir com atenção". */
export const LIMIAR_CONFIANCA = 80

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

export const fmt = {
  moeda: (v: number) => moeda.format(v),
  numero: (v: number) => numero.format(v),
  dataHora: (iso: string) => dataHora.format(new Date(iso)),
  dataCurta: (iso: string) => dataCurta.format(new Date(iso)).replace('.', ''),
  bytes: (b: number) =>
    b < 1024 ? `${b} B` : b < 1024 ** 2 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 ** 2).toFixed(1)} MB`,
  relativo(iso: string) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000
    if (s < 60) return 'agora'
    if (s < 3600) return `há ${Math.floor(s / 60)} min`
    if (s < 86400) return `há ${Math.floor(s / 3600)} h`
    if (s < 86400 * 7) return `há ${Math.floor(s / 86400)} d`
    return dataCurta.format(new Date(iso)).replace('.', '')
  },
  iniciais: (nome: string) =>
    nome
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join(''),
}

// ---------------------------------------------------------------- campos extraídos

const SIGLAS: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  rg: 'RG',
  cnh: 'CNH',
  cep: 'CEP',
  uf: 'UF',
  nf: 'NF',
  nfe: 'NF-e',
  pix: 'PIX',
  iss: 'ISS',
  icms: 'ICMS',
  id: 'ID',
}

const ACENTOS: Record<string, string> = {
  emissao: 'emissão',
  numero: 'número',
  razao: 'razão',
  endereco: 'endereço',
  digitavel: 'digitável',
  codigo: 'código',
  descricao: 'descrição',
  orgao: 'órgão',
  expedicao: 'expedição',
  transacao: 'transação',
  servico: 'serviço',
  servicos: 'serviços',
  agencia: 'agência',
  periodo: 'período',
  inscricao: 'inscrição',
  municipio: 'município',
  credito: 'crédito',
  debito: 'débito',
  lancamentos: 'lançamentos',
  beneficiario: 'beneficiário',
  titulo: 'título',
  pagavel: 'pagável',
  referencia: 'referência',
  conteudo: 'conteúdo',
}

/** "valor_total" -> "Valor total"; "cnpj_emitente" -> "CNPJ emitente". */
export function rotuloCampo(chave: string) {
  const partes = chave.split(/[_\s.]+/).filter(Boolean)
  const txt = partes
    .map((p) => {
      const low = p.toLowerCase()
      return SIGLAS[low] ?? ACENTOS[low] ?? low
    })
    .join(' ')
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

export type TipoCampo = 'moeda' | 'data' | 'cpf' | 'cnpj' | 'numero' | 'texto' | 'estrutura'

export function tipoDoCampo(chave: string, valor: unknown): TipoCampo {
  if (valor !== null && typeof valor === 'object') return 'estrutura'
  const k = chave.toLowerCase()
  if (/cnpj/.test(k)) return 'cnpj'
  if (/cpf/.test(k)) return 'cpf'
  if (/(^|_)(data|vencimento|emissao|nascimento|validade)(_|$)/.test(k)) return 'data'
  if (/(valor|total|preco|saldo|montante|desconto|juros|multa|imposto|iss|icms)/.test(k) && typeof valor !== 'string')
    return 'moeda'
  if (typeof valor === 'number') return 'numero'
  return 'texto'
}

/** Valor legível para tabelas (não-editável). */
export function exibirValor(chave: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  const tipo = tipoDoCampo(chave, valor)
  if (tipo === 'moeda' && typeof valor === 'number') return fmt.moeda(valor)
  if (tipo === 'data' && typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor)) {
    const [a, m, d] = valor.slice(0, 10).split('-')
    return `${d}/${m}/${a}`
  }
  if (tipo === 'cnpj' && typeof valor === 'string') {
    const n = valor.replace(/\D/g, '')
    if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }
  if (tipo === 'cpf' && typeof valor === 'string') {
    const n = valor.replace(/\D/g, '')
    if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  if (tipo === 'estrutura') {
    if (Array.isArray(valor)) return `${valor.length} ${valor.length === 1 ? 'item' : 'itens'}`
    return `${Object.keys(valor as object).length} campos`
  }
  if (typeof valor === 'number') return fmt.numero(valor)
  return String(valor)
}

// ---------------------------------------------------------------- verificações locais

function cpfValido(v: string) {
  const n = v.replace(/\D/g, '')
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false
  const dv = (len: number) => {
    let s = 0
    for (let i = 0; i < len; i++) s += Number(n[i]) * (len + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(n[9]) && dv(10) === Number(n[10])
}

function cnpjValido(v: string) {
  const n = v.replace(/\D/g, '')
  if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false
  const dv = (len: number) => {
    const pesos = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const s = pesos.reduce((acc, p, i) => acc + Number(n[i]) * p, 0)
    const r = s % 11
    return r < 2 ? 0 : 11 - r
  }
  return dv(12) === Number(n[12]) && dv(13) === Number(n[13])
}

/**
 * Sinais por campo que a API ainda não fornece: o front confere dígitos de CPF/CNPJ,
 * datas e campos vazios para dizer à pessoa ONDE olhar primeiro.
 */
export function alertaDoCampo(chave: string, valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return 'A IA não conseguiu ler este campo'
  const tipo = tipoDoCampo(chave, valor)
  if (tipo === 'cpf' && typeof valor === 'string' && !cpfValido(valor)) return 'CPF com dígito verificador inválido'
  if (tipo === 'cnpj' && typeof valor === 'string' && !cnpjValido(valor)) return 'CNPJ com dígito verificador inválido'
  if (tipo === 'data' && typeof valor === 'string') {
    const d = new Date(valor)
    if (Number.isNaN(d.getTime())) return 'Data em formato inesperado'
    const ano = d.getFullYear()
    if (ano < 1900 || ano > new Date().getFullYear() + 15) return 'Data fora do intervalo esperado'
  }
  if (tipo === 'moeda' && typeof valor === 'number' && valor < 0) return 'Valor negativo'
  return null
}

/** Primeiro valor monetário plausível de um documento, para somatórios. */
export function valorPrincipal(dados: Record<string, unknown> | null | undefined): number | null {
  if (!dados) return null
  const preferidas = ['valor_total', 'valor', 'total', 'valor_documento', 'valor_pago', 'montante']
  for (const k of preferidas) {
    const v = dados[k]
    if (typeof v === 'number') return v
  }
  for (const [k, v] of Object.entries(dados)) {
    if (typeof v === 'number' && tipoDoCampo(k, v) === 'moeda') return v
  }
  return null
}

/** Rótulo curto de quem emitiu / a quem se refere o documento. */
export function partePrincipal(dados: Record<string, unknown> | null | undefined): string | null {
  if (!dados) return null
  const chaves = ['razao_social_emitente', 'emitente', 'beneficiario', 'razao_social', 'nome_completo', 'nome', 'pagador', 'banco']
  for (const k of chaves) {
    const v = dados[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return null
}
