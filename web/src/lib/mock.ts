// Modo demonstração (VITE_MOCK=true): backend em memória com dados fictícios.
// Serve para apresentar o fluxo e desenvolver o front sem API nem Supabase.
// Nenhum dado aqui é real: nomes, CNPJs e valores são inventados.

import {
  ApiError,
  extracaoAtual,
  type Backend,
  type Catalogo,
  type Dados,
  type DadosExtraidos,
  type Documento,
  type DocumentoDetalhe,
  type Exportacao,
  type Processamento,
  type Usuario,
  type Validacao,
} from './api'

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))
const uid = () => crypto.randomUUID()
const agora = () => new Date().toISOString()
const atras = (min: number) => new Date(Date.now() - min * 60_000).toISOString()

const canais: Catalogo[] = [
  { id: uid(), nome: 'upload_web', descricao: 'Envio manual pelo site', ativo: true },
  { id: uid(), nome: 'email', descricao: 'Recebido por e-mail', ativo: true },
  { id: uid(), nome: 'whatsapp', descricao: 'Recebido por WhatsApp', ativo: true },
]

const tipos: Catalogo[] = [
  { id: uid(), nome: 'Nota fiscal', descricao: 'NF-e e NFS-e', ativo: true },
  { id: uid(), nome: 'Boleto', descricao: 'Boleto bancário', ativo: true },
  { id: uid(), nome: 'Comprovante de pagamento', descricao: 'PIX, TED e similares', ativo: true },
  { id: uid(), nome: 'Documento de identificação', descricao: 'RG, CNH ou similar', ativo: true },
  { id: uid(), nome: 'Comprovante de residência', descricao: 'Conta de consumo ou similar', ativo: true },
  { id: uid(), nome: 'Outro', descricao: 'Tipo não classificado', ativo: true },
]

const usuarios: Usuario[] = [
  { id: uid(), nome: 'Marina Duarte', email: 'marina@exemplo.com', perfil: 'admin', ativo: true, created_at: atras(90000) },
  { id: uid(), nome: 'Caio Prado', email: 'caio@exemplo.com', perfil: 'operador', ativo: true, created_at: atras(60000) },
  { id: uid(), nome: 'Lia Moraes', email: 'lia@exemplo.com', perfil: 'validador', ativo: true, created_at: atras(30000) },
]

// ---------------------------------------------------------------- dados sintéticos por tipo

function extracaoFicticia(nome: string): { tipo: string; dados: Dados; confianca: number } {
  const n = nome.toLowerCase()
  const r = (a: number, b: number) => Math.round((a + Math.random() * (b - a)) * 100) / 100
  if (/boleto/.test(n))
    return {
      tipo: 'Boleto',
      confianca: r(70, 92),
      dados: {
        beneficiario: 'Águas do Vale Saneamento S.A.',
        cnpj_beneficiario: '11.444.777/0001-61',
        pagador: 'Ricardo Almeida Souza',
        linha_digitavel: '34191.79001 01043.510047 91020.150008 8 97650000041890',
        data_vencimento: '2026-12-05',
        valor: r(120, 900),
      },
    }
  if (/comprov|pix|ted/.test(n))
    return {
      tipo: 'Comprovante de pagamento',
      confianca: r(85, 98),
      dados: {
        pagador: 'Bruna Ferraz Lima',
        cpf_pagador: '529.982.247-25',
        recebedor: 'Ateliê Ferraz ME',
        data_pagamento: '2026-11-17',
        valor: r(80, 5000),
        id_transacao: 'E18236120202611171532s0412AB9',
      },
    }
  if (/\b(rg|cnh)\b|ident/.test(n))
    return {
      tipo: 'Documento de identificação',
      confianca: r(62, 88),
      dados: {
        nome_completo: 'Joana Ribeiro Castro',
        cpf: '123.456.789-00',
        rg: '28.441.903-7',
        orgao_expedidor: 'SSP/SP',
        data_nascimento: '1987-03-14',
      },
    }
  if (/resid|conta|luz|energia/.test(n))
    return {
      tipo: 'Comprovante de residência',
      confianca: r(80, 95),
      dados: {
        nome: 'Paulo Henrique Matos',
        endereco: 'Rua das Acácias, 214, ap. 31',
        cidade: 'Campinas',
        uf: 'SP',
        cep: '13024-110',
        data_emissao: '2026-10-28',
        valor_total: r(90, 400),
      },
    }
  return {
    tipo: 'Nota fiscal',
    confianca: r(74, 97),
    dados: {
      numero_nf: String(Math.floor(r(1000, 9999))),
      razao_social_emitente: 'Mendes & Tavares Consultoria Ltda.',
      cnpj_emitente: '11.222.333/0001-81',
      tomador: 'Otpro Capital',
      data_emissao: '2026-11-12',
      valor_servicos: r(1500, 12000),
      iss: r(30, 600),
      valor_total: r(1500, 12000),
      descricao_servico: 'Assessoria financeira — novembro/2026',
    },
  }
}

