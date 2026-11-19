// Etapa 2: leitura dos documentos pela IA.
import { LOW_CONFIDENCE } from '../config.js';
import { api } from '../api.js';
import { countByStatus, docById, state } from '../store.js';
import { badge, fmtBytes, fmtPercent, h, prettyKey, replaceChildren, spinner, statusBadge, toast, toText } from '../dom.js';
import { icon } from '../icons.js';
import { emptyState, kpi, pageHead } from './parts.js';

const ui = {
  filter: 'ALL',
  selectedId: null,
  busy: new Set(),
  running: false,
  stop: false,
  progress: { done: 0, total: 0 },
};

const FILTERS = [
  ['ALL', 'Todos', () => true],
  ['PENDENTE', 'Aguardando', (d) => d.status === 'recebido' || d.status === 'processando'],
  ['ERRO', 'Com erro', (d) => d.status === 'erro'],
  ['LIDO', 'Lidos', (d) => ['extraido', 'validado', 'rejeitado'].includes(d.status)],
  ['BAIXA', 'Baixa confiança', (d) => d.confianca !== null && d.confianca < LOW_CONFIDENCE],
];

// Documentos que ainda precisam (ou podem) ser lidos pela IA
const toProcess = () => state.docs.filter((d) => ['recebido', 'erro', 'processando'].includes(d.status));

export function reset() {
  ui.busy.clear();
  Object.assign(ui, { filter: 'ALL', selectedId: null, running: false, stop: false, progress: { done: 0, total: 0 } });
}

export function enter(options = {}) {
  if (options.docId) ui.selectedId = options.docId;
}

