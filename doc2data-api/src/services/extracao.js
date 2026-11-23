const config = require('../config');
const { admin } = require('../supabase');
const { AppError, throwIfError } = require('../utils/errors');
const { extrairDocumento } = require('./gemini');
const { normalizarCampos } = require('./normalizacao');
const { TIPOS } = require('./esquemas');

const CINCO_MIN = 5 * 60 * 1000;

// Busca (ou cadastra) o tipo em tipos_documento. Falha aqui não derruba a extração.
async function idDoTipo(codigo) {
  const nome = TIPOS[codigo];
  if (!nome) return null;
  const { data, error } = await admin
    .from('tipos_documento')
    .upsert({ nome }, { onConflict: 'nome', ignoreDuplicates: false })
    .select('id')
    .single();
  if (error) {
    console.error('[extracao] tipo', error.message);
    return null;
  }
  return data.id;
}

// Fluxo: documento (recebido) -> processando -> extraido (ou erro)
// Tabelas envolvidas: documentos, processamentos, dados_extraidos
async function processarDocumento(documento) {
  // Evita processar duas vezes ao mesmo tempo (ignora travas antigas, de >5 min)
  const { data: emAndamento, error: e1 } = await admin
    .from('processamentos')
    .select('id, iniciado_em')
    .eq('documento_id', documento.id)
    .eq('status', 'em_andamento')
    .gte('iniciado_em', new Date(Date.now() - CINCO_MIN).toISOString())
    .limit(1);
  throwIfError(e1);
  if (emAndamento?.length) {
    throw new AppError(409, 'Este documento já está sendo processado');
  }

  // Baixa o arquivo ANTES de registrar o processamento
  const { data: blob, error: downloadError } = await admin.storage
    .from(config.buckets.documentos)
    .download(documento.caminho_arquivo);
  if (downloadError || !blob) {
    throw new AppError(409, 'O arquivo ainda não foi enviado ao Storage. Faça o upload e tente de novo');
  }
  const buffer = Buffer.from(await blob.arrayBuffer());

  let tipoNome = null;
  if (documento.tipo_documento_id) {
    const { data: tipo } = await admin
      .from('tipos_documento')
      .select('nome')
      .eq('id', documento.tipo_documento_id)
      .maybeSingle();
    tipoNome = tipo?.nome || null;
  }

  const { data: proc, error: e2 } = await admin
    .from('processamentos')
    .insert({ documento_id: documento.id, ferramenta: 'gemini', modelo: config.gemini.model })
    .select()
    .single();
  throwIfError(e2);

  await admin.from('documentos').update({ status: 'processando' }).eq('id', documento.id);

  try {
    const bruto = await extrairDocumento({
      buffer,
      mimeType: documento.mime_type,
      tipoDocumento: tipoNome,
    });
    const { campos, confianca, tipo } = normalizarCampos(
      { ...bruto.campos, tipo_documento: bruto.tipo ?? bruto.campos.tipo_documento },
      { confianca: bruto.confianca }
    );

    // Se o usuário não escolheu o tipo, grava o tipo identificado pela IA
    if (!documento.tipo_documento_id && tipo) {
      const tipoId = await idDoTipo(tipo);
      if (tipoId) await admin.from('documentos').update({ tipo_documento_id: tipoId }).eq('id', documento.id);
    }

    const { data: extraido, error: e3 } = await admin
      .from('dados_extraidos')
      .insert({ processamento_id: proc.id, dados: campos, confianca })
      .select()
      .single();
    if (e3) throw e3;

    const { data: procFinal } = await admin
      .from('processamentos')
      .update({ status: 'concluido', finalizado_em: new Date().toISOString() })
      .eq('id', proc.id)
      .select()
      .single();
    await admin.from('documentos').update({ status: 'extraido' }).eq('id', documento.id);

    return { processamento: procFinal || proc, dados_extraidos: extraido };
  } catch (err) {
    console.error('[extracao]', err.message);
    await admin
      .from('processamentos')
      .update({
        status: 'erro',
        erro: String(err.message || err).slice(0, 1000),
        finalizado_em: new Date().toISOString(),
      })
      .eq('id', proc.id);
    await admin.from('documentos').update({ status: 'erro' }).eq('id', documento.id);
    throw new AppError(502, 'Falha ao extrair os dados do documento', { processamento_id: proc.id });
  }
}

module.exports = { processarDocumento };
