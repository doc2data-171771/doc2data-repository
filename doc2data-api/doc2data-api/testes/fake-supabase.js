// Um "Supabase de mentirinha" que roda na memória, só para testar a API sem internet.
// Imita o mínimo do Auth, do banco (PostgREST) e do Storage.

import http from 'node:http';
import { randomUUID } from 'node:crypto';

export const CHAVES = { anon: 'anon-key-de-teste', servico: 'chave-de-servico-SECRETA-123' };

export function criarFakeSupabase() {
  const usuarios = [
    { id: randomUUID(), email: 'admin@teste.com', senha: 'senha123', nome: 'Ana Admin', perfil: 'admin', ativo: true },
    { id: randomUUID(), email: 'operador@teste.com', senha: 'senha123', nome: 'Otávio Operador', perfil: 'operador', ativo: true },
    { id: randomUUID(), email: 'inativo@teste.com', senha: 'senha123', nome: 'Ivo Inativo', perfil: 'operador', ativo: false },
    { id: randomUUID(), email: 'semperfil@teste.com', senha: 'senha123', nome: null, perfil: null, ativo: false },
  ];

  const tabelas = {
    profiles: usuarios.filter((u) => u.perfil).map((u) => ({ id: u.id, nome: u.nome, perfil: u.perfil, ativo: u.ativo })),
    canais: [], tipos_documento: [], documentos: [], processamentos: [],
    dados_extraidos: [], validacoes: [], exportacoes: [], exportacao_documentos: [],
  };
  const arquivos = new Map(); // "bucket/caminho" -> { buffer, mime }
  const buckets = new Set(['documentos', 'exportacoes']);
  const sessoes = new Map(); // token -> usuario

  const emitirSessao = (usuario) => {
    const access = `token-${randomUUID()}`;
    sessoes.set(access, usuario);
    return { access_token: access, refresh_token: `refresh-${usuario.id}`, expires_in: 3600, user: { id: usuario.id, email: usuario.email } };
  };

  function aplicarFiltros(linhas, params) {
    let resultado = linhas;
    for (const [coluna, expr] of params) {
      if (['select', 'order', 'limit', 'offset'].includes(coluna)) continue;
      const [op, ...resto] = expr.split('.');
      const valor = resto.join('.');
      if (op === 'eq') resultado = resultado.filter((l) => String(l[coluna]) === valor);
      else if (op === 'in') {
        const lista = valor.slice(1, -1).split(',');
        resultado = resultado.filter((l) => lista.includes(String(l[coluna])));
      }
    }
    return resultado;
  }

  const lerTudo = async (req) => {
    const partes = [];
    for await (const p of req) partes.push(p);
    return Buffer.concat(partes);
  };

  const servidor = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://fake');
    const corpo = await lerTudo(req);
    const json = (status, obj) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    const caminho = url.pathname;

    try {
      // ---------------- Auth
      if (caminho === '/auth/v1/token') {
        if (req.headers.apikey !== CHAVES.anon) return json(401, { message: 'Invalid API key' });
        const dados = JSON.parse(corpo.toString() || '{}');
        if (url.searchParams.get('grant_type') === 'password') {
          const u = usuarios.find((x) => x.email === dados.email && x.senha === dados.password);
          if (!u) return json(400, { error: 'invalid_grant' });
          return json(200, emitirSessao(u));
        }
        if (url.searchParams.get('grant_type') === 'refresh_token') {
          const u = usuarios.find((x) => `refresh-${x.id}` === dados.refresh_token);
          if (!u) return json(400, { error: 'invalid_grant' });
          return json(200, emitirSessao(u));
        }
      }
      if (caminho === '/auth/v1/user') {
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        const u = sessoes.get(token);
        if (!u) return json(401, { message: 'invalid JWT' });
        return json(200, { id: u.id, email: u.email });
      }

      // ---------------- Banco
      if (caminho.startsWith('/rest/v1/')) {
        if (req.headers.apikey !== CHAVES.servico) return json(401, { message: 'Invalid API key' });
        const nome = caminho.replace('/rest/v1/', '');
        if (!tabelas[nome]) return json(404, { code: 'PGRST205', message: `Could not find the table '${nome}'` });
        const linhas = tabelas[nome];

        if (req.method === 'GET') {
          let r = aplicarFiltros(linhas, url.searchParams);
          const ordem = url.searchParams.get('order');
          if (ordem) {
            const [col, dir] = ordem.split('.');
            r = [...r].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (dir === 'desc' ? -1 : 1));
          }
          const offset = Number(url.searchParams.get('offset') || 0);
          const limite = url.searchParams.get('limit');
          r = r.slice(offset, limite ? offset + Number(limite) : undefined);
          return json(200, r);
        }
        if (req.method === 'POST') {
          const entrada = JSON.parse(corpo.toString());
          const novas = Array.isArray(entrada) ? entrada : [entrada];
          for (const n of novas) {
            if ((nome === 'canais' || nome === 'tipos_documento') && linhas.some((l) => l.nome === n.nome)) {
              return json(409, { code: '23505', message: 'duplicate key value violates unique constraint' });
            }
          }
          linhas.push(...novas);
          return json(201, novas);
        }
        if (req.method === 'PATCH') {
          const alvo = aplicarFiltros(linhas, url.searchParams);
          if (alvo.length === linhas.length && linhas.length > 1) return json(400, { message: 'PATCH sem filtro' });
          for (const l of alvo) Object.assign(l, JSON.parse(corpo.toString()));
          return json(200, alvo);
        }
      }

      // ---------------- Storage
      if (caminho.startsWith('/storage/v1/object/')) {
        const resto = caminho.replace('/storage/v1/object/', '');
        const assinado = resto.startsWith('sign/');
        const [bucket, ...partes] = (assinado ? resto.slice(5) : resto).split('/');
        const chave = `${bucket}/${partes.map(decodeURIComponent).join('/')}`;
        const baixar = () => {
          const f = arquivos.get(chave);
          if (!f) return json(404, { error: 'not_found' });
          res.writeHead(200, { 'Content-Type': f.mime });
          res.end(f.buffer);
        };

        if (assinado && req.method === 'POST') {
          if (req.headers.apikey !== CHAVES.servico) return json(401, { message: 'Invalid API key' });
          if (!arquivos.has(chave)) return json(404, { error: 'not_found' });
          return json(200, { signedURL: `/object/sign/${bucket}/${partes.join('/')}?token=abc123` });
        }
        if (assinado && req.method === 'GET') return baixar(); // o link assinado dispensa chave

        if (req.headers.apikey !== CHAVES.servico) return json(401, { message: 'Invalid API key' });
        if (!buckets.has(bucket)) return json(404, { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' });
        if (req.method === 'POST') {
          arquivos.set(chave, { buffer: corpo, mime: req.headers['content-type'] });
          return json(200, { Key: chave });
        }
        if (req.method === 'GET') return baixar();
        if (req.method === 'DELETE') {
          arquivos.delete(chave);
          return json(200, { message: 'Successfully deleted' });
        }
      }

      json(404, { message: 'rota do fake não implementada' });
    } catch (erro) {
      json(500, { message: erro.message });
    }
  });

  return {
    usuarios, tabelas, arquivos, buckets,
    iniciar: () => new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(`http://127.0.0.1:${servidor.address().port}`))),
    parar: () => new Promise((ok) => { servidor.closeAllConnections?.(); servidor.close(ok); }),
  };
}
