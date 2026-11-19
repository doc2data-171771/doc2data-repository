const express = require('express');
const { admin } = require('../supabase');
const { AppError, asyncHandler, throwIfError } = require('../utils/errors');
const { requireUuid, parsePagination } = require('../utils/validate');
const { criarExportacao, urlDeDownload } = require('../services/exportacao');

const router = express.Router();

// POST /exportacoes
// { "formato": "xlsx" | "csv", "documento_ids": ["..."] }   ou   { "formato": "xlsx", "todos_validados": true }
// Só documentos com status "validado" entram na planilha.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { formato, documento_ids: ids, todos_validados: todos } = req.body || {};
    if (!['xlsx', 'csv'].includes(formato)) throw new AppError(400, 'formato deve ser "xlsx" ou "csv"');

    let documentoIds;
    if (todos === true) {
      const { data, error } = await admin
        .from('documentos')
        .select('id')
        .eq('status', 'validado')
        .order('data_envio', { ascending: false })
        .limit(500);
      throwIfError(error);
      documentoIds = data.map((d) => d.id);
    } else {
      if (!Array.isArray(ids) || !ids.length || ids.length > 500) {
        throw new AppError(400, 'Envie documento_ids (1 a 500 IDs) ou todos_validados: true');
      }
      documentoIds = [...new Set(ids.map((id, i) => requireUuid(id, `documento_ids[${i}]`)))];
    }
    if (!documentoIds.length) throw new AppError(404, 'Não há documentos validados para exportar');

    const resultado = await criarExportacao({ formato, documentoIds, usuarioId: req.user.id });
    res.status(201).json(resultado);
  })
);

// GET /exportacoes  (histórico)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, from, to } = parsePagination(req.query);
    const { data, error, count } = await admin
      .from('exportacoes')
      .select('*, solicitante:profiles(id, nome), exportacao_documentos(count)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    throwIfError(error);
    res.json({ dados: data, paginacao: { page, limit, total: count } });
  })
);

// GET /exportacoes/:id/download  -> novo link temporário (1 hora) para baixar a planilha
router.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const id = requireUuid(req.params.id, 'id');
    const { data, error } = await admin.from('exportacoes').select('*').eq('id', id).maybeSingle();
    throwIfError(error);
    if (!data) throw new AppError(404, 'Exportação não encontrada');
    if (data.status !== 'gerado') throw new AppError(409, `Exportação com status "${data.status}" não tem arquivo`);
    res.json({ download_url: await urlDeDownload(data.caminho_arquivo, data.formato) });
  })
);

module.exports = router;
