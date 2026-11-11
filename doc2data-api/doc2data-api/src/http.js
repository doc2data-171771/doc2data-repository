// Mini "Express" feito à mão: define rotas, lê o corpo da requisição e padroniza erros.

// Um erro com código HTTP. Quando você faz "throw new HttpError(404, '...')",
// a API responde { "erro": "..." } com o status 404.
export class HttpError extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

// Cria o "registro de rotas". Exemplo de uso:
//   router.get('/documentos/:id', autenticar, async (ctx) => { ... });
// Os pedaços entre a rota e o último parâmetro são "etapas" (ex.: autenticar) que rodam em ordem.
export function criarRouter() {
  const rotas = [];

  function registrar(metodo, caminho, ...etapas) {
    const nomes = [];
    const padrao = caminho.replace(/:(\w+)/g, (_, nome) => {
      nomes.push(nome);
      return '([^/]+)';
    });
    rotas.push({ metodo, regex: new RegExp(`^${padrao}/?$`), nomes, etapas });
  }

  return {
    rotas,
    get: (caminho, ...etapas) => registrar('GET', caminho, ...etapas),
    post: (caminho, ...etapas) => registrar('POST', caminho, ...etapas),
    patch: (caminho, ...etapas) => registrar('PATCH', caminho, ...etapas),
  };
}

// Procura a rota que combina com o método + caminho pedidos.
export function acharRota(rotas, metodo, caminho) {
  let existeEmOutroMetodo = false;
  for (const rota of rotas) {
    const encontrado = rota.regex.exec(caminho);
    if (!encontrado) continue;
    if (rota.metodo !== metodo) {
      existeEmOutroMetodo = true;
      continue;
    }
    const params = {};
    rota.nomes.forEach((nome, i) => {
      try {
        params[nome] = decodeURIComponent(encontrado[i + 1]);
      } catch {
        throw new HttpError(400, 'Endereço inválido.');
      }
    });
    return { rota, params };
  }
  return { existeEmOutroMetodo };
}

// Lê o corpo da requisição inteiro, recusando se passar do limite.
export async function lerCorpo(req, limiteBytes) {
  const declarado = Number(req.headers['content-length'] || 0);
  if (declarado > limiteBytes) {
    throw new HttpError(413, 'O envio é grande demais.');
  }
  const pedacos = [];
  let total = 0;
  for await (const pedaco of req) {
    total += pedaco.length;
    if (total > limiteBytes) throw new HttpError(413, 'O envio é grande demais.');
    pedacos.push(pedaco);
  }
  return Buffer.concat(pedacos);
}

// Monta o "ctx" (contexto) que cada rota recebe.
export function criarContexto(req, url, params) {
  return {
    req,
    url,
    query: url.searchParams, // ex.: ctx.query.get('status')
    params, // ex.: ctx.params.id
    usuario: null, // preenchido pelo "autenticar"
    status: 200, // a rota pode trocar (201, 202...)

    // Lê o corpo como JSON.
    async json() {
      const buffer = await lerCorpo(req, 1_000_000);
      if (buffer.length === 0) return {};
      let dados;
      try {
        dados = JSON.parse(buffer.toString('utf8'));
      } catch {
        throw new HttpError(400, 'O corpo da requisição não é um JSON válido.');
      }
      if (dados === null || typeof dados !== 'object' || Array.isArray(dados)) {
        throw new HttpError(400, 'O corpo da requisição deve ser um objeto JSON.');
      }
      return dados;
    },

    // Lê um formulário com arquivos (multipart/form-data), como o FormData do navegador.
    async formData(limiteBytes) {
      const tipo = req.headers['content-type'] || '';
      if (!tipo.startsWith('multipart/form-data')) {
        throw new HttpError(415, 'Envie como multipart/form-data (use FormData no front-end).');
      }
      const buffer = await lerCorpo(req, limiteBytes);
      try {
        return await new Response(buffer, { headers: { 'content-type': tipo } }).formData();
      } catch {
        throw new HttpError(400, 'Formulário de upload inválido.');
      }
    },
  };
}

// Permite que o front-end (que roda em outro endereço) converse com a API.
export function cabecalhosCors(req, frontendUrl) {
  const permitidas = frontendUrl.split(',').map((s) => s.trim()).filter(Boolean);
  const origem = req.headers.origin;
  const cabecalhos = {
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
  };
  if (permitidas.includes('*')) {
    cabecalhos['Access-Control-Allow-Origin'] = '*';
  } else if (origem && permitidas.includes(origem)) {
    cabecalhos['Access-Control-Allow-Origin'] = origem;
    cabecalhos.Vary = 'Origin';
  }
  return cabecalhos;
}

export function enviarJson(res, status, corpo, extras = {}) {
  if (corpo === undefined) {
    res.writeHead(status === 200 ? 204 : status, extras);
    res.end();
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...extras });
  res.end(JSON.stringify(corpo));
}
