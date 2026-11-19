// Estado da aplicação e conversão dos dados da API para um formato simples de usar nas telas.
import { api } from './api.js';
import { PERMISSIONS } from './config.js';

export const state = {
  user: null,
  docs: [],
  canais: [],
  tipos: [],
};

const one = (v) => (Array.isArray(v) ? v[0] : v) || null;
const byDateDesc = (field) => (a, b) => new Date(b[field]) - new Date(a[field]);

// Documento "cru" da API -> documento simples
export function normalize(raw) {
  const detalhado = Array.isArray(raw.processamentos);
  const procs = detalhado ? [...raw.processamentos].sort(byDateDesc('iniciado_em')) : [];
  const procComDados = procs.find((p) => one(p.dados_extraidos));
  const ext = procComDados ? one(procComDados.dados_extraidos) : null;
  const validacao = ext?.validacoes?.length ? [...ext.validacoes].sort(byDateDesc('validado_em'))[0] : null;

  return {
    id: raw.id,
    nome: raw.nome_arquivo,
    mime: raw.mime_type,
    tamanho: raw.tamanho_bytes,
    status: raw.status,
    canal: one(raw.canais)?.nome || '',
    canalId: raw.canal_id,
    tipo: one(raw.tipos_documento)?.nome || '',
    tipoId: raw.tipo_documento_id,
    enviadoPor: one(raw.enviado)?.nome || '',
    enviadoEm: raw.data_envio,
    detalhado,
    erro: procs[0]?.status === 'erro' ? procs[0].erro : '',
    extraidoId: ext?.id || null,
    dados: ext?.dados || null,
    confianca: ext?.confianca ?? null,
    validacao,
    validadoEm: validacao?.validado_em || null,
    observacao: validacao?.observacao || '',
  };
}

// Dados que valem para a planilha: a correção do validador, se houver; senão o que a IA extraiu.
export function dadosFinais(doc) {
  if (doc.validacao?.status === 'corrigido' && doc.validacao.dados_corrigidos) return doc.validacao.dados_corrigidos;
  return doc.dados || {};
}

export function can(action) {
  return !!state.user && (PERMISSIONS[action] || []).includes(state.user.perfil);
}

export function countByStatus() {
  const c = { total: state.docs.length, recebido: 0, processando: 0, extraido: 0, validado: 0, rejeitado: 0, erro: 0 };
  for (const d of state.docs) c[d.status] = (c[d.status] || 0) + 1;
  return c;
}

// ---------- carregamento ----------
async function fetchAllDocs() {
  const docs = [];
  for (let page = 1; page <= 5; page++) {
    const res = await api.get(`/documentos?limit=100&page=${page}&detalhes=1`);
    docs.push(...res.dados);
    if (docs.length >= res.paginacao.total || res.dados.length === 0) break;
  }
  return docs.map(normalize);
}

// Se a API não trouxe os detalhes na lista, busca um a um (só dos que já têm leitura).
async function completeDetails(docs) {
  const missing = docs.filter((d) => !d.detalhado && ['extraido', 'validado', 'rejeitado'].includes(d.status));
  for (let i = 0; i < missing.length; i += 5) {
    await Promise.all(
      missing.slice(i, i + 5).map(async (doc) => {
        const full = normalize(await api.get(`/documentos/${doc.id}`));
        Object.assign(doc, full);
      })
    );
  }
}

export async function loadAll() {
  const [docs, canais, tipos] = await Promise.all([
    fetchAllDocs(),
    api.get('/canais?ativo=true'),
    api.get('/tipos-documento?ativo=true'),
  ]);
  await completeDetails(docs);
  state.docs = docs;
  state.canais = canais.dados;
  state.tipos = tipos.dados;
}

export async function loadUser() {
  state.user = await api.get('/me');
  return state.user;
}

export function docById(id) {
  return state.docs.find((d) => d.id === id) || null;
}
