// Exportação: junta os documentos já validados numa planilha (CSV) e guarda o arquivo no Storage.

import { autenticar } from '../auth.js';
import { BUCKET_EXPORTACOES, FORMATOS_EXPORTACAO, STATUS_DOC, STATUS_EXPORTACAO } from '../constants.js';
import { HttpError } from '../http.js';
import { buscarPorId } from '../services/consultas.js';
import { achatar, gerarCsv } from '../services/csv.js';
import { db, em, eq, storage } from '../supabase.js';
import { agora, ehUuid, lerPaginacao, novoId } from '../util.js';

const MAX_DOCUMENTOS_POR_EXPORTACAO = 100;
const COLUNAS_FIXAS = ['arquivo', 'tipo_documento', 'canal', 'data_envio', 'status_validacao'];

// Para cada documento, descobre os dados "finais": os corrigidos pelo humano (se houve) ou os extraídos.
async function montarLinhas(documentos) {
  const ids = documentos.map((d) => d.id);
  const [canais, tipos, processamentos] = await Promise.all([
    db.listar('canais'),
    db.listar('tipos_documento'),
    db.listar('processamentos', {
      filtros: { documento_id: em(ids), status: eq('concluido') },
      ordem: 'iniciado_em.desc',
    }),
  ]);
  const nomeCanal = new Map(canais.map((c) => [c.id, c.nome]));
  const nomeTipo = new Map(tipos.map((t) => [t.id, t.nome]));

  // Processamento mais recente de cada documento (a lista já vem do mais novo para o mais antigo)
  const procPorDoc = new Map();
  for (const p of processamentos) if (!procPorDoc.has(p.documento_id)) procPorDoc.set(p.documento_id, p);

  const dados = procPorDoc.size
    ? await db.listar('dados_extraidos', { filtros: { processamento_id: em([...procPorDoc.values()].map((p) => p.id)) } })
    : [];
  const dadoPorProc = new Map(dados.map((d) => [d.processamento_id, d]));

  const validacoes = dados.length
    ? await db.listar('validacoes', { filtros: { dados_extraidos_id: em(dados.map((d) => d.id)) }, ordem: 'validado_em.desc' })
    : [];
  const valPorDado = new Map();
  for (const v of validacoes) if (!valPorDado.has(v.dados_extraidos_id)) valPorDado.set(v.dados_extraidos_id, v);

  const semDados = [];
  const linhas = [];
  for (const doc of documentos) {
    const proc = procPorDoc.get(doc.id);
    const dado = proc && dadoPorProc.get(proc.id);
    const validacao = dado && valPorDado.get(dado.id);
    if (!validacao || !['aprovado', 'corrigido'].includes(validacao.status)) {
      semDados.push(doc.nome_arquivo);
      continue;
    }
    const conteudo = validacao.status === 'corrigido' && validacao.dados_corrigidos ? validacao.dados_corrigidos : dado.dados;
    const campos = achatar(conteudo && typeof conteudo === 'object' && !Array.isArray(conteudo) ? conteudo : { valor: conteudo });
    const linha = {
      arquivo: doc.nome_arquivo,
      tipo_documento: nomeTipo.get(doc.tipo_documento_id) ?? '',
      canal: nomeCanal.get(doc.canal_id) ?? '',
      data_envio: doc.data_envio,
      status_validacao: validacao.status,
    };
    for (const [chave, valor] of Object.entries(campos)) {
      linha[COLUNAS_FIXAS.includes(chave) ? `${chave}_dado` : chave] = valor;
    }
    linhas.push(linha);
  }
  if (semDados.length) {
    throw new HttpError(409, `Estes documentos não têm dados validados: ${semDados.join(', ')}.`);
  }
  return linhas;
}

