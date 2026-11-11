import { autenticar } from '../auth.js';
import { config } from '../config.js';
import { BUCKET_DOCUMENTOS, STATUS_DOC } from '../constants.js';
import { HttpError } from '../http.js';
import { buscarPorId } from '../services/consultas.js';
import { iniciarProcessamento } from '../services/processamento.js';
import { db, em, eq, storage } from '../supabase.js';
import { agora, detectarMime, exigirUuid, lerPaginacao, nomeSeguro, novoId } from '../util.js';

const valorOuNulo = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

export default function rotasDocumentos(router) {
  // ------------------------------------------------------------------
  // POST /documentos  — envia 1 ou vários arquivos (lote)
  // Formulário multipart com os campos:
  //   arquivo (ou arquivos, repetido)  -> os arquivos
  //   canal_id            (opcional)
  //   tipo_documento_id   (opcional)
  //   processar           (opcional, "true" = já começa a leitura automática)
  // ------------------------------------------------------------------
  router.post('/documentos', autenticar, async (ctx) => {
    const maxBytes = config.maxArquivoMb * 1024 * 1024;
    const form = await ctx.formData(maxBytes * config.maxArquivos + 1024 * 1024);

    const canalId = valorOuNulo(form.get('canal_id'));
    const tipoId = valorOuNulo(form.get('tipo_documento_id'));
    if (canalId) {
      exigirUuid(canalId, 'canal_id');
      const canal = await db.buscar('canais', { id: eq(canalId) });
      if (!canal || !canal.ativo) throw new HttpError(400, 'Canal inexistente ou inativo.');
    }
    if (tipoId) {
      exigirUuid(tipoId, 'tipo_documento_id');
      const tipo = await db.buscar('tipos_documento', { id: eq(tipoId) });
      if (!tipo || !tipo.ativo) throw new HttpError(400, 'Tipo de documento inexistente ou inativo.');
    }
    const processar = ['true', '1', 'sim'].includes(String(form.get('processar') ?? '').toLowerCase());

    const arquivos = [...form.getAll('arquivo'), ...form.getAll('arquivos')].filter(
      (item) => typeof item !== 'string',
    );
    if (arquivos.length === 0) {
      throw new HttpError(400, 'Nenhum arquivo recebido. Use o campo "arquivo" (ou "arquivos" para vários).');
    }
    if (arquivos.length > config.maxArquivos) {
      throw new HttpError(400, `Envie no máximo ${config.maxArquivos} arquivos por vez.`);
    }

    // 1) Confere TODOS os arquivos antes de salvar qualquer um.
    const prontos = [];
    for (const arquivo of arquivos) {
      const nome = arquivo.name || 'arquivo';
      if (arquivo.size === 0) throw new HttpError(400, `O arquivo "${nome}" está vazio.`);
      if (arquivo.size > maxBytes) {
        throw new HttpError(413, `O arquivo "${nome}" passa de ${config.maxArquivoMb} MB.`);
      }
      const buffer = Buffer.from(await arquivo.arrayBuffer());
      const mime = detectarMime(buffer);
      if (!mime) throw new HttpError(415, `"${nome}" não é um tipo aceito. Envie PDF, PNG ou JPG.`);
      prontos.push({ nome, buffer, mime });
    }

    // 2) Salva um por um: primeiro o arquivo no Storage, depois a linha na tabela.
    const documentos = [];
    const falhas = [];
    let primeiroErro = null;
    const hoje = new Date();
    const pasta = `${hoje.getUTCFullYear()}/${String(hoje.getUTCMonth() + 1).padStart(2, '0')}`;

    for (const item of prontos) {
      const id = novoId();
      const caminho = `${pasta}/${id}-${nomeSeguro(item.nome)}`;
      try {
        await storage.enviar(BUCKET_DOCUMENTOS, caminho, item.buffer, item.mime);
        try {
          const [doc] = await db.inserir('documentos', {
            id,
            nome_arquivo: item.nome.slice(0, 255),
            caminho_arquivo: caminho,
            mime_type: item.mime,
            tamanho_bytes: item.buffer.length,
            status: STATUS_DOC.RECEBIDO,
            canal_id: canalId,
            tipo_documento_id: tipoId,
            enviado_por: ctx.usuario.id,
            data_envio: agora(),
          });
          documentos.push(doc);
        } catch (erro) {
          await storage.remover(BUCKET_DOCUMENTOS, caminho).catch(() => {}); // não deixa arquivo "órfão"
          throw erro;
        }
      } catch (erro) {
        primeiroErro ??= erro;
        falhas.push({ arquivo: item.nome, erro: erro.status ? erro.message : 'Erro inesperado ao salvar.' });
      }
    }
    if (documentos.length === 0) throw primeiroErro;

    // 3) Se pediram, já começa a leitura automática.
    if (processar) {
      for (let i = 0; i < documentos.length; i += 1) {
        try {
          documentos[i] = (await iniciarProcessamento(documentos[i])).documento;
        } catch (erro) {
          console.error('Não consegui iniciar o processamento:', erro.message);
          falhas.push({ arquivo: documentos[i].nome_arquivo, erro: 'Salvo, mas não foi possível iniciar o processamento.' });
        }
      }
    }

    ctx.status = falhas.length ? 207 : 201; // 207 = deu certo só para alguns
    return { documentos, falhas };
  });

  // ------------------------------------------------------------------
  // GET /documentos  — lista, com filtros opcionais
  //   ?status=  ?canal_id=  ?tipo_documento_id=  ?enviado_por=  ?limite=20  ?offset=0
  // ------------------------------------------------------------------
  router.get('/documentos', autenticar, async (ctx) => {
    const filtros = {};
    for (const campo of ['status', 'canal_id', 'tipo_documento_id', 'enviado_por']) {
      const valor = ctx.query.get(campo);
      if (!valor) continue;
      if (campo !== 'status') exigirUuid(valor, campo);
      filtros[campo] = eq(valor);
    }
    const { limite, offset } = lerPaginacao(ctx.query);
    return db.listar('documentos', { filtros, ordem: 'data_envio.desc', limite, offset });
  });

  // ------------------------------------------------------------------
  // GET /documentos/:id  — tudo sobre um documento (tela de validação)
  // ------------------------------------------------------------------
  router.get('/documentos/:id', autenticar, async (ctx) => {
    const documento = await buscarPorId('documentos', ctx.params.id, 'Documento');
    const processamentos = await db.listar('processamentos', {
      filtros: { documento_id: eq(documento.id) },
      ordem: 'iniciado_em.desc',
    });

    // Dados extraídos mais recentes (de qualquer processamento deste documento)
    let dadosExtraidos = null;
    let validacoes = [];
    if (processamentos.length > 0) {
      const [maisRecente] = await db.listar('dados_extraidos', {
        filtros: { processamento_id: em(processamentos.map((p) => p.id)) },
        ordem: 'created_at.desc',
        limite: 1,
      });
      dadosExtraidos = maisRecente ?? null;
      if (dadosExtraidos) {
        validacoes = await db.listar('validacoes', {
          filtros: { dados_extraidos_id: eq(dadosExtraidos.id) },
          ordem: 'validado_em.desc',
        });
      }
    }
    return { documento, processamentos, dados_extraidos: dadosExtraidos, validacoes };
  });

  // ------------------------------------------------------------------
  // GET /documentos/:id/arquivo  — link temporário (5 min) para ver/baixar o arquivo original
  // ------------------------------------------------------------------
  router.get('/documentos/:id/arquivo', autenticar, async (ctx) => {
    const documento = await buscarPorId('documentos', ctx.params.id, 'Documento');
    const segundos = 300;
    const url = await storage.urlAssinada(BUCKET_DOCUMENTOS, documento.caminho_arquivo, segundos);
    return { url, expira_em_segundos: segundos, nome_arquivo: documento.nome_arquivo, mime_type: documento.mime_type };
  });
}
