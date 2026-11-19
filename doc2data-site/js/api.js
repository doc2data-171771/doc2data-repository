// Comunicação com a API: sessão (login), chamadas com token e upload para o Storage.
import { API_URL } from './config.js';

const KEY = 'doc2data.sessao';
let memory = null; // reserva, caso o navegador bloqueie o armazenamento

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// ---------- sessão ----------
export function getSession() {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignora */ }
  }
  return memory;
}

function saveSession(data, remember) {
  memory = data;
  clearStored();
  try {
    (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(data));
  } catch { /* fica só em memória */ }
}

function clearStored() {
  for (const store of [sessionStorage, localStorage]) {
    try { store.removeItem(KEY); } catch { /* ignora */ }
  }
}

export function clearSession() {
  memory = null;
  clearStored();
}

let onExpired = () => {};
export function setOnSessionExpired(fn) { onExpired = fn; }

// ---------- chamadas ----------
async function refreshSession() {
  const session = getSession();
  if (!session?.refresh_token) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    const remember = !!localStorage.getItem(KEY);
    saveSession(data, remember);
    return true;
  } catch {
    return false;
  }
}

async function request(method, path, { body, auth = true, retried = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getSession()?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Não foi possível conectar à API. Verifique a internet e tente de novo.');
  }

  if (res.status === 401 && auth && !retried) {
    if (await refreshSession()) return request(method, path, { body, auth, retried: true });
    clearSession();
    onExpired();
    throw new ApiError(401, 'Sua sessão expirou. Entre novamente.');
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.erro || `Erro ${res.status} na API`, data?.detalhes);
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body, options) => request('POST', path, { body, ...options }),
  patch: (path, body) => request('PATCH', path, { body }),
  del: (path) => request('DELETE', path),
};

export async function login(email, senha, remember) {
  const data = await api.post('/auth/login', { email, senha }, { auth: false });
  saveSession(data, remember);
  return data.usuario;
}

// Envia o arquivo direto ao Storage usando a URL assinada devolvida pela API
// (o arquivo não passa pela API: a Vercel limita o corpo das requisições a ~4,5 MB).
export async function uploadToSignedUrl(signedUrl, file) {
  const form = new FormData();
  form.append('cacheControl', '3600');
  form.append('', file);
  let res;
  try {
    res = await fetch(signedUrl, { method: 'PUT', body: form, headers: { 'x-upsert': 'false' } });
  } catch {
    throw new Error('falha de conexão no envio');
  }
  if (!res.ok) throw new Error(`o Storage recusou o arquivo (${res.status})`);
}

// Baixa o arquivo como Blob (usado na pré-visualização: o link assinado força "download",
// então carregamos os bytes e exibimos por uma URL local).
export async function fetchBlob(url, mimeType) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  const blob = await res.blob();
  return mimeType ? new Blob([blob], { type: mimeType }) : blob;
}
