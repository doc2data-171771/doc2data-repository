// Pedaços de tela usados em mais de uma etapa.
import { h } from '../dom.js';

export function pageHead({ step, tone = 'teal', kicker, title, text, actions = [] }) {
  return h('div', { class: 'card page-head' },
    h('div', null,
      h('div', { class: 'row' },
        h('span', { class: `step-pill step-pill-${tone}` }, `Etapa ${step} de 4`),
        h('span', { class: 'muted small' }, kicker)),
      h('h1', null, title),
      h('p', { class: 'muted' }, text)),
    h('div', { class: 'row row-wrap' }, actions));
}

export function kpi(label, value, { tone = '', hint = '' } = {}) {
  return h('div', { class: `card kpi ${tone ? `kpi-${tone}` : ''}` },
    h('span', { class: 'kpi-label' }, label),
    h('strong', { class: 'kpi-value' }, value),
    hint ? h('span', { class: 'kpi-hint' }, hint) : null);
}

export function emptyState(text) {
  return h('p', { class: 'empty' }, text);
}

// Executa worker(item) para cada item, com no máximo `limit` ao mesmo tempo.
export async function pool(items, limit, worker) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) await worker(queue.shift());
    })
  );
}

// Colunas (chaves do JSON) mais frequentes entre os documentos, em ordem de frequência.
export function topKeys(rows, max) {
  const freq = new Map();
  rows.forEach((row) => Object.keys(row).forEach((k) => freq.set(k, (freq.get(k) || 0) + 1)));
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([k]) => k);
}
