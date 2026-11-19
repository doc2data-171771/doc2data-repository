// Ponto de entrada para rodar LOCALMENTE (npm run dev).
// Na Vercel, quem é usado é o arquivo api/index.js.
const app = require('./src/app');
const config = require('./src/config');

app.listen(config.port, () => {
  console.log(`doc2data-api rodando em http://localhost:${config.port}`);
});
