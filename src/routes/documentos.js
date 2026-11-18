const crypto = require('crypto');
const express = require('express');
const config = require('../config');
const { admin } = require('../supabase');
const { requirePerfil } = require('../middlewares/auth');
const { AppError, asyncHandler, throwIfError } = require('../utils/errors');
const {
  requireString,
  requireUuid,
  optionalUuid,
  parsePagination,
  sanitizeFileName,
} = require('../utils/validate');
const { processarDocumento } = require('../services/extracao');

const router = express.Router();
const BUCKET = config.buckets.documentos;
const SELECT = '*, canais(id, nome), tipos_documento(id, nome), enviado:profiles(id, nome)';

async function buscarDocumento(id) {
  const { data, error } = await admin.from('documentos').select('*').eq('id', id).maybeSingle();
  throwIfError(error);
  if (!data) throw new AppError(404, 'Documento não encontrado');
  return data;
}

async function urlAssinada(caminho, nomeArquivo) {
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(caminho, 3600, { download: nomeArquivo });
  return data?.signedUrl || null;
}

// POST /documentos/upload-url
// Registra o(s) documento(s) com status "recebido" e devolve URLs de upload direto ao Storage.
// (O arquivo NÃO passa pela API: na Vercel o corpo da requisição é limitado a ~4,5 MB.)
// Aceita um arquivo { nome_arquivo, mime_type, tamanho_bytes, canal_id?, tipo_documento_id? }
// ou vários: { arquivos: [ {...}, {...} ] }  (lote, até 50)
router.post(
  '/upload-url',
  requirePerfil('admin', 'operador'),
  asyncHandler(async (req, res) => {
    const lista = Array.isArray(req.body?.arquivos) ? req.body.arquivos : [req.body];
    if (!lista.length || lista.length > 50) {
      throw new AppError(400, 'Envie de 1 a 50 arquivos por requisição');
    }

    const registros = lista.map((a, i) => {
      const campo = (n) => `arquivos[${i}].${n}`;
      const nome = requireString(a?.nome_arquivo, campo('nome_arquivo'), 255);
      const mime = requireString(a?.mime_type, campo('mime_type'), 100);
      if (!config.upload.mimeTypes.includes(mime)) {
        throw new AppError(400, `Tipo de arquivo não aceito: ${mime}. Aceitos: ${config.upload.mimeTypes.join(', ')}`);
      }
      const tamanho = Number(a.tamanho_bytes);
      if (!Number.isInteger(tamanho) || tamanho <= 0) {
        throw new AppError(400, `${campo('tamanho_bytes')} deve ser um número inteiro maior que zero`);
      }
      if (tamanho > config.upload.maxBytes) {
        throw new AppError(413, `Arquivo "${nome}" excede o limite de ${config.upload.maxBytes / 1024 / 1024} MB`);
      }

      const id = crypto.randomUUID();
      return {
        id,
        nome_arquivo: nome,
        caminho_arquivo: `${id}/${sanitizeFileName(nome)}`,
        mime_type: mime,
        tamanho_bytes: tamanho,
        status: 'recebido',
        canal_id: optionalUuid(a.canal_id, campo('canal_id')),
        tipo_documento_id: optionalUuid(a.tipo_documento_id, campo('tipo_documento_id')),
        enviado_por: req.user.id,
      };
    });

    const { data: docs, error } = await admin.from('documentos').insert(registros).select(SELECT);
    throwIfError(error, { fk: 'canal_id ou tipo_documento_id não existe' });

    const uploads = await Promise.all(
      docs.map(async (doc) => {
        const { data, error: signError } = await admin.storage
          .from(BUCKET)
          .createSignedUploadUrl(doc.caminho_arquivo);
        return { doc, data, signError };
      })
    );

    if (uploads.some((u) => u.signError)) {
      await admin.from('documentos').delete().in('id', docs.map((d) => d.id));
      throw new AppError(500, 'Falha ao gerar as URLs de upload');
    }

    res.status(201).json({
      bucket: BUCKET,
      arquivos: uploads.map(({ doc, data }) => ({
        documento: doc,
        upload: { caminho: data.path, token: data.token, signed_url: data.signedUrl },
      })),
    });
  })
);

