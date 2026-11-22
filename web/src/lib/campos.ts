// Conversão entre os valores extraídos (JSON livre da IA) e o texto editado na tela.
// A comparação é feita sobre o valor convertido, então "1.234,50" e 1234.5 contam como iguais.

import type { Dados } from './api'
import { tipoDoCampo } from './format'

const numeroBR = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function paraTexto(chave: string, valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  const tipo = tipoDoCampo(chave, valor)
  if (tipo === 'estrutura') return JSON.stringify(valor, null, 2)
  if (tipo === 'moeda' && typeof valor === 'number') return numeroBR.format(valor)
  return String(valor)
}

export function lerNumero(txt: string): number | null {
  let s = txt.replace(/[R$\s]/g, '')
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Converte o texto da tela de volta para o tipo do valor original. Lança erro se não der. */
export function deTexto(chave: string, txt: string, original: unknown): unknown {
  const t = txt.trim()
  if (t === '') return null
  if (original !== null && typeof original === 'object') {
    try {
      return JSON.parse(t)
    } catch {
      throw new Error(`"${chave}" não é um JSON válido`)
    }
  }
  if (typeof original === 'number') {
    const n = lerNumero(t)
    if (n === null) throw new Error(`"${chave}" precisa ser um número`)
    return n
  }
  if (typeof original === 'boolean') return /^(s|sim|true|1)$/i.test(t)
  // Original vazio/null: tenta adivinhar números monetários pelo nome do campo
  if ((original === null || original === undefined) && tipoDoCampo(chave, 0) === 'moeda') {
    const n = lerNumero(t)
    if (n !== null) return n
  }
  return t
}

export function iguais(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/** Monta o objeto final a partir dos textos editados; devolve também o que mudou. */
export function montarDados(originais: Dados, textos: Record<string, string>) {
  const final: Dados = {}
  const alterados: string[] = []
  for (const [k, txt] of Object.entries(textos)) {
    const v = deTexto(k, txt, originais[k])
    final[k] = v
    if (!(k in originais) || !iguais(v, originais[k])) alterados.push(k)
  }
  for (const k of Object.keys(originais)) if (!(k in textos)) alterados.push(k) // campo removido
  return { final, alterados }
}

export function textosIniciais(dados: Dados) {
  return Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, paraTexto(k, v)]))
}

/** "Número da nota" -> "numero_da_nota" (padrão das chaves extraídas pela IA). */
export function chaveDe(rotulo: string) {
  return rotulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}
