const express = require('express');
const config = require('../config');
const { admin } = require('../supabase');
const { requirePerfil } = require('../middlewares/auth');
const { AppError, asyncHandler, throwIfError } = require('../utils/errors');
const { requireString, requireUuid } = require('../utils/validate');

const router = express.Router();
router.use(requirePerfil('admin'));

function validarPerfil(perfil) {
  if (!config.perfis.includes(perfil)) {
    throw new AppError(400, `perfil deve ser um de: ${config.perfis.join(', ')}`);
  }
  return perfil;
}

// GET /usuarios
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { data, error } = await admin
      .from('profiles')
      .select('id, nome, perfil, ativo, created_at, updated_at')
      .order('nome');
    throwIfError(error);
    res.json({ dados: data });
  })
);

// POST /usuarios  { "email", "senha", "nome", "perfil" }
// Cria o usuário no Supabase Auth e o registro correspondente em profiles.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const email = requireString(req.body?.email, 'email', 254);
    const senha = requireString(req.body?.senha, 'senha', 200);
    const nome = requireString(req.body?.nome, 'nome', 120);
    const perfil = validarPerfil(req.body?.perfil);
    if (senha.length < 8) throw new AppError(400, 'A senha deve ter pelo menos 8 caracteres');

    const { data: auth, error: authError } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });
    if (authError || !auth?.user) {
      console.error('[auth.createUser]', authError?.message);
      throw new AppError(400, 'Não foi possível criar o usuário (e-mail já cadastrado ou inválido)');
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .insert({ id: auth.user.id, nome, perfil })
      .select()
      .single();
    if (profileError) {
      await admin.auth.admin.deleteUser(auth.user.id); // desfaz para não deixar usuário sem perfil
      throwIfError(profileError);
    }

    res.status(201).json({ ...profile, email });
  })
);

// PATCH /usuarios/:id  { "nome"?, "perfil"?, "ativo"? }
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = requireUuid(req.params.id, 'id');
    const update = {};
    if (req.body?.nome !== undefined) update.nome = requireString(req.body.nome, 'nome', 120);
    if (req.body?.perfil !== undefined) update.perfil = validarPerfil(req.body.perfil);
    if (req.body?.ativo !== undefined) {
      if (typeof req.body.ativo !== 'boolean') throw new AppError(400, 'ativo deve ser true ou false');
      update.ativo = req.body.ativo;
    }
    if (!Object.keys(update).length) throw new AppError(400, 'Nenhum campo para atualizar');

    if (id === req.user.id && (update.ativo === false || (update.perfil && update.perfil !== 'admin'))) {
      throw new AppError(400, 'Você não pode desativar nem rebaixar o seu próprio usuário');
    }

    update.updated_at = new Date().toISOString();
    const { data, error } = await admin.from('profiles').update(update).eq('id', id).select().maybeSingle();
    throwIfError(error);
    if (!data) throw new AppError(404, 'Usuário não encontrado');
    res.json(data);
  })
);

module.exports = router;
