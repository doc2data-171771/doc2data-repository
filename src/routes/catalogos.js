const express = require('express');
const { admin } = require('../supabase');
const { requirePerfil } = require('../middlewares/auth');
const { AppError, asyncHandler, throwIfError } = require('../utils/errors');
const { requireString, requireUuid } = require('../utils/validate');

// Gera as rotas de uma tabela de cadastro simples (canais e tipos_documento).
// Leitura: qualquer usuário logado. Escrita: só admin. Não há DELETE: desative com ativo=false.
function criarRotasCatalogo(tabela, { maxNome, rotulo }) {
  const router = express.Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      let query = admin.from(tabela).select('*').order('nome');
      if (req.query.ativo === 'true') query = query.eq('ativo', true);
      if (req.query.ativo === 'false') query = query.eq('ativo', false);
      const { data, error } = await query;
      throwIfError(error);
      res.json({ dados: data });
    })
  );

  router.post(
    '/',
    requirePerfil('admin'),
    asyncHandler(async (req, res) => {
      const nome = requireString(req.body?.nome, 'nome', maxNome);
      const descricao = req.body?.descricao ? String(req.body.descricao) : null;
      const { data, error } = await admin.from(tabela).insert({ nome, descricao }).select().single();
      throwIfError(error, { unique: `Já existe ${rotulo} com esse nome` });
      res.status(201).json(data);
    })
  );

  router.patch(
    '/:id',
    requirePerfil('admin'),
    asyncHandler(async (req, res) => {
      const id = requireUuid(req.params.id, 'id');
      const update = {};
      if (req.body?.nome !== undefined) update.nome = requireString(req.body.nome, 'nome', maxNome);
      if (req.body?.descricao !== undefined) update.descricao = req.body.descricao || null;
      if (req.body?.ativo !== undefined) {
        if (typeof req.body.ativo !== 'boolean') throw new AppError(400, 'ativo deve ser true ou false');
        update.ativo = req.body.ativo;
      }
      if (!Object.keys(update).length) throw new AppError(400, 'Nenhum campo para atualizar');

      const { data, error } = await admin.from(tabela).update(update).eq('id', id).select().maybeSingle();
      throwIfError(error, { unique: `Já existe ${rotulo} com esse nome` });
      if (!data) throw new AppError(404, 'Registro não encontrado');
      res.json(data);
    })
  );

  return router;
}

module.exports = {
  canaisRouter: criarRotasCatalogo('canais', { maxNome: 30, rotulo: 'um canal' }),
  tiposDocumentoRouter: criarRotasCatalogo('tipos_documento', { maxNome: 80, rotulo: 'um tipo de documento' }),
};
