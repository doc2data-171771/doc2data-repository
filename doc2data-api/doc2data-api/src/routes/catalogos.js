// Canais (por onde o documento chegou) e Tipos de documento. As duas tabelas funcionam igual,
// então usamos a mesma função para criar as rotas das duas.

import { autenticar, exigirPerfil } from '../auth.js';
import { PERFIL_ADMIN } from '../constants.js';
import { HttpError } from '../http.js';
import { buscarPorId } from '../services/consultas.js';
import { db, eq } from '../supabase.js';
import { agora, novoId } from '../util.js';

function criarRotasDeCatalogo(router, { caminho, tabela, rotulo, maxNome, temCriadoEm }) {
  // Lista. Use ?ativo=true para trazer só os ativos (ideal para preencher um <select>).
  router.get(caminho, autenticar, async (ctx) => {
    const filtros = {};
    const ativo = ctx.query.get('ativo');
    if (ativo === 'true' || ativo === 'false') filtros.ativo = eq(ativo);
    return db.listar(tabela, { filtros, ordem: 'nome.asc' });
  });

  // Cria (só admin).
  router.post(caminho, autenticar, exigirPerfil(PERFIL_ADMIN), async (ctx) => {
    const { nome, descricao } = await ctx.json();
    const nomeLimpo = typeof nome === 'string' ? nome.trim() : '';
    if (!nomeLimpo || nomeLimpo.length > maxNome) {
      throw new HttpError(400, `"nome" é obrigatório e deve ter até ${maxNome} caracteres.`);
    }
    if (descricao !== undefined && descricao !== null && typeof descricao !== 'string') {
      throw new HttpError(400, '"descricao" deve ser texto.');
    }
    const linha = { id: novoId(), nome: nomeLimpo, descricao: descricao ?? null, ativo: true };
    if (temCriadoEm) linha.created_at = agora();
    const [criado] = await db.inserir(tabela, linha);
    ctx.status = 201;
    return criado;
  });

  // Edita nome, descrição ou ativo/inativo (só admin).
  router.patch(`${caminho}/:id`, autenticar, exigirPerfil(PERFIL_ADMIN), async (ctx) => {
    const atual = await buscarPorId(tabela, ctx.params.id, rotulo);
    const corpo = await ctx.json();
    const campos = {};

    if (corpo.nome !== undefined) {
      const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
      if (!nome || nome.length > maxNome) {
        throw new HttpError(400, `"nome" deve ter de 1 a ${maxNome} caracteres.`);
      }
      campos.nome = nome;
    }
    if (corpo.descricao !== undefined) {
      if (corpo.descricao !== null && typeof corpo.descricao !== 'string') {
        throw new HttpError(400, '"descricao" deve ser texto.');
      }
      campos.descricao = corpo.descricao;
    }
    if (corpo.ativo !== undefined) {
      if (typeof corpo.ativo !== 'boolean') throw new HttpError(400, '"ativo" deve ser true ou false.');
      campos.ativo = corpo.ativo;
    }
    if (Object.keys(campos).length === 0) {
      throw new HttpError(400, 'Envie ao menos um campo para alterar: nome, descricao ou ativo.');
    }

    const [atualizado] = await db.atualizar(tabela, { id: eq(atual.id) }, campos);
    return atualizado;
  });
}

export default function rotasCatalogos(router) {
  criarRotasDeCatalogo(router, {
    caminho: '/canais',
    tabela: 'canais',
    rotulo: 'Canal',
    maxNome: 30,
    temCriadoEm: true,
  });
  criarRotasDeCatalogo(router, {
    caminho: '/tipos-documento',
    tabela: 'tipos_documento',
    rotulo: 'Tipo de documento',
    maxNome: 80,
    temCriadoEm: false,
  });
}
