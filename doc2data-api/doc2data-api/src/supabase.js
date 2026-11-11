// Conversa com o Supabase usando só o "fetch" do Node (sem instalar nada).
// São três serviços do Supabase:
//   - Auth    (/auth/v1)    -> login dos usuários
//   - Banco   (/rest/v1)    -> as tabelas (PostgREST)
//   - Storage (/storage/v1) -> os arquivos (PDFs, imagens, planilhas)

import { config } from './config.js';
import { HttpError } from './http.js';

// Chaves novas do Supabase (sb_secret_...) vão só no cabeçalho "apikey".
// Chaves antigas (JWT, começam com "eyJ") também precisam do "Authorization".
function cabecalhos(chave, extras = {}) {
  const cab = { apikey: chave, ...extras };
  if (chave.startsWith('eyJ')) cab.Authorization = `Bearer ${chave}`;
  return cab;
}

async function chamar(url, opcoes) {
  try {
    return await fetch(url, opcoes);
  } catch (erro) {
    console.error('Falha ao falar com o Supabase:', erro.message);
    throw new HttpError(502, 'Não consegui falar com o Supabase. Confira SUPABASE_URL e a internet.');
  }
}

// ---------------------------------------------------------------- Auth

export async function login(email, senha) {
  const r = await chamar(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: senha }),
  });
  if (!r.ok) throw new HttpError(401, 'E-mail ou senha inválidos.');
  return r.json();
}

export async function renovarSessao(refreshToken) {
  const r = await chamar(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!r.ok) throw new HttpError(401, 'Sessão expirada. Faça login novamente.');
  return r.json();
}

// Pergunta ao Supabase quem é o dono do token. Devolve null se o token for inválido.
export async function usuarioDoToken(token) {
  const r = await chamar(`${config.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
  });
  return r.ok ? r.json() : null;
}

// ---------------------------------------------------------------- Banco

// Atalhos para montar filtros: { status: eq('processado') }  ->  ?status=eq.processado
export const eq = (valor) => `eq.${valor}`;
export const em = (lista) => `in.(${lista.join(',')})`; // ids sempre validados antes!

function montarQuery({ filtros = {}, ordem, limite, offset } = {}) {
  const params = new URLSearchParams();
  for (const [coluna, condicao] of Object.entries(filtros)) params.append(coluna, condicao);
  if (ordem) params.set('order', ordem); // ex.: 'data_envio.desc'
  if (limite !== undefined) params.set('limit', String(limite));
  if (offset) params.set('offset', String(offset));
  return params.toString();
}

async function traduzirErroDoBanco(resposta, tabela) {
  const e = await resposta.json().catch(() => ({}));
  console.error(`Erro do banco (${tabela}):`, resposta.status, e.code, e.message);
  if (e.code === '23505') return new HttpError(409, 'Já existe um registro com esse valor.');
  if (e.code === '23503') return new HttpError(400, 'Algum id informado não existe.');
  if (e.code === '23514' || e.code === '23502') {
    return new HttpError(400, 'O banco recusou um valor por causa de uma regra da tabela (veja o log do servidor).');
  }
  if (e.code === '42P01' || e.code === 'PGRST205') {
    return new HttpError(500, `A tabela "${tabela}" não existe no Supabase. Peça para quem cuida do banco criá-la.`);
  }
  if (e.code === '42703' || e.code === 'PGRST204') {
    return new HttpError(500, `Alguma coluna da tabela "${tabela}" não existe no banco (veja o log do servidor).`);
  }
  if (resposta.status === 401 || resposta.status === 403) {
    return new HttpError(500, 'O Supabase recusou a SUPABASE_SERVICE_KEY. Confira se copiou a chave secreta certa.');
  }
  return new HttpError(500, 'Erro ao acessar o banco de dados.');
}

async function rest(tabela, { metodo = 'GET', query = '', corpo } = {}) {
  const url = `${config.supabaseUrl}/rest/v1/${tabela}${query ? `?${query}` : ''}`;
  const r = await chamar(url, {
    method: metodo,
    headers: cabecalhos(config.serviceKey, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (!r.ok) throw await traduzirErroDoBanco(r, tabela);
  return r.status === 204 ? [] : r.json();
}

export const db = {
  // Lista linhas. Ex.: db.listar('documentos', { filtros: { status: eq('processado') }, limite: 20 })
  listar: (tabela, opcoes) => rest(tabela, { query: montarQuery(opcoes) }),

  // Busca UMA linha (ou null se não achar).
  async buscar(tabela, filtros) {
    const linhas = await rest(tabela, { query: montarQuery({ filtros, limite: 1 }) });
    return linhas[0] ?? null;
  },

  // Insere uma linha (objeto) ou várias (array). Devolve sempre um array com o que foi gravado.
  inserir: (tabela, linhas) => rest(tabela, { metodo: 'POST', corpo: linhas }),

  // Atualiza as linhas que combinam com os filtros. Filtro é obrigatório (evita alterar a tabela toda).
  atualizar(tabela, filtros, campos) {
    if (!filtros || Object.keys(filtros).length === 0) {
      throw new Error('atualizar() exige pelo menos um filtro');
    }
    return rest(tabela, { metodo: 'PATCH', query: montarQuery({ filtros }), corpo: campos });
  },
};

// ---------------------------------------------------------------- Storage

const codificar = (caminho) => caminho.split('/').map(encodeURIComponent).join('/');
const urlObjeto = (bucket, caminho) =>
  `${config.supabaseUrl}/storage/v1/object/${bucket}/${codificar(caminho)}`;

async function erroDoStorage(resposta, bucket) {
  const texto = await resposta.text().catch(() => '');
  console.error(`Erro do Storage (${bucket}):`, resposta.status, texto);
  if (resposta.status === 404 && /bucket/i.test(texto)) {
    return new HttpError(500, `O bucket "${bucket}" não existe no Supabase Storage. Crie-o (privado).`);
  }
  return new HttpError(500, 'Erro ao acessar o armazenamento de arquivos.');
}

export const storage = {
  async enviar(bucket, caminho, buffer, mime) {
    const r = await chamar(urlObjeto(bucket, caminho), {
      method: 'POST',
      headers: cabecalhos(config.serviceKey, { 'Content-Type': mime, 'x-upsert': 'false' }),
      body: buffer,
    });
    if (!r.ok) throw await erroDoStorage(r, bucket);
  },

  async baixar(bucket, caminho) {
    const r = await chamar(urlObjeto(bucket, caminho), { headers: cabecalhos(config.serviceKey) });
    if (!r.ok) throw await erroDoStorage(r, bucket);
    return Buffer.from(await r.arrayBuffer());
  },

  async remover(bucket, caminho) {
    const r = await chamar(urlObjeto(bucket, caminho), {
      method: 'DELETE',
      headers: cabecalhos(config.serviceKey),
    });
    if (!r.ok) throw await erroDoStorage(r, bucket);
  },

  // Gera um link temporário para o front baixar/abrir o arquivo (os buckets são privados).
  async urlAssinada(bucket, caminho, segundos = 300, nomeParaDownload) {
    const r = await chamar(
      `${config.supabaseUrl}/storage/v1/object/sign/${bucket}/${codificar(caminho)}`,
      {
        method: 'POST',
        headers: cabecalhos(config.serviceKey, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({ expiresIn: segundos }),
      },
    );
    if (!r.ok) throw await erroDoStorage(r, bucket);
    const { signedURL } = await r.json();
    let url = `${config.supabaseUrl}/storage/v1${signedURL}`;
    if (nomeParaDownload) url += `&download=${encodeURIComponent(nomeParaDownload)}`;
    return url;
  },
};
