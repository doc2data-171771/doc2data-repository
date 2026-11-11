// "Porteiro" da API: confere o token enviado pelo front-end e descobre quem é o usuário.
// O front manda:  Authorization: Bearer <access_token>

import { HttpError } from './http.js';
import { db, eq, usuarioDoToken } from './supabase.js';

// Use como etapa nas rotas: router.get('/documentos', autenticar, async (ctx) => { ... })
export async function autenticar(ctx) {
  const cabecalho = ctx.req.headers.authorization || '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : '';
  if (!token) {
    throw new HttpError(401, 'Faça login e envie o cabeçalho "Authorization: Bearer <token>".');
  }

  const usuarioAuth = await usuarioDoToken(token);
  if (!usuarioAuth?.id) throw new HttpError(401, 'Sessão inválida ou expirada. Faça login novamente.');

  ctx.usuario = await carregarPerfil(usuarioAuth);
}

// Junta o usuário do Supabase Auth com a linha da tabela "profiles".
export async function carregarPerfil(usuarioAuth) {
  const perfil = await db.buscar('profiles', { id: eq(usuarioAuth.id) });
  if (!perfil) {
    throw new HttpError(403, 'Seu usuário ainda não tem perfil cadastrado. Fale com o administrador.');
  }
  if (!perfil.ativo) throw new HttpError(403, 'Seu usuário está inativo.');
  return { id: perfil.id, nome: perfil.nome, perfil: perfil.perfil, email: usuarioAuth.email };
}

// Etapa extra para rotas restritas: exigirPerfil('admin')
export function exigirPerfil(...perfisPermitidos) {
  return async (ctx) => {
    if (!perfisPermitidos.includes(ctx.usuario.perfil)) {
      throw new HttpError(403, 'Você não tem permissão para fazer isso.');
    }
  };
}
