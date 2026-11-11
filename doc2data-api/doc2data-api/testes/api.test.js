// Testes de ponta a ponta: sobe a API de verdade, conversa com um Supabase simulado
// e percorre o fluxo inteiro (login -> upload -> leitura -> validação -> planilha).
// Rode com:  npm test

import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { CHAVES, criarFakeSupabase } from './fake-supabase.js';

const fake = criarFakeSupabase();
let servidorApi;
let base;
let tokenAdmin;
let tokenOperador;

// Um PDF mínimo (só o começo "%PDF-" já basta para a API reconhecer).
const pdf = (texto = 'a') => new Blob([`%PDF-1.4\n% ${texto}\n%%EOF`], { type: 'application/pdf' });

async function api(metodo, caminho, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  if (form) body = form;
  const r = await fetch(`${base}${caminho}`, { method: metodo, headers, body });
  const texto = await r.text();
  let dados;
  try { dados = texto ? JSON.parse(texto) : undefined; } catch { dados = texto; }
  return { status: r.status, dados, headers: r.headers, texto };
}

async function esperarStatus(id, esperado) {
  for (let i = 0; i < 60; i += 1) {
    const r = await api('GET', `/documentos/${id}`, { token: tokenOperador });
    if (r.dados.documento.status === esperado) return r.dados;
    await new Promise((ok) => setTimeout(ok, 50));
  }
  throw new Error(`Documento ${id} não chegou ao status "${esperado}"`);
}

