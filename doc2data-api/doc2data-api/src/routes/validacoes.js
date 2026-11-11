// Validação humana: a pessoa confere o que o extrator leu e aprova, corrige ou rejeita.

import { autenticar } from '../auth.js';
import { STATUS_DOC, STATUS_VALIDACAO } from '../constants.js';
import { HttpError } from '../http.js';
import { buscarPorId } from '../services/consultas.js';
import { db, eq } from '../supabase.js';
import { agora, novoId } from '../util.js';

// Só dá para validar documentos que já foram lidos.
const STATUS_QUE_ACEITAM_VALIDACAO = [
  STATUS_DOC.PROCESSADO,
  STATUS_DOC.VALIDADO,
  STATUS_DOC.REJEITADO,
  STATUS_DOC.EXPORTADO,
];

export default function rotasValidacoes(router) {
  // Dados extraídos + histórico de validações.
  router.get('/dados-extraidos/:id', autenticar, async (ctx) => {
    const dadosExtraidos = await buscarPorId('dados_extraidos', ctx.params.id, 'Dados extraídos');
    const validacoes = await db.listar('validacoes', {
      filtros: { dados_extraidos_id: eq(dadosExtraidos.id) },
      ordem: 'validado_em.desc',
    });
    return { dados_extraidos: dadosExtraidos, validacoes };
  });

  // Registra a decisão do humano.
  // Corpo: { "status": "aprovado" | "corrigido" | "rejeitado",
  //          "dados_corrigidos": { ... },   <- obrigatório quando "corrigido"
  //          "observacao": "texto opcional" }
  router.post('/dados-extraidos/:id/validacoes', autenticar, async (ctx) => {
    const dadosExtraidos = await buscarPorId('dados_extraidos', ctx.params.id, 'Dados extraídos');
    const { status, dados_corrigidos: dadosCorrigidos, observacao } = await ctx.json();

    if (!STATUS_VALIDACAO.includes(status)) {
      throw new HttpError(400, `"status" deve ser um destes: ${STATUS_VALIDACAO.join(', ')}.`);
    }
    if (status === 'corrigido') {
      const objeto = dadosCorrigidos && typeof dadosCorrigidos === 'object' && !Array.isArray(dadosCorrigidos);
      if (!objeto || Object.keys(dadosCorrigidos).length === 0) {
        throw new HttpError(400, 'Para status "corrigido", envie "dados_corrigidos" com os campos corrigidos.');
      }
    } else if (dadosCorrigidos !== undefined && dadosCorrigidos !== null) {
      throw new HttpError(400, 'Só envie "dados_corrigidos" quando o status for "corrigido".');
    }
    if (observacao !== undefined && observacao !== null) {
      if (typeof observacao !== 'string' || observacao.length > 2000) {
        throw new HttpError(400, '"observacao" deve ser um texto de até 2000 caracteres.');
      }
    }

    const processamento = await buscarPorId('processamentos', dadosExtraidos.processamento_id, 'Processamento');
    const documento = await buscarPorId('documentos', processamento.documento_id, 'Documento');
    if (!STATUS_QUE_ACEITAM_VALIDACAO.includes(documento.status)) {
      throw new HttpError(409, `Este documento está com status "${documento.status}" e ainda não pode ser validado.`);
    }

    const [validacao] = await db.inserir('validacoes', {
      id: novoId(),
      dados_extraidos_id: dadosExtraidos.id,
      usuario_id: ctx.usuario.id,
      status,
      dados_corrigidos: status === 'corrigido' ? dadosCorrigidos : null,
      observacao: observacao || null,
      validado_em: agora(),
    });

    const novoStatus = status === 'rejeitado' ? STATUS_DOC.REJEITADO : STATUS_DOC.VALIDADO;
    await db.atualizar('documentos', { id: eq(documento.id) }, { status: novoStatus });

    ctx.status = 201;
    return { validacao, documento_id: documento.id, documento_status: novoStatus };
  });
}
