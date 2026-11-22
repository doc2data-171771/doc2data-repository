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

// POST /auth/registro  { "nome": "...", "email": "...", "senha": "..." }
// Cadastro aberto: cada pessoa cria a própria conta e só enxerga os próprios documentos.
router.post(
  '/registro',
  asyncHandler(async (req, res) => {
    const nome = requireString(req.body?.nome, 'nome', 120);
    const email = requireString(req.body?.email, 'email', 254).toLowerCase();
    const senha = requireString(req.body?.senha, 'senha', 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(400, 'E-mail inválido');
    if (senha.length < 8) throw new AppError(400, 'A senha deve ter pelo menos 8 caracteres');

    // shortcut: confirma o e-mail na hora (sem link de verificação); ligar a confirmação do Supabase se o cadastro ficar público
    const { data: auth, error: authError } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });
    if (authError || !auth?.user) {
      console.error('[auth.registro]', authError?.message);
      throw new AppError(400, 'Não foi possível criar a conta (e-mail já cadastrado ou inválido)');
    }

    // "operador": dono da própria conta; não edita os cadastros globais (canais e tipos)
    const { error: profileError } = await admin.from('profiles').insert({ id: auth.user.id, nome, perfil: 'operador' });
    if (profileError) {
      await admin.auth.admin.deleteUser(auth.user.id); // desfaz para não deixar usuário sem perfil
      throwIfError(profileError);
    }

    const { data, error } = await anonClient().auth.signInWithPassword({ email, password: senha });
    if (error || !data?.session) throw new AppError(500, 'Conta criada, mas o login falhou. Tente entrar');

    const perfil = await carregarPerfil(data.user.id);
    res.status(201).json(montarResposta(data.session, perfil, data.user.email));
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