before(async () => {
  const urlFake = await fake.iniciar();
  Object.assign(process.env, {
    NODE_ENV: 'test',
    SUPABASE_URL: urlFake,
    SUPABASE_ANON_KEY: CHAVES.anon,
    SUPABASE_SERVICE_KEY: CHAVES.servico,
    FRONTEND_URL: 'http://meu-front.test',
    EXTRATOR_ATRASO_MS: '30',
    MAX_ARQUIVO_MB: '1',
    MAX_ARQUIVOS_POR_ENVIO: '3',
  });
  const { criarServidor } = await import('../src/app.js'); // importa DEPOIS de configurar o ambiente
  servidorApi = criarServidor();
  await new Promise((ok) => servidorApi.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${servidorApi.address().port}`;
});

after(async () => {
  servidorApi.closeAllConnections?.();
  await new Promise((ok) => servidorApi.close(ok));
  await fake.parar();
});

describe('básico e segurança', () => {
  it('responde /saude', async () => {
    const r = await api('GET', '/saude');
    assert.equal(r.status, 200);
    assert.deepEqual(r.dados, { ok: true });
  });

  it('rota inexistente dá 404 e método errado dá 405', async () => {
    assert.equal((await api('GET', '/nao-existe')).status, 404);
    assert.equal((await api('POST', '/saude')).status, 405);
  });

  it('CORS: libera só o front configurado', async () => {
    const r = await fetch(`${base}/saude`, { method: 'OPTIONS', headers: { Origin: 'http://meu-front.test' } });
    assert.equal(r.status, 204);
    assert.equal(r.headers.get('access-control-allow-origin'), 'http://meu-front.test');
    const outro = await fetch(`${base}/saude`, { method: 'OPTIONS', headers: { Origin: 'http://invasor.test' } });
    assert.equal(outro.headers.get('access-control-allow-origin'), null);
  });

  it('rotas protegidas recusam quem não fez login', async () => {
    assert.equal((await api('GET', '/documentos')).status, 401);
    assert.equal((await api('GET', '/documentos', { token: 'token-falso' })).status, 401);
  });
});

describe('login', () => {
  it('recusa senha errada, usuário inativo e usuário sem perfil', async () => {
    assert.equal((await api('POST', '/auth/login', { json: { email: 'admin@teste.com', senha: 'errada' } })).status, 401);
    assert.equal((await api('POST', '/auth/login', { json: { email: 'inativo@teste.com', senha: 'senha123' } })).status, 403);
    assert.equal((await api('POST', '/auth/login', { json: { email: 'semperfil@teste.com', senha: 'senha123' } })).status, 403);
    assert.equal((await api('POST', '/auth/login', { json: {} })).status, 400);
  });

  it('entrega o token e nunca vaza a chave secreta', async () => {
    const admin = await api('POST', '/auth/login', { json: { email: 'admin@teste.com', senha: 'senha123' } });
    assert.equal(admin.status, 200);
    assert.ok(admin.dados.access_token);
    assert.equal(admin.dados.usuario.perfil, 'admin');
    assert.ok(!admin.texto.includes(CHAVES.servico));
    tokenAdmin = admin.dados.access_token;

    const op = await api('POST', '/auth/login', { json: { email: 'operador@teste.com', senha: 'senha123' } });
    tokenOperador = op.dados.access_token;

    const me = await api('GET', '/auth/me', { token: tokenOperador });
    assert.equal(me.dados.usuario.nome, 'Otávio Operador');

    const refresh = await api('POST', '/auth/refresh', { json: { refresh_token: op.dados.refresh_token } });
    assert.equal(refresh.status, 200);
    assert.ok(refresh.dados.access_token);
  });
});

describe('canais e tipos de documento', () => {
  it('só admin cria; duplicado dá 409; lista e edita', async () => {
    const negado = await api('POST', '/canais', { token: tokenOperador, json: { nome: 'E-mail' } });
    assert.equal(negado.status, 403);

    const criado = await api('POST', '/canais', { token: tokenAdmin, json: { nome: 'E-mail', descricao: 'Recebido por e-mail' } });
    assert.equal(criado.status, 201);
    assert.equal(criado.dados.ativo, true);

    assert.equal((await api('POST', '/canais', { token: tokenAdmin, json: { nome: 'E-mail' } })).status, 409);
    assert.equal((await api('POST', '/canais', { token: tokenAdmin, json: { nome: 'x'.repeat(31) } })).status, 400);

    const tipo = await api('POST', '/tipos-documento', { token: tokenAdmin, json: { nome: 'Nota fiscal' } });
    assert.equal(tipo.status, 201);

    const lista = await api('GET', '/canais?ativo=true', { token: tokenOperador });
    assert.equal(lista.dados.length, 1);

    const edit = await api('PATCH', `/canais/${criado.dados.id}`, { token: tokenAdmin, json: { ativo: false } });
    assert.equal(edit.dados.ativo, false);
    assert.equal((await api('GET', '/canais?ativo=true', { token: tokenOperador })).dados.length, 0);

    await api('PATCH', `/canais/${criado.dados.id}`, { token: tokenAdmin, json: { ativo: true } });
  });
});

describe('fluxo do documento', () => {
  let canalId;
  let tipoId;
  let docId;

  before(() => {
    canalId = fake.tabelas.canais[0].id;
    tipoId = fake.tabelas.tipos_documento[0].id;
  });

  it('upload recusa: sem arquivo, tipo falso, vazio, grande demais, canal inexistente', async () => {
    let f = new FormData();
    assert.equal((await api('POST', '/documentos', { token: tokenOperador, form: f })).status, 400);

    f = new FormData();
    f.append('arquivo', new Blob(['isto é texto, não PDF'], { type: 'application/pdf' }), 'falso.pdf');
    const falso = await api('POST', '/documentos', { token: tokenOperador, form: f });
    assert.equal(falso.status, 415);

    f = new FormData();
    f.append('arquivo', new Blob([], { type: 'application/pdf' }), 'vazio.pdf');
    assert.equal((await api('POST', '/documentos', { token: tokenOperador, form: f })).status, 400);

    f = new FormData();
    f.append('arquivo', new Blob(['%PDF-' + 'x'.repeat(1024 * 1024)], { type: 'application/pdf' }), 'grande.pdf');
    assert.equal((await api('POST', '/documentos', { token: tokenOperador, form: f })).status, 413);

    f = new FormData();
    f.append('arquivo', pdf(), 'ok.pdf');
    f.append('canal_id', '00000000-0000-4000-8000-000000000000');
    assert.equal((await api('POST', '/documentos', { token: tokenOperador, form: f })).status, 400);

    f = new FormData();
    f.append('arquivo', pdf(), 'ok.pdf');
    f.append('canal_id', 'nao-e-uuid');
    assert.equal((await api('POST', '/documentos', { token: tokenOperador, form: f })).status, 400);

    // nada foi salvo por engano
    assert.equal(fake.tabelas.documentos.length, 0);
    assert.equal(fake.arquivos.size, 0);
  });

  it('upload em lote salva arquivos e linhas (nome com acento incluso)', async () => {
    const f = new FormData();
    f.append('arquivos', pdf('1'), 'Relatório março.pdf');
    f.append('arquivos', pdf('2'), 'segundo.pdf');
    f.append('canal_id', canalId);
    f.append('tipo_documento_id', tipoId);
    const r = await api('POST', '/documentos', { token: tokenOperador, form: f });
    assert.equal(r.status, 201);
    assert.equal(r.dados.documentos.length, 2);
    assert.equal(r.dados.falhas.length, 0);
    const doc = r.dados.documentos[0];
    assert.equal(doc.status, 'recebido');
    assert.equal(doc.mime_type, 'application/pdf');
    assert.equal(doc.enviado_por, fake.usuarios[1].id);
    assert.match(doc.caminho_arquivo, /^\d{4}\/\d{2}\/[0-9a-f-]{36}-Relatorio_marco\.pdf$/);
    assert.equal(fake.arquivos.size, 2);

    const lista = await api('GET', '/documentos?status=recebido', { token: tokenOperador });
    assert.equal(lista.dados.length, 2);
    assert.equal((await api('GET', '/documentos?canal_id=abc', { token: tokenOperador })).status, 400);

    // limite de arquivos por envio (3 neste teste)
    const muitos = new FormData();
    for (let i = 0; i < 4; i += 1) muitos.append('arquivos', pdf(String(i)), `a${i}.pdf`);
    assert.equal((await api('POST', '/documentos', { token: tokenOperador, form: muitos })).status, 400);
  });

  it('upload com processar=true lê o documento em segundo plano', async () => {
    const f = new FormData();
    f.append('arquivo', pdf('nota'), 'nota-fiscal.pdf');
    f.append('canal_id', canalId);
    f.append('tipo_documento_id', tipoId);
    f.append('processar', 'true');
    const r = await api('POST', '/documentos', { token: tokenOperador, form: f });
    assert.equal(r.status, 201);
    docId = r.dados.documentos[0].id;
    assert.equal(r.dados.documentos[0].status, 'processando');

    const detalhe = await esperarStatus(docId, 'processado');
    assert.equal(detalhe.processamentos.length, 1);
    assert.equal(detalhe.processamentos[0].status, 'concluido');
    assert.equal(detalhe.processamentos[0].ferramenta, 'simulado');
    assert.ok(detalhe.processamentos[0].finalizado_em);
    assert.equal(detalhe.dados_extraidos.dados.tipo_documento, 'Nota fiscal');
    assert.deepEqual(detalhe.validacoes, []);
  });

  it('não deixa processar duas vezes ao mesmo tempo, mas permite reprocessar depois', async () => {
    const f = new FormData();
    f.append('arquivo', pdf('dupla'), 'dupla.pdf');
    f.append('processar', 'true');
    const criado = await api('POST', '/documentos', { token: tokenOperador, form: f });
    const id = criado.dados.documentos[0].id;

    assert.equal((await api('POST', `/documentos/${id}/processar`, { token: tokenOperador })).status, 409);
    await esperarStatus(id, 'processado');

    const refazer = await api('POST', `/documentos/${id}/processar`, { token: tokenOperador });
    assert.equal(refazer.status, 202);
    await esperarStatus(id, 'processado');
    const hist = await api('GET', `/documentos/${id}/processamentos`, { token: tokenOperador });
    assert.equal(hist.dados.length, 2);
  });

  it('documento recebido (não lido) ainda não pode ser validado nem exportado', async () => {
    const naoLido = fake.tabelas.documentos.find((d) => d.status === 'recebido');
    const exp = await api('POST', '/exportacoes', { token: tokenOperador, json: { documento_ids: [naoLido.id] } });
    assert.equal(exp.status, 409);
  });

  it('gera o link temporário do arquivo original', async () => {
    const r = await api('GET', `/documentos/${docId}/arquivo`, { token: tokenOperador });
    assert.equal(r.status, 200);
    const baixado = await fetch(r.dados.url);
    assert.equal(baixado.status, 200);
    assert.match(await baixado.text(), /^%PDF-/);
  });

  it('validação: confere regras e atualiza o status do documento', async () => {
    const { dados_extraidos: dado } = (await api('GET', `/documentos/${docId}`, { token: tokenOperador })).dados;
    const rota = `/dados-extraidos/${dado.id}/validacoes`;

    assert.equal((await api('POST', rota, { token: tokenOperador, json: { status: 'talvez' } })).status, 400);
    assert.equal((await api('POST', rota, { token: tokenOperador, json: { status: 'corrigido' } })).status, 400);
    assert.equal((await api('POST', rota, { token: tokenOperador, json: { status: 'aprovado', dados_corrigidos: { a: 1 } } })).status, 400);

    const ok = await api('POST', rota, {
      token: tokenOperador,
      json: {
        status: 'corrigido',
        dados_corrigidos: { cliente: 'Maria; "Silva"', valor: 10.5, numero_documento: '=CMD()', endereco: { cidade: 'São Paulo' } },
        observacao: 'Corrigi cliente e valor',
      },
    });
    assert.equal(ok.status, 201);
    assert.equal(ok.dados.documento_status, 'validado');
    assert.equal(ok.dados.validacao.usuario_id, fake.usuarios[1].id);

    const det = await api('GET', `/dados-extraidos/${dado.id}`, { token: tokenOperador });
    assert.equal(det.dados.validacoes.length, 1);
  });

  it('exportação: gera CSV com os dados corrigidos e marca os documentos como exportados', async () => {
    const r = await api('POST', '/exportacoes', { token: tokenOperador, json: { documento_ids: [docId] } });
    assert.equal(r.status, 201, r.texto);
    assert.equal(r.dados.total_documentos, 1);
    assert.equal(r.dados.exportacao.status, 'concluido');
    assert.equal(fake.tabelas.exportacao_documentos.length, 1);
    assert.equal(fake.tabelas.documentos.find((d) => d.id === docId).status, 'exportado');

    const link = await api('GET', `/exportacoes/${r.dados.exportacao.id}/arquivo`, { token: tokenOperador });
    assert.match(link.dados.nome_arquivo, /^exportacao-\d{4}-\d{2}-\d{2}\.csv$/);
    // Lemos os bytes crus: o fetch().text() esconderia o BOM, e queremos conferir que ele existe.
    const bytes = Buffer.from(await (await fetch(link.dados.url)).arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'CSV começa com BOM UTF-8');
    const csv = bytes.toString('utf8');

    assert.ok(csv.startsWith('﻿arquivo;tipo_documento;canal;data_envio;status_validacao;'));
    const [cabecalho, linha] = csv.trim().split('\r\n');
    assert.ok(cabecalho.includes('endereco.cidade'));
    assert.match(linha, /^nota-fiscal\.pdf;Nota fiscal;E-mail;/);
    assert.ok(linha.includes('"Maria; ""Silva"""'), 'aspas e ponto e vírgula escapados');
    assert.ok(linha.includes(';10,5;'), 'decimal com vírgula');
    assert.ok(linha.includes("'=CMD()"), 'fórmula neutralizada');
    assert.ok(linha.includes('São Paulo'));

    const det = await api('GET', `/exportacoes/${r.dados.exportacao.id}`, { token: tokenOperador });
    assert.deepEqual(det.dados.documento_ids, [docId]);
    assert.equal((await api('GET', '/exportacoes', { token: tokenOperador })).dados.length, 1);
  });

  it('exportação recusa formato não suportado, ids inválidos e documentos inexistentes', async () => {
    assert.equal((await api('POST', '/exportacoes', { token: tokenOperador, json: { documento_ids: [docId], formato: 'xlsx' } })).status, 400);
    assert.equal((await api('POST', '/exportacoes', { token: tokenOperador, json: { documento_ids: ['x'] } })).status, 400);
    assert.equal((await api('POST', '/exportacoes', { token: tokenOperador, json: { documento_ids: [] } })).status, 400);
    assert.equal((await api('POST', '/exportacoes', { token: tokenOperador, json: { documento_ids: ['00000000-0000-4000-8000-000000000000'] } })).status, 404);
  });

  it('rejeitar um documento muda o status para "rejeitado"', async () => {
    const outro = fake.tabelas.documentos.find((d) => d.status === 'processado');
    const detalhe = (await api('GET', `/documentos/${outro.id}`, { token: tokenOperador })).dados;
    const r = await api('POST', `/dados-extraidos/${detalhe.dados_extraidos.id}/validacoes`, {
      token: tokenOperador,
      json: { status: 'rejeitado', observacao: 'Ilegível' },
    });
    assert.equal(r.dados.documento_status, 'rejeitado');
    const exp = await api('POST', '/exportacoes', { token: tokenOperador, json: { documento_ids: [outro.id] } });
    assert.equal(exp.status, 409);
  });

  it('erro na leitura marca documento e processamento como "erro"', async () => {
    const f = new FormData();
    f.append('arquivo', pdf('vai-falhar'), 'vai-falhar.pdf');
    const criado = await api('POST', '/documentos', { token: tokenOperador, form: f });
    const doc = criado.dados.documentos[0];
    fake.arquivos.delete(`documentos/${doc.caminho_arquivo}`); // some com o arquivo no Storage
    await api('POST', `/documentos/${doc.id}/processar`, { token: tokenOperador });
    const detalhe = await esperarStatus(doc.id, 'erro');
    assert.equal(detalhe.processamentos[0].status, 'erro');
    assert.ok(detalhe.processamentos[0].erro);
  });

  it('bucket inexistente gera mensagem clara e não deixa linha órfã', async () => {
    fake.buckets.delete('documentos');
    const antes = fake.tabelas.documentos.length;
    const f = new FormData();
    f.append('arquivo', pdf('b'), 'b.pdf');
    const r = await api('POST', '/documentos', { token: tokenOperador, form: f });
    assert.equal(r.status, 500);
    assert.match(r.dados.erro, /bucket "documentos"/);
    assert.equal(fake.tabelas.documentos.length, antes);
    fake.buckets.add('documentos');
  });
});

describe('modo Vercel', () => {
  it('lê o documento ANTES de responder (a função congela depois da resposta)', async () => {
    process.env.VERCEL = '1';
    try {
      const f = new FormData();
      f.append('arquivo', pdf('vercel'), 'vercel.pdf');
      f.append('processar', 'true');
      const r = await api('POST', '/documentos', { token: tokenOperador, form: f });
      assert.equal(r.status, 201);
      assert.equal(r.dados.documentos[0].status, 'processado', 'já volta pronto, sem precisar esperar');

      const id = r.dados.documentos[0].id;
      const refazer = await api('POST', `/documentos/${id}/processar`, { token: tokenOperador });
      assert.equal(refazer.status, 202);
      assert.equal(refazer.dados.processamento.status, 'concluido');
      assert.equal(refazer.dados.documento.status, 'processado');
    } finally {
      delete process.env.VERCEL;
    }
  });

  it('api/index.js responde e avisa claramente quando faltam variáveis', async () => {
    const { default: handler } = await import('../api/index.js');
    const srv = http.createServer(handler);
    await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
    const url = `http://127.0.0.1:${srv.address().port}`;
    const guardado = process.env.SUPABASE_URL;
    try {
      const ok = await fetch(`${url}/saude`);
      assert.equal(ok.status, 200);
      assert.deepEqual(await ok.json(), { ok: true });
      assert.equal((await fetch(`${url}/`)).status, 200);

      delete process.env.SUPABASE_URL;
      const falta = await fetch(`${url}/saude`, { headers: { Origin: 'http://meu-front.test' } });
      assert.equal(falta.status, 500);
      assert.match((await falta.json()).erro, /SUPABASE_URL/);
      assert.equal(falta.headers.get('access-control-allow-origin'), 'http://meu-front.test');
    } finally {
      process.env.SUPABASE_URL = guardado;
      srv.closeAllConnections?.();
      await new Promise((ok) => srv.close(ok));
    }
  });
});