export default function rotasExportacoes(router) {
  // Gera a planilha. Corpo: { "documento_ids": ["...", "..."], "formato": "csv" }
  router.post('/exportacoes', autenticar, async (ctx) => {
    const { documento_ids: documentoIds, formato = 'csv' } = await ctx.json();

    if (!FORMATOS_EXPORTACAO.includes(formato)) {
      throw new HttpError(400, `Formato não suportado. Por enquanto: ${FORMATOS_EXPORTACAO.join(', ')} (abre no Excel).`);
    }
    if (!Array.isArray(documentoIds) || documentoIds.length === 0 || !documentoIds.every(ehUuid)) {
      throw new HttpError(400, '"documento_ids" deve ser uma lista de ids (UUID) de documentos.');
    }
    const ids = [...new Set(documentoIds)];
    if (ids.length > MAX_DOCUMENTOS_POR_EXPORTACAO) {
      throw new HttpError(400, `Exporte no máximo ${MAX_DOCUMENTOS_POR_EXPORTACAO} documentos por vez.`);
    }

    const documentos = await db.listar('documentos', { filtros: { id: em(ids) } });
    if (documentos.length !== ids.length) {
      const achados = new Set(documentos.map((d) => d.id));
      throw new HttpError(404, `Documentos não encontrados: ${ids.filter((id) => !achados.has(id)).join(', ')}.`);
    }
    const naoValidados = documentos.filter((d) => ![STATUS_DOC.VALIDADO, STATUS_DOC.EXPORTADO].includes(d.status));
    if (naoValidados.length) {
      throw new HttpError(409, `Só é possível exportar documentos validados. Pendentes: ${naoValidados.map((d) => d.nome_arquivo).join(', ')}.`);
    }

    const linhas = await montarLinhas(documentos);
    const colunas = [...COLUNAS_FIXAS];
    for (const linha of linhas) for (const chave of Object.keys(linha)) if (!colunas.includes(chave)) colunas.push(chave);
    const csv = gerarCsv(colunas, linhas);

    const id = novoId();
    const hoje = new Date();
    const caminho = `${hoje.getUTCFullYear()}/${String(hoje.getUTCMonth() + 1).padStart(2, '0')}/exportacao-${id}.csv`;

    await storage.enviar(BUCKET_EXPORTACOES, caminho, Buffer.from(csv, 'utf8'), 'text/csv; charset=utf-8');
    try {
      const [exportacao] = await db.inserir('exportacoes', {
        id,
        formato,
        caminho_arquivo: caminho,
        status: STATUS_EXPORTACAO.CONCLUIDO,
        solicitado_por: ctx.usuario.id,
        created_at: agora(),
      });
      await db.inserir('exportacao_documentos', ids.map((documentoId) => ({ exportacao_id: id, documento_id: documentoId })));
      await db.atualizar('documentos', { id: em(ids) }, { status: STATUS_DOC.EXPORTADO });
      ctx.status = 201;
      return { exportacao, total_documentos: ids.length };
    } catch (erro) {
      await storage.remover(BUCKET_EXPORTACOES, caminho).catch(() => {});
      await db.atualizar('exportacoes', { id: eq(id) }, { status: STATUS_EXPORTACAO.ERRO }).catch(() => {});
      throw erro;
    }
  });

  router.get('/exportacoes', autenticar, async (ctx) => {
    const { limite, offset } = lerPaginacao(ctx.query);
    return db.listar('exportacoes', { ordem: 'created_at.desc', limite, offset });
  });

  router.get('/exportacoes/:id', autenticar, async (ctx) => {
    const exportacao = await buscarPorId('exportacoes', ctx.params.id, 'Exportação');
    const itens = await db.listar('exportacao_documentos', { filtros: { exportacao_id: eq(exportacao.id) } });
    return { exportacao, documento_ids: itens.map((i) => i.documento_id) };
  });

  // Link temporário para baixar a planilha.
  router.get('/exportacoes/:id/arquivo', autenticar, async (ctx) => {
    const exportacao = await buscarPorId('exportacoes', ctx.params.id, 'Exportação');
    const segundos = 300;
    const nome = `exportacao-${String(exportacao.created_at).slice(0, 10)}.${exportacao.formato}`;
    const url = await storage.urlAssinada(BUCKET_EXPORTACOES, exportacao.caminho_arquivo, segundos, nome);
    return { url, expira_em_segundos: segundos, nome_arquivo: nome };
  });
}
