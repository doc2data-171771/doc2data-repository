const express = require('express');
const { admin, anonClient } = require('../supabase');
const { AppError, asyncHandler, throwIfError } = require('../utils/errors');
const { requireString } = require('../utils/validate');

const router = express.Router();

async function carregarPerfil(userId) {
  const { data, error } = await admin
    .from('profiles')
    .select('id, nome, perfil, ativo')
    .eq('id', userId)
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new AppError(403, 'Usuário sem perfil cadastrado. Fale com um administrador');
  if (!data.ativo) throw new AppError(403, 'Usuário desativado');
  return data;
}

function montarResposta(session, perfil, email) {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    usuario: { id: perfil.id, email, nome: perfil.nome, perfil: perfil.perfil },
  };
}

// POST /auth/login  { "email": "...", "senha": "..." }
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = requireString(req.body?.email, 'email', 254);
    const senha = requireString(req.body?.senha, 'senha', 200);

    const { data, error } = await anonClient().auth.signInWithPassword({ email, password: senha });
    if (error || !data?.session) throw new AppError(401, 'E-mail ou senha inválidos');

    const perfil = await carregarPerfil(data.user.id);
    res.json(montarResposta(data.session, perfil, data.user.email));
  })
);

// POST /auth/refresh  { "refresh_token": "..." }
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const refreshToken = requireString(req.body?.refresh_token, 'refresh_token');

    const { data, error } = await anonClient().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data?.session) throw new AppError(401, 'Sessão expirada. Faça login novamente');

    const perfil = await carregarPerfil(data.user.id);
    res.json(montarResposta(data.session, perfil, data.user.email));
  })
);

module.exports = router;
