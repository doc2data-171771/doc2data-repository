const express = require('express');
const { admin } = require('../supabase');
const { AppError, asyncHandler, throwIfError } = require('../utils/errors');
const { requireUuid, parsePagination } = require('../utils/validate');

const router = express.Router();

// GET /processamentos?documento_id=&status=&page=&limit=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, from, to } = parsePagination(req.query);
    let query = admin.from('processamentos').select('*', { count: 'exact' });

    if (req.query.documento_id) {
      query = query.eq('documento_id', requireUuid(req.query.documento_id, 'documento_id'));
    }
    if (req.query.status) {
      if (!['em_andamento', 'concluido', 'erro'].includes(req.query.status)) {
        throw new AppError(400, 'status deve ser: em_andamento, concluido ou erro');
      }
      query = query.eq('status', req.query.status);
    }

    const { data, error, count } = await query.order('iniciado_em', { ascending: false }).range(from, to);
    throwIfError(error);
    res.json({ dados: data, paginacao: { page, limit, total: count } });
  })
);

// GET /processamentos/:id  (inclui os dados extraídos)
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = requireUuid(req.params.id, 'id');
    const { data, error } = await admin
      .from('processamentos')
      .select('*, dados_extraidos(*)')
      .eq('id', id)
      .maybeSingle();
    throwIfError(error);
    if (!data) throw new AppError(404, 'Processamento não encontrado');
    res.json(data);
  })
);

module.exports = router;
