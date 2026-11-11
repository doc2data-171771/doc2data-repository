import { autenticar } from '../auth.js';
import { STATUS_DOC } from '../constants.js';
import { HttpError } from '../http.js';
import { buscarPorId } from '../services/consultas.js';
import { iniciarProcessamento } from '../services/processamento.js';
import { db, eq } from '../supabase.js';

export default function rotasProcessamentos(router) {
  // Começa (ou refaz) a leitura automática de um documento.
  // Responde 202 ("aceito") na hora; o front acompanha com GET /documentos/:id.
  router.post('/documentos/:id/processar', autenticar, async (ctx) => {
    const documento = await buscarPorId('documentos', ctx.params.id, 'Documento');
    if (documento.status === STATUS_DOC.PROCESSANDO) {
      throw new HttpError(409, 'Este documento já está sendo processado.');
    }
    const resultado = await iniciarProcessamento(documento);
    ctx.status = 202;
    return resultado; // { processamento, documento }
  });

  // Histórico de tentativas de processamento de um documento.
  router.get('/documentos/:id/processamentos', autenticar, async (ctx) => {
    const documento = await buscarPorId('documentos', ctx.params.id, 'Documento');
    return db.listar('processamentos', {
      filtros: { documento_id: eq(documento.id) },
      ordem: 'iniciado_em.desc',
    });
  });

  // Um processamento + os dados que ele extraiu (se já terminou).
  router.get('/processamentos/:id', autenticar, async (ctx) => {
    const processamento = await buscarPorId('processamentos', ctx.params.id, 'Processamento');
    const dadosExtraidos = await db.buscar('dados_extraidos', { processamento_id: eq(processamento.id) });
    return { processamento, dados_extraidos: dadosExtraidos };
  });
}
