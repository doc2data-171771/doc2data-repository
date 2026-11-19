// Helpers de tela: criar elementos com segurança, formatar valores, avisos e janelas.
import { STATUS } from './config.js';

const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'hidden', 'readOnly', 'multiple', 'indeterminate']);

// h('div', { class: 'x', onclick: fn }, 'texto', outroElemento)
// Todo texto entra como textContent: dados vindos dos documentos nunca viram HTML (evita XSS).
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  const deferred = [];
  for (const [key, val] of Object.entries(props || {})) {
    if (val === null || val === undefined || val === false) continue;
    if (key === 'class') el.className = val;
    else if (key === 'style' && typeof val === 'object') Object.assign(el.style, val);
    else if (key.startsWith('on') && typeof val === 'function') el.addEventListener(key.slice(2), val);
    else if (PROPS.has(key)) deferred.push([key, val]);
    else el.setAttribute(key, val === true ? '' : val);
  }
  append(el, children);
  for (const [key, val] of deferred) el[key] = val; // depois dos filhos (ex.: value de <select>)
  return el;
}

export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function replaceChildren(parent, ...children) {
  parent.replaceChildren();
  return append(parent, children);
}

// ---------- formatação ----------
export function fmtBytes(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function fmtPercent(n) {
  return n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : `${Math.round(Number(n))}%`;
}

// "nome_completo" -> "Nome completo"
export function prettyKey(key) {
  const s = String(key).replace(/[_.]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Valor do JSON -> texto do campo de edição
export function toText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

// ---------- componentes pequenos ----------
export function badge(text, tone = 'slate') {
  return h('span', { class: `badge badge-${tone}` }, text);
}

export function statusBadge(status) {
  const s = STATUS[status] || { label: status, tone: 'slate' };
  return badge(s.label, s.tone);
}

export function spinner() {
  return h('span', { class: 'spinner', role: 'status', 'aria-label': 'Carregando' });
}

export function toast(message, tone = 'info', ms = 5000) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = h('div', { class: `toast toast-${tone}`, role: tone === 'error' ? 'alert' : 'status' }, message);
  box.append(el);
  setTimeout(() => el.remove(), ms);
}

// ---------- janelas (<dialog>) ----------
function openDialog(content) {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: 'dialog' }, content);
    dialog.addEventListener('close', () => {
      const value = dialog.returnValue;
      dialog.remove();
      resolve(value);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

// Pede um texto ao usuário. Devolve o texto ou null se cancelar.
export async function askText({ title, label, confirmLabel = 'Confirmar', placeholder = '', required = true }) {
  let input;
  const form = h('form', { method: 'dialog', class: 'dialog-body' },
    h('h2', null, title),
    h('label', { class: 'field' },
      h('span', { class: 'field-label' }, label),
      (input = h('textarea', { rows: 3, placeholder, required, class: 'input' }))),
    h('div', { class: 'dialog-actions' },
      h('button', { type: 'submit', value: 'cancel', formnovalidate: true, class: 'btn btn-ghost' }, 'Cancelar'),
      h('button', { type: 'submit', value: 'ok', class: 'btn btn-danger' }, confirmLabel)));
  const result = await openDialog(form);
  if (result !== 'ok') return null;
  return input.value.trim() || null;
}

export async function showDialog(title, body) {
  const content = h('div', { class: 'dialog-body dialog-wide' },
    h('h2', null, title),
    body,
    h('form', { method: 'dialog', class: 'dialog-actions' }, h('button', { class: 'btn btn-primary' }, 'Fechar')));
  await openDialog(content);
}
