// Entrada da API na Vercel. A Vercel executa este arquivo como uma "função":
// cada requisição que chega passa por aqui (o vercel.json manda TUDO para cá).

import { criarManipulador } from '../src/app.js';
import { config, variaveisFaltando } from '../src/config.js';
import { cabecalhosCors, enviarJson } from '../src/http.js';

const manipulador = criarManipulador();

export default async function handler(req, res) {
  // Na Vercel as variáveis vêm do painel (Settings → Environment Variables), não do arquivo .env.
  const faltando = variaveisFaltando();
  if (faltando.length > 0) {
    enviarJson(
      res,
      500,
      {
        erro: `Faltam variáveis de ambiente na Vercel: ${faltando.join(', ')}. Cadastre em Settings → Environment Variables e faça um novo deploy.`,
      },
      cabecalhosCors(req, config.frontendUrl),
    );
    return;
  }
  return manipulador(req, res);
}
