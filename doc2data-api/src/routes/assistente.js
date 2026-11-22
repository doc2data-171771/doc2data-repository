const express = require('express');
const { admin } = require('../supabase');
const { AppError, asyncHandler, throwIfError } = require('../utils/errors');
const { requireString, requireUuid } = require('../utils/validate');
const { perguntarSobreDados } = require('../services/gemini');

const router = express.Router();
const MAX_DOCS = 100;

const one = (v) => (Array.isArray(v) ? v[0] : v);
const latest = (list, field) => [...(list || [])].sort((a, b) => new Date(b[field]) - new Date(a[field]))[0];

// POST /assistente  { "pergunta": "...", "documento_ids"?: ["..."] }
// Manda à IA os dados extraídos dos documentos DO PRÓPRIO usuário e devolve a resposta em texto (Markdown).
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const pergunta = requireString(req.body?.pergunta, 'pergunta', 2000);
    const ids = req.body?.documento_ids;
    if (ids !== undefined && (!Array.isArray(ids) || ids.length > MAX_DOCS)) {
      throw new AppError(400, `documento_ids deve ser uma lista de até ${MAX_DOCS} IDs`);
    }

    let query = admin
      .from('documentos')
      .select(
        'id, nome_arquivo, status, data_envio, tipos_documento(nome), processamentos(status, iniciado_em, dados_extraidos(dados, confianca, validacoes(status, dados_corrigidos, validado_em)))'
      )
      .eq('enviado_por', req.user.id)
      .in('status', ['extraido', 'validado', 'rejeitado']);
    if (ids?.length) query = query.in('id', ids.map((id, i) => requireUuid(id, `documento_ids[${i}]`)));

    const { data, error } = await query.order('data_envio', { ascending: false }).limit(MAX_DOCS);
    throwIfError(error);
    if (!data.length) throw new AppError(404, 'Você ainda não tem documentos lidos pela IA para analisar');

    const documentos = data.map((d) => {
      const proc = latest(
        (d.processamentos || []).filter((p) => p.status === 'concluido' && one(p.dados_extraidos)),
        'iniciado_em'
      );
      const ext = proc ? one(proc.dados_extraidos) : null;
      const val = latest(ext?.validacoes, 'validado_em');
      return {
        arquivo: d.nome_arquivo,
        tipo: one(d.tipos_documento)?.nome || null,
        status: d.status,
        enviado_em: d.data_envio,
        dados: val?.status === 'corrigido' && val.dados_corrigidos ? val.dados_corrigidos : ext?.dados || null,
      };
    });

    const resposta = await perguntarSobreDados({ pergunta, documentos });
    res.json({ resposta, documentos_analisados: documentos.length });
  })
);

module.exports = router;
