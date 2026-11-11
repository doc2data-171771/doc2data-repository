// Ponto de partida: "npm start" executa este arquivo.

import { config, variaveisFaltando } from './config.js';
import { criarServidor } from './app.js';

const faltando = variaveisFaltando();
if (faltando.length > 0) {
  console.error(`Faltam variáveis no arquivo .env: ${faltando.join(', ')}`);
  console.error('Copie o arquivo .env.example para .env e preencha os valores.');
  process.exit(1);
}

criarServidor().listen(config.porta, () => {
  console.log(`API no ar em http://localhost:${config.porta}  (teste: http://localhost:${config.porta}/saude)`);
});
