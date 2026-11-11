import { BUCKET_DOCUMENTOS, STATUS_DOC, STATUS_PROC } from '../constants.js';
import { db, eq, storage } from '../supabase.js';
import { agora, novoId } from '../util.js';
import * as extrator from './extrator.js';

// Começa o processamento de um documento.
// Devolve NA HORA (status "processando") e faz o trabalho pesado em segundo plano.
// O front-end acompanha chamando GET /documentos/:id até o status virar "processado" (ou "erro").
export async function iniciarProcessamento(documento) {
  const [processamento] = await db.inserir('processamentos', {
    id: novoId(),
    documento_id: documento.id,
    status: STATUS_PROC.PROCESSANDO,
    ferramenta: extrator.ferramenta,
    modelo: null,
    iniciado_em: agora(),
  });
  const [documentoAtualizado] = await db.atualizar(
    'documentos',
    { id: eq(documento.id) },
    { status: STATUS_DOC.PROCESSANDO },
  );

  const trabalho = executar(processamento, documentoAtualizado);

  // Na Vercel a função "congela" assim que a resposta é enviada, então um trabalho em segundo
  // plano ficaria pela metade. Lá, esperamos terminar antes de responder (limite: maxDuration
  // do vercel.json). No computador local, continua em segundo plano.
  if (process.env.VERCEL) {
    await trabalho;
    const [processamentoFinal, documentoFinal] = await Promise.all([
      db.buscar('processamentos', { id: eq(processamento.id) }),
      db.buscar('documentos', { id: eq(documento.id) }),
    ]);
    return { processamento: processamentoFinal, documento: documentoFinal };
  }

  trabalho.catch((erro) => console.error('Erro inesperado no processamento:', erro));
  return { processamento, documento: documentoAtualizado };
}

async function executar(processamento, documento) {
  try {
    const arquivo = await storage.baixar(BUCKET_DOCUMENTOS, documento.caminho_arquivo);
    const tipoDocumento = documento.tipo_documento_id
      ? await db.buscar('tipos_documento', { id: eq(documento.tipo_documento_id) })
      : null;

    const resultado = await extrator.extrair({
      buffer: arquivo,
      mime: documento.mime_type,
      nomeArquivo: documento.nome_arquivo,
      tipoDocumento,
    });

    await db.inserir('dados_extraidos', {
      id: novoId(),
      processamento_id: processamento.id,
      dados: resultado.dados,
      confianca: resultado.confianca,
      created_at: agora(),
    });
    await db.atualizar(
      'processamentos',
      { id: eq(processamento.id) },
      { status: STATUS_PROC.CONCLUIDO, modelo: resultado.modelo, finalizado_em: agora() },
    );
    await db.atualizar('documentos', { id: eq(documento.id) }, { status: STATUS_DOC.PROCESSADO });
  } catch (erro) {
    console.error(`Processamento ${processamento.id} falhou:`, erro.message);
    await db
      .atualizar(
        'processamentos',
        { id: eq(processamento.id) },
        { status: STATUS_PROC.ERRO, erro: String(erro.message).slice(0, 500), finalizado_em: agora() },
      )
      .catch(() => {});
    await db.atualizar('documentos', { id: eq(documento.id) }, { status: STATUS_DOC.ERRO }).catch(() => {});
  }
}