// GET /documentos?status=&canal_id=&tipo_documento_id=&busca=&page=&limit=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, from, to } = parsePagination(req.query);

    let query = admin.from('documentos').select(SELECT, { count: 'exact' });

    if (req.query.status) {
      if (!config.statusDocumento.includes(req.query.status)) {
        throw new AppError(400, `status deve ser um de: ${config.statusDocumento.join(', ')}`);
      }
      query = query.eq('status', req.query.status);
    }
    if (req.query.canal_id) query = query.eq('canal_id', requireUuid(req.query.canal_id, 'canal_id'));
    if (req.query.tipo_documento_id) {
      query = query.eq('tipo_documento_id', requireUuid(req.query.tipo_documento_id, 'tipo_documento_id'));
    }
    if (req.query.busca) {
      const termo = String(req.query.busca).replace(/[%_\\,()]/g, '').slice(0, 100);
      if (termo) query = query.ilike('nome_arquivo', `%${termo}%`);
    }

    const { data, error, count } = await query.order('data_envio', { ascending: false }).range(from, to);
    throwIfError(error);

    res.json({ dados: data, paginacao: { page, limit, total: count } });
  })
);

// GET /documentos/:id  (documento + histórico de processamentos, dados extraídos e validações)
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = requireUuid(req.params.id, 'id');
    const { data, error } = await admin
      .from('documentos')
      .select(
        `${SELECT}, processamentos(*, dados_extraidos(*, validacoes(*, validador:profiles(id, nome))))`
      )
      .eq('id', id)
      .maybeSingle();
    throwIfError(error);
    if (!data) throw new AppError(404, 'Documento não encontrado');

    data.processamentos = (data.processamentos || []).sort(
      (a, b) => new Date(b.iniciado_em) - new Date(a.iniciado_em)
    );
    data.download_url = await urlAssinada(data.caminho_arquivo, data.nome_arquivo);
    res.json(data);
  })
);

// PATCH /documentos/:id  { "canal_id"?, "tipo_documento_id"? }
router.patch(
  '/:id',
  requirePerfil('admin', 'operador'),
  asyncHandler(async (req, res) => {
    const id = requireUuid(req.params.id, 'id');
    const update = {};
    if (req.body?.canal_id !== undefined) update.canal_id = optionalUuid(req.body.canal_id, 'canal_id');
    if (req.body?.tipo_documento_id !== undefined) {
      update.tipo_documento_id = optionalUuid(req.body.tipo_documento_id, 'tipo_documento_id');
    }
    if (!Object.keys(update).length) throw new AppError(400, 'Nenhum campo para atualizar');

    const { data, error } = await admin.from('documentos').update(update).eq('id', id).select(SELECT).maybeSingle();
    throwIfError(error, { fk: 'canal_id ou tipo_documento_id não existe' });
    if (!data) throw new AppError(404, 'Documento não encontrado');
    res.json(data);
  })
);

// POST /documentos/:id/processar  -> lê o documento com IA e grava os dados extraídos
router.post(
  '/:id/processar',
  requirePerfil('admin', 'operador'),
  asyncHandler(async (req, res) => {
    const documento = await buscarDocumento(requireUuid(req.params.id, 'id'));
    const resultado = await processarDocumento(documento);
    res.json(resultado);
  })
);

// DELETE /documentos/:id  (só admin; bloqueado se o documento já foi exportado)
router.delete(
  '/:id',
  requirePerfil('admin'),
  asyncHandler(async (req, res) => {
    const documento = await buscarDocumento(requireUuid(req.params.id, 'id'));

    const { error } = await admin.from('documentos').delete().eq('id', documento.id);
    throwIfError(error, { fk: 'Este documento já foi usado em uma exportação e não pode ser excluído' });

    await admin.storage.from(BUCKET).remove([documento.caminho_arquivo]);
    res.status(204).end();
  })
);

module.exports = router;