export function render(main, ctx) {
  const counts = countByStatus();
  const read = counts.extraido + counts.validado + counts.rejeitado;
  const canProcess = ctx.can('processar');
  const queue = toProcess();

  const grid = h('div', { class: 'cards-grid' });
  const inspector = h('aside', { class: 'card pad inspector' });
  const progress = h('div', { class: 'progress-wrap' });

  function paint() {
    const test = FILTERS.find((f) => f[0] === ui.filter)[2];
    const docs = state.docs.filter(test);
    grid.replaceChildren(...(docs.length ? docs.map(card) : [emptyState('Nenhum documento neste filtro.')]));
    paintInspector();
    paintProgress();
  }

  function card(doc) {
    const busy = ui.busy.has(doc.id);
    const low = doc.confianca !== null && doc.confianca < LOW_CONFIDENCE;
    return h('article', {
      class: `doc-card ${doc.id === ui.selectedId ? 'selected' : ''}`, tabindex: 0,
      onclick: () => { ui.selectedId = doc.id; paint(); },
      onkeydown: (e) => { if (e.key === 'Enter') { ui.selectedId = doc.id; paint(); } },
    },
      h('div', { class: 'doc-card-top' }, icon('file', 16), h('strong', { title: doc.nome }, doc.nome)),
      h('small', { class: 'muted' }, [doc.tipo || 'Tipo não informado', fmtBytes(doc.tamanho)].join(' · ')),
      h('div', { class: 'row row-between' },
        busy ? badge('Lendo com IA…', 'sky') : statusBadge(doc.status),
        doc.confianca !== null ? h('span', { class: `mono conf ${low ? 'conf-low' : 'conf-ok'}` }, fmtPercent(doc.confianca)) : null),
      busy ? h('div', { class: 'row small muted' }, spinner(), 'Isso pode levar até 1 minuto') : null);
  }

  function paintInspector() {
    const doc = docById(ui.selectedId);
    if (!doc) {
      return replaceChildren(inspector, h('h2', { class: 'card-title' }, 'Detalhes'), emptyState('Clique em um documento para ver os detalhes.'));
    }
    const needsRead = ['recebido', 'erro', 'processando'].includes(doc.status);
    replaceChildren(inspector, 
      h('h2', { class: 'card-title' }, 'Detalhes'),
      h('strong', { class: 'break' }, doc.nome),
      h('div', { class: 'row' }, statusBadge(doc.status), doc.confianca !== null ? h('span', { class: 'mono small' }, `confiança ${fmtPercent(doc.confianca)}`) : null),
      doc.erro ? h('p', { class: 'form-error' }, `A última leitura falhou: ${doc.erro}`) : null,
      doc.dados
        ? h('dl', { class: 'kv' }, Object.entries(doc.dados).map(([k, v]) =>
          [h('dt', null, prettyKey(k)), h('dd', { class: v === null ? 'kv-null' : '' }, v === null ? 'não encontrado' : toText(v))]))
        : null,
      needsRead && canProcess
        ? h('button', { class: 'btn btn-primary btn-block', disabled: ui.busy.has(doc.id) || ui.running, onclick: () => run(ctx, [doc], paint) },
          icon('zap', 14), doc.status === 'erro' ? 'Tentar ler de novo' : 'Ler com IA')
        : null,
      doc.status === 'extraido'
        ? h('button', { class: 'btn btn-amber btn-block', onclick: () => ctx.go(3, { docId: doc.id }) }, 'Conferir na validação', icon('arrowRight', 14))
        : null);
  }

  function paintProgress() {
    const total = state.docs.length || 1;
    const pct = Math.round((read / total) * 100);
    const running = ui.running ? ` · lendo ${ui.progress.done + 1} de ${ui.progress.total}` : '';
    replaceChildren(progress, 
      h('div', { class: 'row row-between small' }, h('strong', null, `${read} de ${state.docs.length} documentos lidos${running}`), h('span', { class: 'mono' }, `${pct}%`)),
      h('div', { class: 'progress' }, h('div', { class: 'progress-bar', style: { width: `${pct}%` } })));
  }

  const startAll = h('button', {
    class: 'btn btn-primary', disabled: !canProcess || !queue.length || ui.running,
    title: canProcess ? '' : 'Seu perfil não processa documentos',
    onclick: () => run(ctx, toProcess(), paint),
  }, icon('zap', 14), ui.running ? 'Lendo…' : `Ler todos pendentes (${queue.length})`);

  main.append(
    pageHead({
      step: 2,
      kicker: 'Leitura automática com IA',
      title: 'Leitura e extração de dados',
      text: 'A IA lê cada documento e extrai os campos em formato estruturado, com um nível de confiança geral.',
      actions: [
        startAll,
        ui.running ? h('button', { class: 'btn btn-ghost', onclick: () => { ui.stop = true; toast('A leitura vai parar depois do documento atual.'); } }, 'Parar') : null,
        h('button', { class: 'btn btn-dark-solid', onclick: () => ctx.go(3) }, 'Ir para a validação', icon('arrowRight', 14)),
      ],
    }),
    h('div', { class: 'grid grid-4' },
      kpi('Aguardando leitura', counts.recebido + counts.processando, { tone: 'sky' }),
      kpi('Com erro', counts.erro, { tone: counts.erro ? 'rose' : '' }),
      kpi('Lidos pela IA', read, { tone: 'emerald' }),
      kpi('Baixa confiança', state.docs.filter((d) => d.confianca !== null && d.confianca < LOW_CONFIDENCE).length, { tone: 'amber', hint: `abaixo de ${LOW_CONFIDENCE}%` })),
    h('div', { class: 'card pad toolbar' },
      h('div', { class: 'tabs' }, FILTERS.map(([key, label, test]) =>
        h('button', { class: `tab ${ui.filter === key ? 'active' : ''}`, onclick: (e) => {
          ui.filter = key;
          e.currentTarget.parentElement.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
          e.currentTarget.classList.add('active');
          paint();
        } }, `${label} (${state.docs.filter(test).length})`))),
      progress),
    h('div', { class: 'layout layout-processamento' }, grid, inspector));

  paint();
}

// Processa os documentos em sequência (a API lê um por vez).
async function run(ctx, docs, paint) {
  if (ui.running || !docs.length) return;
  ui.running = true;
  ui.stop = false;
  ui.progress = { done: 0, total: docs.length };
  let ok = 0;
  let failed = 0;

  for (const doc of docs) {
    if (ui.stop) break;
    ui.busy.add(doc.id);
    paint();
    try {
      await api.post(`/documentos/${doc.id}/processar`, {});
      ok++;
    } catch (err) {
      failed++;
      if (err.status === 401) break;
      toast(`${doc.nome}: ${err.message}`, 'error', 7000);
    }
    ui.busy.delete(doc.id);
    ui.progress.done++;
  }

  ui.running = false;
  ui.busy.clear();
  if (ok) toast(`${ok} documento${ok > 1 ? 's lidos' : ' lido'} com sucesso.`, 'success');
  if (failed && !ok) toast('Nenhum documento foi lido. Veja os avisos.', 'error');
  try { await ctx.reload(); } catch (err) { toast(err.message, 'error'); }
}
