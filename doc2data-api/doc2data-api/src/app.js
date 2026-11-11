// Monta o servidor: registra as rotas e trata cada requisição.

import http from 'node:http';
import { config } from './config.js';
import { HttpError, acharRota, criarContexto, criarRouter, cabecalhosCors, enviarJson } from './http.js';
import rotasAuth from './routes/auth.js';
import rotasCatalogos from './routes/catalogos.js';
import rotasDocumentos from './routes/documentos.js';
import rotasExportacoes from './routes/exportacoes.js';
import rotasProcessamentos from './routes/processamentos.js';
import rotasValidacoes from './routes/validacoes.js';

// Devolve a função que atende cada requisição (req, res).
// Local: o criarServidor() abaixo usa ela. Vercel: o api/index.js usa ela.
export function criarManipulador() {
  const router = criarRouter();

  router.get('/', () => ({ api: 'doc2data-api', ok: true, saude: '/saude' }));
  router.get('/saude', () => ({ ok: true })); // para conferir se a API está no ar
  rotasAuth(router);
  rotasCatalogos(router);
  rotasDocumentos(router);
  rotasProcessamentos(router);
  rotasValidacoes(router);
  rotasExportacoes(router);

  return async (req, res) => {
    const inicio = Date.now();
    const cors = cabecalhosCors(req, config.frontendUrl);
    let status = 500;

    try {
      // O navegador faz uma "pergunta prévia" (OPTIONS) antes de chamadas de outro endereço.
      if (req.method === 'OPTIONS') {
        status = 204;
        enviarJson(res, 204, undefined, cors);
        return;
      }

      const url = new URL(req.url, 'http://localhost');
      const { rota, params, existeEmOutroMetodo } = acharRota(router.rotas, req.method, url.pathname);
      if (!rota) {
        throw new HttpError(existeEmOutroMetodo ? 405 : 404, existeEmOutroMetodo ? 'Método não permitido.' : 'Rota não encontrada.');
      }

      const ctx = criarContexto(req, url, params);
      let resposta;
      for (const etapa of rota.etapas) resposta = await etapa(ctx); // a última etapa é a rota em si

      status = ctx.status;
      enviarJson(res, ctx.status, resposta, cors);
    } catch (erro) {
      if (erro instanceof HttpError) {
        status = erro.status;
        enviarJson(res, erro.status, { erro: erro.message }, cors);
      } else {
        console.error('Erro inesperado:', erro);
        status = 500;
        enviarJson(res, 500, { erro: 'Erro interno do servidor.' }, cors);
      }
    } finally {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`${req.method} ${req.url.split('?')[0]} -> ${status} (${Date.now() - inicio} ms)`);
      }
    }
  };
}

// Servidor para rodar no seu computador (npm start).
export function criarServidor() {
  return http.createServer(criarManipulador());
}
