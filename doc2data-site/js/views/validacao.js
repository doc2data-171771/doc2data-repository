// Etapa 3: validação humana, individual (lado a lado) ou em lote (tabela editável).
import { LOW_CONFIDENCE } from '../config.js';
import { api } from '../api.js';
import { countByStatus, dadosFinais, docById, state } from '../store.js';
import { askText, fmtPercent, h, prettyKey, replaceChildren, statusBadge, toast, toText } from '../dom.js';
import { icon } from '../icons.js';
import { createViewer } from '../viewer.js';
import { emptyState, kpi, pageHead, topKeys } from './parts.js';

const ui = {
  mode: 'individual', // 'individual' | 'lote'
  filter: 'extraido', // 'extraido' | 'validado' | 'rejeitado'
  selectedId: null,
  edits: {}, // { idDoDocumento: { campo: textoDigitado } }
  checked: new Set(),
  working: false,
};

const FILTERS = [
  ['extraido', 'Pendentes'],
  ['validado', 'Validados'],
  ['rejeitado', 'Rejeitados'],
];

const listDocs = () => state.docs.filter((d) => d.status === ui.filter);
const isLow = (d) => d.confianca !== null && d.confianca < LOW_CONFIDENCE;

export function reset() {
  ui.checked.clear();
  Object.assign(ui, { mode: 'individual', filter: 'extraido', selectedId: null, edits: {}, working: false });
}

export function enter(options = {}) {
  if (options.docId) {
    const doc = docById(options.docId);
    ui.filter = doc?.status === 'validado' || doc?.status === 'rejeitado' ? doc.status : 'extraido';
    ui.selectedId = options.docId;
  }
}

// ---------- edição: texto digitado -> valor do JSON ----------
function setEdit(doc, key, text) {
  const base = dadosFinais(doc);
  const edits = (ui.edits[doc.id] ||= {});
  if (text === toText(base[key])) delete edits[key];
  else edits[key] = text;
  if (!Object.keys(edits).length) delete ui.edits[doc.id];
}