/** Imagem SVG simples que representa o papel, para a tela de conferência. */
function papelSvg(titulo: string, dados: Dados | null): string {
  const linhas = Object.entries(dados ?? {})
    .slice(0, 9)
    .map(([k, v], i) => {
      const y = 150 + i * 46
      const val = String(v ?? '').slice(0, 38).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      return `<text x="48" y="${y}" font-size="13" fill="#888" font-family="monospace">${k.toUpperCase()}</text>
<text x="48" y="${y + 20}" font-size="17" fill="#222" font-family="Georgia">${val}</text>`
    })
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="620" height="820" viewBox="0 0 620 820">
<rect width="620" height="820" fill="#fffdf8"/>
<rect x="24" y="24" width="572" height="772" fill="none" stroke="#ddd" />
<text x="48" y="84" font-size="26" fill="#222" font-family="Georgia">${titulo}</text>
<line x1="48" y1="106" x2="572" y2="106" stroke="#222" stroke-width="2"/>
${linhas}
<text x="48" y="770" font-size="11" fill="#aaa" font-family="monospace">DOCUMENTO FICTÍCIO · MODO DEMONSTRAÇÃO</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// ---------------------------------------------------------------- estado

interface Registro {
  doc: Documento
  processamentos: Processamento[]
  preview: string | null
}

const registros: Registro[] = []
const exportacoes: Exportacao[] = []

function novoDoc(nome: string, mime: string, tamanho: number, canalNome: string, minutosAtras: number): Registro {
  const canal = canais.find((c) => c.nome === canalNome) ?? canais[0]!
  const id = uid()
  return {
    doc: {
      id,
      nome_arquivo: nome,
      caminho_arquivo: `${id}/${nome}`,
      mime_type: mime,
      tamanho_bytes: tamanho,
      status: 'recebido',
      canal_id: canal.id,
      tipo_documento_id: null,
      data_envio: atras(minutosAtras),
      canais: { id: canal.id, nome: canal.nome },
      tipos_documento: null,
      enviado: { id: usuarios[1]!.id, nome: usuarios[1]!.nome },
    },
    processamentos: [],
    preview: null,
  }
}

function aplicarExtracao(reg: Registro, quando: string) {
  const ext = extracaoFicticia(reg.doc.nome_arquivo)
  const tipo = tipos.find((t) => t.nome === ext.tipo)!
  reg.doc.tipo_documento_id ??= tipo.id
  reg.doc.tipos_documento ??= { id: tipo.id, nome: tipo.nome }
  const procId = uid()
  const extraido: DadosExtraidos = {
    id: uid(),
    processamento_id: procId,
    dados: ext.dados,
    confianca: ext.confianca,
    created_at: quando,
    validacoes: [],
  }
  reg.processamentos.unshift({
    id: procId,
    documento_id: reg.doc.id,
    status: 'concluido',
    ferramenta: 'gemini',
    modelo: 'gemini-4-hydrogen',
    iniciado_em: quando,
    finalizado_em: quando,
    erro: null,
    dados_extraidos: extraido,
  })
  if (!reg.preview || reg.preview.startsWith('data:image/svg')) reg.preview = papelSvg(tipo.nome, ext.dados)
  reg.doc.status = 'extraido'
  return extraido
}

function semear() {
  const base: [string, string, number, string, number][] = [
    ['nf-mendes-tavares-2291.pdf', 'application/pdf', 182_000, 'email', 12],
    ['boleto-agua-novembro.pdf', 'application/pdf', 96_000, 'whatsapp', 26],
    ['comprovante-pix-bruna.jpg', 'image/jpeg', 420_000, 'whatsapp', 41],
    ['cnh-joana-frente.jpg', 'image/jpeg', 1_200_000, 'whatsapp', 63],
    ['conta-energia-paulo.pdf', 'application/pdf', 310_000, 'email', 95],
    ['nf-servicos-outubro.pdf', 'application/pdf', 205_000, 'upload_web', 180],
    ['comprovante-ted-fornecedor.png', 'image/png', 260_000, 'email', 240],
    ['scan-ilegivel-0034.jpg', 'image/jpeg', 88_000, 'whatsapp', 300],
    ['boleto-condominio.pdf', 'application/pdf', 120_000, 'upload_web', 600],
  ]
  for (const [nome, mime, tam, canal, min] of base) registros.push(novoDoc(nome, mime, tam, canal, min))

  // Alguns já lidos, um conferido, um rejeitado, um com erro
  registros.slice(0, 7).forEach((r) => aplicarExtracao(r, r.doc.data_envio))
  const conferido = registros[5]!
  const ext = conferido.processamentos[0]!.dados_extraidos as DadosExtraidos
  ext.validacoes!.push({
    id: uid(),
    dados_extraidos_id: ext.id,
    status: 'aprovado',
    dados_corrigidos: null,
    observacao: null,
    validado_em: atras(150),
    validador: { id: usuarios[2]!.id, nome: usuarios[2]!.nome },
  })
  conferido.doc.status = 'validado'

  const falho = registros[7]!
  falho.processamentos.unshift({
    id: uid(),
    documento_id: falho.doc.id,
    status: 'erro',
    ferramenta: 'gemini',
    modelo: 'gemini-4-hydrogen',
    iniciado_em: atras(299),
    finalizado_em: atras(299),
    erro: 'Imagem com resolução insuficiente para leitura',
    dados_extraidos: null,
  })
  falho.doc.status = 'erro'
}
semear()

// ---------------------------------------------------------------- backend

function achar(id: string) {
  const r = registros.find((x) => x.doc.id === id)
  if (!r) throw new ApiError(404, 'Documento não encontrado')
  return r
}

let usuarioAtual: Usuario = usuarios[0]!

export function criarMock(): Backend {
  return {
    async login(email) {
      await espera(500)
      usuarioAtual = usuarios.find((u) => u.email === email.toLowerCase()) ?? { ...usuarios[0]!, email }
      return {
        access_token: 'demo',
        refresh_token: 'demo',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        usuario: usuarioAtual,
      }
    },
    async me() {
      return usuarioAtual
    },

    async listarDocumentos(f = {}) {
      await espera(180)
      let lista = registros.map((r) => r.doc)
      if (f.status) lista = lista.filter((d) => d.status === f.status)
      if (f.canal_id) lista = lista.filter((d) => d.canal_id === f.canal_id)
      if (f.tipo_documento_id) lista = lista.filter((d) => d.tipo_documento_id === f.tipo_documento_id)
      if (f.busca) lista = lista.filter((d) => d.nome_arquivo.toLowerCase().includes(f.busca!.toLowerCase()))
      lista = [...lista].sort((a, b) => b.data_envio.localeCompare(a.data_envio))
      const page = f.page ?? 1
      const limit = f.limit ?? 20
      return {
        dados: lista.slice((page - 1) * limit, page * limit).map((d) => ({ ...d })),
        paginacao: { page, limit, total: lista.length },
      }
    },

    async obterDocumento(id) {
      await espera(150)
      const r = achar(id)
      return structuredClone({ ...r.doc, processamentos: r.processamentos, download_url: r.preview }) as DocumentoDetalhe
    },

    async atualizarDocumento(id, dados) {
      const r = achar(id)
      if (dados.tipo_documento_id !== undefined) {
        const t = tipos.find((x) => x.id === dados.tipo_documento_id) ?? null
        r.doc.tipo_documento_id = t?.id ?? null
        r.doc.tipos_documento = t ? { id: t.id, nome: t.nome } : null
      }
      if (dados.canal_id !== undefined) {
        const c = canais.find((x) => x.id === dados.canal_id) ?? null
        r.doc.canal_id = c?.id ?? null
        r.doc.canais = c ? { id: c.id, nome: c.nome } : null
      }
      return { ...r.doc }
    },

    async excluirDocumento(id) {
      const i = registros.findIndex((x) => x.doc.id === id)
      if (i >= 0) registros.splice(i, 1)
    },

    async prepararUpload(arquivos) {
      await espera(250)
      return arquivos.map((a) => {
        const canal = canais.find((c) => c.id === a.canal_id)
        const reg = novoDoc(a.nome_arquivo, a.mime_type, a.tamanho_bytes, canal?.nome ?? 'upload_web', 0)
        reg.doc.enviado = { id: usuarioAtual.id, nome: usuarioAtual.nome }
        if (a.tipo_documento_id) {
          const t = tipos.find((x) => x.id === a.tipo_documento_id)
          if (t) {
            reg.doc.tipo_documento_id = t.id
            reg.doc.tipos_documento = { id: t.id, nome: t.nome }
          }
        }
        registros.push(reg)
        return { documento: { ...reg.doc }, upload: { caminho: reg.doc.caminho_arquivo, token: 'demo', signed_url: 'demo' } }
      })
    },

    async enviarArquivo(preparado, arquivo) {
      await espera(300 + Math.random() * 600)
      achar(preparado.documento.id).preview = URL.createObjectURL(arquivo)
    },

    async processar(id) {
      const r = achar(id)
      if (r.doc.status === 'processando') throw new ApiError(409, 'Este documento já está sendo processado')
      r.doc.status = 'processando'
      await espera(1400 + Math.random() * 2200)
      if (/ilegivel/.test(r.doc.nome_arquivo)) {
        const proc: Processamento = {
          id: uid(),
          documento_id: id,
          status: 'erro',
          ferramenta: 'gemini',
          modelo: 'gemini-4-hydrogen',
          iniciado_em: agora(),
          finalizado_em: agora(),
          erro: 'Imagem com resolução insuficiente para leitura',
          dados_extraidos: null,
        }
        r.processamentos.unshift(proc)
        r.doc.status = 'erro'
        throw new ApiError(502, 'Falha ao extrair os dados do documento')
      }
      const ext = aplicarExtracao(r, agora())
      return { processamento: r.processamentos[0]!, dados_extraidos: ext }
    },

    async validar(v) {
      await espera(250)
      for (const r of registros) {
        for (const p of r.processamentos) {
          const ext = p.dados_extraidos as DadosExtraidos | null
          if (ext?.id === v.dados_extraidos_id) {
            const val: Validacao = {
              id: uid(),
              dados_extraidos_id: ext.id,
              status: v.status,
              dados_corrigidos: v.status === 'corrigido' ? (v.dados_corrigidos ?? null) : null,
              observacao: v.observacao ?? null,
              validado_em: agora(),
              validador: { id: usuarioAtual.id, nome: usuarioAtual.nome },
            }
            ext.validacoes = [...(ext.validacoes ?? []), val]
            r.doc.status = v.status === 'rejeitado' ? 'rejeitado' : 'validado'
            return { validacao: val, documento: { id: r.doc.id, status: r.doc.status } }
          }
        }
      }
      throw new ApiError(404, 'Dados extraídos não encontrados')
    },

    async exportar(formato, ids) {
      await espera(700)
      const alvo = ids === 'todos' ? registros.filter((r) => r.doc.status === 'validado').map((r) => r.doc.id) : ids
      if (!alvo.length) throw new ApiError(404, 'Não há documentos validados para exportar')
      // Gera um CSV de verdade com os dados, para a demonstração baixar algo útil.
      const linhas = alvo.map((id) => {
        const r = achar(id)
        const ext = r.processamentos[0]?.dados_extraidos as DadosExtraidos | undefined
        const val = ext?.validacoes?.at(-1)
        const dados = val?.status === 'corrigido' && val.dados_corrigidos ? val.dados_corrigidos : (ext?.dados ?? {})
        return { arquivo: r.doc.nome_arquivo, tipo_documento: r.doc.tipos_documento?.nome ?? '', ...dados }
      })
      const cols = [...new Set(linhas.flatMap((l) => Object.keys(l)))]
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const csv = [cols.join(';'), ...linhas.map((l) => cols.map((c) => esc((l as Dados)[c])).join(';'))].join('\n')
      const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }))
      exportacoes.unshift({
        id: uid(),
        formato,
        status: 'gerado',
        created_at: agora(),
        solicitante: { id: usuarioAtual.id, nome: usuarioAtual.nome },
        exportacao_documentos: [{ count: alvo.length }],
      })
      ;(exportacoes[0] as Exportacao & { url?: string }).url = url
      return { download_url: url }
    },

    async listarExportacoes() {
      await espera(150)
      return { dados: exportacoes.map((e) => ({ ...e })), paginacao: { page: 1, limit: 20, total: exportacoes.length } }
    },
    async linkExportacao(id) {
      const e = exportacoes.find((x) => x.id === id) as (Exportacao & { url?: string }) | undefined
      if (!e?.url) throw new ApiError(404, 'Exportação não encontrada')
      return e.url
    },

    async listarCanais() {
      return canais.map((c) => ({ ...c }))
    },
    async listarTipos() {
      return tipos.map((t) => ({ ...t }))
    },
    async registrar(nome, email, senha) {
      await espera(500)
      if (senha.length < 8) throw new ApiError(400, 'A senha deve ter pelo menos 8 caracteres')
      if (usuarios.some((u) => u.email === email.toLowerCase())) throw new ApiError(400, 'Não foi possível criar a conta (e-mail já cadastrado ou inválido)')
      usuarioAtual = { id: uid(), nome, email: email.toLowerCase(), perfil: 'operador', ativo: true, created_at: agora() }
      usuarios.push(usuarioAtual)
      return { access_token: 'demo', refresh_token: 'demo', expires_at: Math.floor(Date.now() / 1000) + 3600, usuario: usuarioAtual }
    },

    async perguntar(pergunta, documentoIds) {
      await espera(900)
      const lidos = registros
        .filter((r) => ['extraido', 'validado', 'rejeitado'].includes(r.doc.status))
        .filter((r) => !documentoIds?.length || documentoIds.includes(r.doc.id))
        .map((r) => ({ doc: r.doc, dados: extracaoAtual({ ...r.doc, processamentos: r.processamentos, download_url: null }).dadosFinais }))
      if (!lidos.length) throw new ApiError(404, 'Você ainda não tem documentos lidos pela IA para analisar')
      // Resposta fictícia: resume os documentos e soma os campos de valor
      let total = 0
      const linhas = lidos.map(({ doc, dados }) => {
        const valor = Object.entries(dados ?? {}).find(([k, v]) => k.startsWith('valor') && typeof v === 'number')?.[1] as number | undefined
        if (valor) total += valor
        return `- ${doc.nome_arquivo} (${doc.tipos_documento?.nome ?? 'sem tipo'}): ${valor ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'sem valor'}`
      })
      return {
        resposta: [
          `Modo demonstração: esta resposta é fictícia. Com a API ligada, a IA responde de verdade a "${pergunta}".`,
          '',
          `Analisei ${lidos.length} documentos. Soma dos valores encontrados: ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
          '',
          ...linhas,
        ].join('\n'),
        documentos_analisados: lidos.length,
      }
    },
  }
}
