const express = require('express');
const { admin } = require('../supabase');
const { AppError, asyncHandler, throwIfError } = require('../utils/errors');
const { requireUuid, isPlainObject } = require('../utils/validate');

const router = express.Router();
const STATUS = ['aprovado', 'corrigido', 'rejeitado'];

// POST /validacoes  (validação humana)
// { "dados_extraidos_id": "...", "status": "aprovado" | "corrigido" | "rejeitado",
//   "dados_corrigidos": {...}  (obrigatório se "corrigido"),
//   "observacao": "..."        (obrigatória se "rejeitado") }
// Efeito no documento: aprovado/corrigido -> "validado"; rejeitado -> "rejeitado".
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { status, dados_corrigidos: corrigidos, observacao } = req.body || {};
    const extraidoId = requireUuid(req.body?.dados_extraidos_id, 'dados_extraidos_id');

    if (!STATUS.includes(status)) throw new AppError(400, `status deve ser um de: ${STATUS.join(', ')}`);
    if (status === 'corrigido' && (!isPlainObject(corrigidos) || !Object.keys(corrigidos).length)) {
      throw new AppError(400, 'Para status "corrigido", envie dados_corrigidos (objeto JSON com os dados finais)');
    }
    if (status === 'rejeitado' && !(typeof observacao === 'string' && observacao.trim())) {
      throw new AppError(400, 'Para status "rejeitado", informe a observacao com o motivo');
    }

    const { data: extraido, error: e1 } = await admin
      .from('dados_extraidos')
      .select('id, processamentos(documento_id)')
      .eq('id', extraidoId)
      .maybeSingle();
    throwIfError(e1);
    if (!extraido) throw new AppError(404, 'Dados extraídos não encontrados');

    const proc = Array.isArray(extraido.processamentos) ? extraido.processamentos[0] : extraido.processamentos;
    const documentoId = proc.documento_id;

    const { data: doc, error: e2 } = await admin
      .from('documentos')
      .select('id, status')
      .eq('id', documentoId)
      .eq('enviado_por', req.user.id)
      .maybeSingle();
    throwIfError(e2);
    if (!doc) throw new AppError(404, 'Dados extraídos não encontrados');
    if (!['extraido', 'validado', 'rejeitado'].includes(doc?.status)) {
      throw new AppError(409, `Documento com status "${doc?.status}" não pode ser validado`);
    }

    const { data: validacao, error: e3 } = await admin
      .from('validacoes')
      .insert({
        dados_extraidos_id: extraidoId,
        usuario_id: req.user.id,
        status,
        dados_corrigidos: status === 'corrigido' ? corrigidos : null,
        observacao: typeof observacao === 'string' && observacao.trim() ? observacao.trim() : null,
      })
      .select()
      .single();
    throwIfError(e3);

    const novoStatus = status === 'rejeitado' ? 'rejeitado' : 'validado';
    const { error: e4 } = await admin.from('documentos').update({ status: novoStatus }).eq('id', documentoId);
    throwIfError(e4);

    res.status(201).json({ validacao, documento: { id: documentoId, status: novoStatus } });
  })
);

module.exports = router;