function parseValue(text, original, key) {
  const t = text.trim();
  if (t === '') return null;
  const isObject = original !== null && typeof original === 'object';
  if (isObject || /^[[{]/.test(t)) {
    try { return JSON.parse(t); } catch {
      if (isObject) throw new Error(`O campo "${prettyKey(key)}" precisa ser um JSON válido.`);
    }
  }
  if (typeof original === 'number' && /^-?\d+([.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  if (typeof original === 'boolean' && /^(true|false)$/i.test(t)) return t.toLowerCase() === 'true';
  return t;
}

// Junta os dados originais com o que a pessoa editou.
function collect(doc) {
  const base = dadosFinais(doc);
  const edits = ui.edits[doc.id] || {};
  const data = {};
  let changed = false;
  for (const [key, original] of Object.entries(base)) {
    if (key in edits) {
      data[key] = parseValue(edits[key], original, key);
      changed = true;
    } else {
      data[key] = original;
    }
  }
  return { data, changed };
}

async function send(doc, status, extra = {}) {
  return api.post('/validacoes', { dados_extraidos_id: doc.extraidoId, status, ...extra });
}

async function approve(doc) {
  const { data, changed } = collect(doc);
  // Se o documento já tinha uma correção, mantém os dados corrigidos na nova aprovação.
  const corrected = changed || doc.validacao?.status === 'corrigido';
  return corrected ? send(doc, 'corrigido', { dados_corrigidos: data }) : send(doc, 'aprovado');
}

// ---------- tela ----------
export function render(main, ctx) {
  const canValidate = ctx.can('validar');
  const counts = countByStatus();
  const viewer = createViewer();
  const body = h('div');

  const list = () => listDocs();
  if (!list().some((d) => d.id === ui.selectedId)) ui.selectedId = list()[0]?.id || null;

  const select = (id) => {
    ui.selectedId = id;
    const doc = docById(id);
    if (doc && viewer.current?.id !== id) viewer.show(doc);
  };

  function nextAfter(id) {
    const docs = list();
    const i = docs.findIndex((d) => d.id === id);
    return docs[i + 1] || docs[i - 1] || null;
  }

  async function afterAction(nextId) {
    ui.selectedId = nextId;
    try { await ctx.reload(); } catch (err) { toast(err.message, 'error'); }
  }

  // ----- modo individual -----
  function individual() {
    const queue = h('div', { class: 'review-queue' });
    const form = h('section', { class: 'card pad review-form' });

    function paintQueue() {
      const docs = list();
      queue.replaceChildren(...docs.map((d) => h('button', {
        class: `review-item ${d.id === ui.selectedId ? 'selected' : ''}`,
        onclick: () => { select(d.id); paintQueue(); paintForm(); },
      },
        icon('file', 15),
        h('span', { class: 'queue-info' }, h('strong', { title: d.nome }, d.nome), h('small', null, d.tipo || 'Tipo não informado')),
        isLow(d) ? h('span', { class: 'dot dot-amber', title: `Confiança ${fmtPercent(d.confianca)}` }) : null,
        ui.edits[d.id] ? h('span', { class: 'dot dot-teal', title: 'Com alterações' }) : null)));
    }

    function move(delta) {
      const docs = list();
      const i = docs.findIndex((d) => d.id === ui.selectedId);
      const next = docs[i + delta];
      if (next) { select(next.id); paintQueue(); paintForm(); }
    }

    function paintForm() {
      const doc = docById(ui.selectedId);
      if (!doc) return replaceChildren(form, emptyState('Nenhum documento neste filtro.'));
      const data = dadosFinais(doc);
      const keys = Object.keys(data);
      const missing = keys.filter((k) => data[k] === null || data[k] === '').length;

      const fields = keys.map((key) => {
        const original = data[key];
        const value = ui.edits[doc.id]?.[key] ?? toText(original);
        const long = (original !== null && typeof original === 'object') || value.length > 70 || value.includes('\n');
        const empty = original === null || original === '';
        const control = h(long ? 'textarea' : 'input', {
          class: `input ${long ? 'mono' : ''} ${ui.edits[doc.id]?.[key] !== undefined ? 'changed' : ''} ${empty ? 'missing' : ''}`,
          id: `f-${key}`, value, readOnly: !canValidate, rows: long ? 3 : null,
          oninput: (e) => { setEdit(doc, key, e.target.value); e.target.classList.toggle('changed', ui.edits[doc.id]?.[key] !== undefined); paintQueueDots(); },
        });
        return h('label', { class: 'field', for: `f-${key}` },
          h('span', { class: 'field-label' }, prettyKey(key), empty ? h('span', { class: 'hint-amber' }, ' · não encontrado, confira no documento') : null),
          control);
      });

      replaceChildren(form, 
        h('div', { class: 'form-head' },
          h('div', null, h('span', { class: 'kicker' }, 'Campos extraídos'), h('h2', { class: 'card-title' }, doc.tipo || 'Documento')),
          statusBadge(doc.status)),
        isLow(doc)
          ? h('div', { class: 'alert alert-amber' }, icon('alert', 16),
            h('div', null, h('strong', null, `Confiança baixa da IA (${fmtPercent(doc.confianca)})`), h('p', null, 'Confira todos os campos com o documento ao lado antes de aprovar.')))
          : h('div', { class: 'row small muted' }, 'Confiança da IA: ', h('strong', { class: 'mono conf-ok' }, fmtPercent(doc.confianca))),
        missing && !isLow(doc) ? h('div', { class: 'alert alert-amber' }, icon('alert', 16), h('div', null, `${missing} campo${missing > 1 ? 's' : ''} não encontrado${missing > 1 ? 's' : ''} pela IA (em amarelo).`)) : null,
        doc.status === 'rejeitado' && doc.observacao ? h('div', { class: 'alert alert-rose' }, icon('x', 16), h('div', null, h('strong', null, 'Motivo da rejeição'), h('p', null, doc.observacao))) : null,
        keys.length ? h('div', { class: 'stack' }, fields) : emptyState('A IA não extraiu nenhum campo deste documento.'),
        !canValidate ? h('p', { class: 'note' }, icon('info', 14), `O perfil "${state.user.perfil}" só visualiza. Quem valida são os perfis admin e validador.`) : null,
        h('div', { class: 'form-actions' },
          h('div', { class: 'grid grid-2' },
            h('button', { class: 'btn btn-reject', disabled: !canValidate || ui.working, onclick: () => rejectOne(doc) }, icon('x', 14), 'Rejeitar'),
            h('button', { class: 'btn btn-approve', disabled: !canValidate || ui.working || !doc.extraidoId, onclick: () => approveOne(doc) },
              icon('check', 14), ui.filter === 'extraido' ? 'Aprovar e próximo' : 'Aprovar de novo')),
          h('div', { class: 'row row-between' },
            h('button', { class: 'btn btn-ghost btn-sm', onclick: () => move(-1) }, icon('chevronLeft', 14), 'Anterior'),
            h('button', { class: 'btn btn-ghost btn-sm', onclick: () => move(1) }, 'Próximo', icon('chevronRight', 14)))));
    }

    const paintQueueDots = () => paintQueue();

    async function approveOne(doc) {
      let nextId;
      try {
        const next = nextAfter(doc.id);
        nextId = next?.id || null;
        ui.working = true; paintForm();
        await approve(doc);
        delete ui.edits[doc.id];
        toast('Documento aprovado.', 'success', 2500);
      } catch (err) {
        ui.working = false; paintForm();
        return toast(err.message, 'error', 8000);
      }
      ui.working = false;
      await afterAction(nextId);
    }

    async function rejectOne(doc) {
      const reason = await askText({ title: 'Rejeitar documento', label: 'Motivo da rejeição', placeholder: 'Ex.: imagem ilegível, documento errado…', confirmLabel: 'Rejeitar' });
      if (!reason) return;
      const nextId = nextAfter(doc.id)?.id || null;
      try {
        await send(doc, 'rejeitado', { observacao: reason });
        delete ui.edits[doc.id];
        toast('Documento rejeitado.', 'info', 2500);
      } catch (err) {
        return toast(err.message, 'error', 8000);
      }
      await afterAction(nextId);
    }

    paintQueue();
    paintForm();
    return h('div', { class: 'layout layout-validacao' },
      h('aside', { class: 'card review-side' }, h('div', { class: 'card-head' }, h('strong', null, 'Fila de revisão'), h('span', { class: 'mono small muted' }, `${list().length}`)), queue),
      viewer.el,
      form);
  }

  // ----- modo em lote -----
  function lote() {
    const docs = list();
    const keys = topKeys(docs.map(dadosFinais), 5);
    const actions = h('div', { class: 'row row-wrap' });
    const table = h('div', { class: 'table-wrap' });
    const selectedCount = () => docs.filter((d) => ui.checked.has(d.id)).length;

    function paintActions() {
      const n = selectedCount();
      replaceChildren(actions, 
        h('span', { class: 'small' }, h('strong', null, n), ' marcados'),
        h('button', { class: 'btn btn-approve btn-sm', disabled: !canValidate || !n || ui.working, onclick: approveMany }, icon('checks', 14), 'Aprovar marcados'),
        h('button', { class: 'btn btn-reject btn-sm', disabled: !canValidate || !n || ui.working, onclick: rejectMany }, icon('x', 14), 'Rejeitar'));
    }

    function paintTable() {
      if (!docs.length) return replaceChildren(table, emptyState('Nenhum documento neste filtro.'));
      const all = h('input', { type: 'checkbox', 'aria-label': 'Marcar todos', checked: docs.length > 0 && selectedCount() === docs.length, onchange: (e) => {
        docs.forEach((d) => (e.target.checked ? ui.checked.add(d.id) : ui.checked.delete(d.id)));
        paintTable(); paintActions();
      } });
      replaceChildren(table, h('table', { class: 'table table-edit' },
        h('thead', null, h('tr', null, h('th', { class: 'col-check' }, all), h('th', null, 'Arquivo'), h('th', null, 'Conf.'), keys.map((k) => h('th', null, prettyKey(k))))),
        h('tbody', null, docs.map((doc) => {
          const base = dadosFinais(doc);
          return h('tr', { class: doc.id === ui.selectedId ? 'selected' : '', onclick: (e) => { select(doc.id); table.querySelectorAll('tr.selected').forEach((r) => r.classList.remove('selected')); e.currentTarget.classList.add('selected'); } },
            h('td', { class: 'col-check', onclick: (e) => e.stopPropagation() }, h('input', { type: 'checkbox', 'aria-label': `Marcar ${doc.nome}`, checked: ui.checked.has(doc.id), onchange: (e) => {
              if (e.target.checked) ui.checked.add(doc.id); else ui.checked.delete(doc.id);
              paintActions(); all.checked = selectedCount() === docs.length;
            } })),
            h('td', { class: 'cell-strong', title: doc.nome }, doc.nome),
            h('td', null, h('span', { class: `mono small ${isLow(doc) ? 'conf-low' : 'conf-ok'}` }, fmtPercent(doc.confianca))),
            keys.map((key) => {
              if (!(key in base)) return h('td', { class: 'muted' }, '—');
              const original = base[key];
              const isObj = original !== null && typeof original === 'object';
              const value = ui.edits[doc.id]?.[key] ?? toText(original);
              return h('td', { onclick: (e) => e.stopPropagation() }, h('input', {
                class: `cell-input ${original === null || original === '' ? 'missing' : ''} ${ui.edits[doc.id]?.[key] !== undefined ? 'changed' : ''}`,
                value: isObj ? JSON.stringify(original) : value, readOnly: !canValidate || isObj, 'aria-label': `${prettyKey(key)} de ${doc.nome}`,
                oninput: (e) => { setEdit(doc, key, e.target.value); e.target.classList.toggle('changed', ui.edits[doc.id]?.[key] !== undefined); },
              }));
            }));
        }))));
    }

    async function approveMany() {
      const targets = docs.filter((d) => ui.checked.has(d.id) && d.extraidoId);
      ui.working = true; paintActions();
      let ok = 0;
      const failures = [];
      for (const doc of targets) {
        try { await approve(doc); ok++; ui.checked.delete(doc.id); delete ui.edits[doc.id]; } catch (err) { failures.push(`${doc.nome}: ${err.message}`); }
      }
      ui.working = false;
      if (ok) toast(`${ok} documento${ok > 1 ? 's aprovados' : ' aprovado'}.`, 'success');
      if (failures.length) toast(failures.join(' | '), 'error', 10000);
      await afterAction(ui.selectedId);
    }

    async function rejectMany() {
      const targets = docs.filter((d) => ui.checked.has(d.id) && d.extraidoId);
      const reason = await askText({ title: `Rejeitar ${targets.length} documento${targets.length > 1 ? 's' : ''}`, label: 'Motivo (vale para todos os marcados)', confirmLabel: 'Rejeitar' });
      if (!reason) return;
      ui.working = true; paintActions();
      let ok = 0;
      for (const doc of targets) {
        try { await send(doc, 'rejeitado', { observacao: reason }); ok++; ui.checked.delete(doc.id); } catch (err) { toast(`${doc.nome}: ${err.message}`, 'error', 8000); }
      }
      ui.working = false;
      if (ok) toast(`${ok} documento${ok > 1 ? 's rejeitados' : ' rejeitado'}.`, 'info');
      await afterAction(ui.selectedId);
    }

    paintActions();
    paintTable();
    return h('div', { class: 'layout layout-lote' },
      h('section', { class: 'card' },
        h('div', { class: 'card-head' }, h('strong', null, 'Conferência em lote'), actions),
        table,
        h('p', { class: 'table-note' }, icon('info', 13), 'Clique numa célula para corrigir. Amarelo = campo não encontrado pela IA; azul = valor alterado. Clique na linha para ver o documento.')),
      viewer.el);
  }

  // ----- montagem -----
  function paintBody() {
    replaceChildren(body, list().length
      ? (ui.mode === 'individual' ? individual() : lote())
      : h('div', { class: 'card pad' }, emptyState(ui.filter === 'extraido'
        ? 'Não há documentos aguardando validação. Leia documentos na etapa 2 para que apareçam aqui.'
        : 'Nenhum documento neste filtro.')));
    viewer.show(docById(ui.selectedId));
  }

  const modeBtn = (mode, label, iconName) =>
    h('button', { class: `seg ${ui.mode === mode ? 'active' : ''}`, onclick: (e) => {
      ui.mode = mode;
      e.currentTarget.parentElement.querySelectorAll('.seg').forEach((b) => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      paintBody();
    } }, icon(iconName, 14), label);

  main.append(
    pageHead({
      step: 3, tone: 'amber',
      kicker: 'Conferência humana (human-in-the-loop)',
      title: 'Validação dos dados extraídos',
      text: 'Compare os campos com o documento original. Aprove, corrija ou rejeite: só o que for aprovado vai para a planilha.',
      actions: [
        h('div', { class: 'segmented' }, modeBtn('individual', 'Individual', 'file'), modeBtn('lote', 'Em lote', 'table')),
        h('button', { class: 'btn btn-dark-solid', onclick: () => ctx.go(4) }, `Ir para a saída (${counts.validado})`, icon('arrowRight', 14)),
      ],
    }),
    h('div', { class: 'grid grid-4' },
      kpi('Aguardando validação', counts.extraido, { tone: 'amber' }),
      kpi('Validados', counts.validado, { tone: 'emerald' }),
      kpi('Rejeitados', counts.rejeitado, { tone: counts.rejeitado ? 'rose' : '' }),
      kpi('Baixa confiança', state.docs.filter((d) => d.status === 'extraido' && isLow(d)).length, { tone: 'amber', hint: `abaixo de ${LOW_CONFIDENCE}%` })),
    h('div', { class: 'tabs tabs-solo' }, FILTERS.map(([key, label]) =>
      h('button', { class: `tab ${ui.filter === key ? 'active' : ''}`, onclick: () => {
        ui.filter = key; ui.selectedId = null; ui.checked.clear();
        ctx.go(3);
      } }, `${label} (${counts[key]})`))),
    body);

  paintBody();
}
