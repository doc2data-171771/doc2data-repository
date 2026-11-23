const crypto = require('crypto');
const config = require('../config');
const { admin } = require('../supabase');
const { AppError, throwIfError } = require('../utils/errors');
const { flatten, buildTable, toCsv, separarListas } = require('../utils/tabular');
const { ORDEM_COLUNAS } = require('./esquemas');

const COLUNAS_FIXAS = ['arquivo', 'tipo_documento', 'canal', 'data_envio', 'validado_em', 'confianca_ia'];

const CONTENT_TYPES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
};

const latest = (list, field) =>
  [...(list || [])].sort((a, b) => new Date(b[field]) - new Date(a[field]))[0];
const one = (v) => (Array.isArray(v) ? v[0] : v);

// Monta as linhas: dado final = correção do validador (se houver) ou o dado extraído.
async function montarLinhas(documentoIds) {
  const { data: docs, error: e1 } = await admin
    .from('documentos')
    .select('id, nome_arquivo, status, data_envio, canais(nome), tipos_documento(nome)')
    .in('id', documentoIds);
  throwIfError(e1);

  const naoValidados = docs.filter((d) => d.status !== 'validado');
  if (docs.length !== documentoIds.length || naoValidados.length) {
    throw new AppError(409, 'Só é possível exportar documentos existentes com status "validado"', {
      ids_invalidos: [
        ...documentoIds.filter((id) => !docs.find((d) => d.id === id)),
        ...naoValidados.map((d) => d.id),
      ],
    });
  }

  const { data: procs, error: e2 } = await admin
    .from('processamentos')
    .select('documento_id, iniciado_em, dados_extraidos(id, dados, confianca)')
    .in('documento_id', documentoIds)
    .eq('status', 'concluido');
  throwIfError(e2);

  const extracaoPorDoc = {};
  for (const id of documentoIds) {
    const p = latest(
      procs.filter((x) => x.documento_id === id && one(x.dados_extraidos)),
      'iniciado_em'
    );
    if (p) extracaoPorDoc[id] = one(p.dados_extraidos);
  }

  const extIds = Object.values(extracaoPorDoc).map((e) => e.id);
  const { data: vals, error: e3 } = await admin
    .from('validacoes')
    .select('dados_extraidos_id, status, dados_corrigidos, validado_em')
    .in('dados_extraidos_id', extIds.length ? extIds : ['00000000-0000-0000-0000-000000000000']);
  throwIfError(e3);

  return docs.map((doc) => {
    const ext = extracaoPorDoc[doc.id];
    const val = ext ? latest(vals.filter((v) => v.dados_extraidos_id === ext.id), 'validado_em') : null;
    const dadosFinais = val?.status === 'corrigido' && val.dados_corrigidos ? val.dados_corrigidos : ext?.dados;

    return {
      meta: {
        arquivo: doc.nome_arquivo,
        tipo_documento: one(doc.tipos_documento)?.nome ?? '',
        canal: one(doc.canais)?.nome ?? '',
        data_envio: doc.data_envio,
        validado_em: val?.validado_em ?? '',
        confianca_ia: ext?.confianca ?? '',
      },
      dados: dadosFinais || {},
    };
  });
}

const PRIORIDADE = [...COLUNAS_FIXAS, ...ORDEM_COLUNAS];
const linhaPlana = ({ meta, dados }) => ({ ...meta, ...flatten(dados) });

function adicionarAba(wb, nome, headers, matrix) {
  const ws = wb.addWorksheet(nome);
  ws.addRow(headers);
  matrix.forEach((row) => ws.addRow(row));
  ws.getRow(1).font = { bold: true };
  headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = Math.min(45, Math.max(12, h.length + 2));
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

// CSV: uma linha por documento (listas como JSON). XLSX: listas de objetos vão para abas próprias.
async function gerarArquivo(formato, registros) {
  if (formato === 'csv') {
    const { headers, matrix } = buildTable(registros.map(linhaPlana), PRIORIDADE);
    return Buffer.from(toCsv(headers, matrix), 'utf8');
  }

  const { principais, abas } = separarListas(registros);
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const doc = buildTable(principais, PRIORIDADE);
  adicionarAba(wb, 'Documentos', doc.headers, doc.matrix);
  for (const [nome, linhas] of Object.entries(abas)) {
    const t = buildTable(linhas, ['arquivo', 'n']);
    adicionarAba(wb, nome, t.headers, t.matrix);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function urlDeDownload(caminho, formato) {
  const { data, error } = await admin.storage
    .from(config.buckets.exportacoes)
    .createSignedUrl(caminho, 3600, { download: `doc2data-export.${formato}` });
  if (error) throw new AppError(500, 'Não foi possível gerar o link de download');
  return data.signedUrl;
}

// Tabelas envolvidas: exportacoes, exportacao_documentos
async function criarExportacao({ formato, documentoIds, usuarioId }) {
  const linhas = await montarLinhas(documentoIds);

  const id = crypto.randomUUID();
  const caminho = `${id}.${formato}`;

  const { error: e1 } = await admin
    .from('exportacoes')
    .insert({ id, formato, caminho_arquivo: caminho, status: 'pendente', solicitado_por: usuarioId });
  throwIfError(e1);

  try {
    const buffer = await gerarArquivo(formato, linhas);

    const { error: upErr } = await admin.storage
      .from(config.buckets.exportacoes)
      .upload(caminho, buffer, { contentType: CONTENT_TYPES[formato], upsert: false });
    if (upErr) throw upErr;

    const { error: linkErr } = await admin
      .from('exportacao_documentos')
      .insert(documentoIds.map((documento_id) => ({ exportacao_id: id, documento_id })));
    if (linkErr) throw linkErr;

    const { data: exportacao } = await admin
      .from('exportacoes')
      .update({ status: 'gerado' })
      .eq('id', id)
      .select()
      .single();

    return { exportacao, download_url: await urlDeDownload(caminho, formato) };
  } catch (err) {
    console.error('[exportacao]', err.message);
    await admin.from('exportacoes').update({ status: 'erro' }).eq('id', id);
    throw new AppError(500, 'Falha ao gerar a planilha', { exportacao_id: id });
  }
}

module.exports = { criarExportacao, urlDeDownload, gerarArquivo };
