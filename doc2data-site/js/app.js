// Ponto de entrada: decide entre login e sistema, monta o topo e troca de etapa.
import { BRAND } from './config.js';
import { clearSession, getSession, setOnSessionExpired } from './api.js';
import { state, can, countByStatus, loadAll, loadUser } from './store.js';
import { h, replaceChildren, showDialog, spinner, toast } from './dom.js';
import { icon } from './icons.js';
import { clearViewerCache } from './viewer.js';
import { renderLogin } from './views/login.js';
import * as entrada from './views/entrada.js';
import * as processamento from './views/processamento.js';
import * as validacao from './views/validacao.js';
import * as saida from './views/saida.js';

const root = document.getElementById('app');
document.title = `Central de Documentos · ${BRAND}`;

const STEPS = [
  { view: entrada, title: 'Entrada', sub: 'Upload e fila', count: (c) => c.total },
  { view: processamento, title: 'Leitura com IA', sub: 'Extração automática', count: (c) => c.recebido + c.processando + c.erro },
  { view: validacao, title: 'Validação humana', sub: 'Conferência dos dados', count: (c) => c.extraido },
  { view: saida, title: 'Saída', sub: 'Planilha (.xlsx / CSV)', count: (c) => c.validado },
];

let step = 1;
let main = null;
let stepButtons = [];

export const ctx = { state, can, go, reload };

// ---------- navegação ----------
function go(n, options) {
  step = n;
  history.replaceState(null, '', `#etapa-${n}`);
  STEPS[n - 1].view.enter?.(options);
  paintStepper();
  renderStep();
  window.scrollTo({ top: 0 });
}

function renderStep() {
  main.replaceChildren();
  try {
    STEPS[step - 1].view.render(main, ctx);
  } catch (err) {
    console.error(err);
    main.replaceChildren(h('div', { class: 'card pad' }, h('p', { class: 'form-error' }, `Erro ao montar a tela: ${err.message}`)));
  }
}

export async function reload() {
  await loadAll();
  paintStepper();
  renderStep();
}

function paintStepper() {
  const counts = countByStatus();
  STEPS.forEach((s, i) => {
    const btn = stepButtons[i];
    btn.classList.toggle('active', i + 1 === step);
    btn.querySelector('.step-count').textContent = s.count(counts);
  });
}

// ---------- telas ----------
function showLogin(notice = '') {
  STEPS.forEach((s) => s.view.reset?.());
  clearViewerCache();
  state.user = null;
  state.docs = [];
  renderLogin(root, { onLogin: enterApp, notice });
}

function logout() {
  clearSession(); // a API não tem "logout": basta esquecer o token neste navegador
  showLogin();
}

function aboutDialog() {
  const item = (n, title, text) => h('li', null, h('span', { class: 'step-num' }, n), h('div', null, h('strong', null, title), h('p', null, text)));
  showDialog('Sobre o MVP',
    h('div', { class: 'about' },
      h('p', null, 'Hoje a equipe financeira abre arquivo por arquivo (PDFs, fotos, anexos), lê os dados e digita tudo em planilhas. Este MVP transforma documentos desestruturados em dados estruturados, com leitura por IA e conferência humana.'),
      h('ol', { class: 'about-steps' },
        item(1, 'Entrada', 'Upload de documentos, um a um ou em lote.'),
        item(2, 'Leitura com IA', 'Classificação e extração dos campos, com nível de confiança.'),
        item(3, 'Validação humana', 'Conferência individual ou em lote antes de aprovar.'),
        item(4, 'Saída', 'Exportação dos dados aprovados para .xlsx ou CSV.'))));
}

function renderShell() {
  main = h('main', { class: 'container main' });
  stepButtons = STEPS.map((s, i) =>
    h('button', { type: 'button', class: 'step-tab', onclick: () => go(i + 1) },
      h('span', { class: 'step-num' }, i + 1),
      h('span', { class: 'step-text' }, h('strong', null, s.title), h('small', null, s.sub)),
      h('span', { class: 'step-count mono' }, '0')));

  const initials = (state.user.nome || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  replaceChildren(root,
    h('header', { class: 'topbar' },
      h('div', { class: 'container topbar-row' },
        h('div', { class: 'brand' },
          h('span', { class: 'brand-mark' }, icon('file', 18)),
          h('div', null, h('strong', { class: 'brand-name' }, BRAND), h('small', null, 'Central de Documentos'))),
        h('div', { class: 'topbar-actions' },
          h('button', { type: 'button', class: 'btn btn-dark btn-sm', onclick: aboutDialog }, icon('info', 14), h('span', null, 'Sobre o MVP')),
          h('button', { type: 'button', class: 'btn btn-dark btn-sm', title: 'Atualizar dados', onclick: refreshClick }, icon('refresh', 14)),
          h('div', { class: 'user-chip' },
            h('span', { class: 'avatar' }, initials),
            h('div', { class: 'user-text' }, h('strong', null, state.user.nome), h('small', null, state.user.perfil)),
            h('button', { type: 'button', class: 'icon-btn icon-btn-light', title: 'Sair', onclick: logout }, icon('logout', 16))))),
      h('nav', { class: 'stepper', 'aria-label': 'Etapas' }, h('div', { class: 'container stepper-row' }, stepButtons))),
    main);
}

async function refreshClick(event) {
  const btn = event.currentTarget;
  btn.disabled = true;
  try {
    await reload();
    toast('Dados atualizados.', 'success', 2500);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function enterApp() {
  replaceChildren(root, h('div', { class: 'boot' }, spinner(), 'Carregando…'));
  try {
    await loadUser();
    await loadAll();
  } catch (err) {
    if (err.status === 401) return showLogin();
    replaceChildren(root, h('div', { class: 'boot boot-error' },
      h('p', null, err.message),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-primary', onclick: enterApp }, 'Tentar de novo'),
        h('button', { class: 'btn btn-ghost', onclick: logout }, 'Sair'))));
    return;
  }
  const fromHash = Number((location.hash.match(/etapa-(\d)/) || [])[1]);
  step = fromHash >= 1 && fromHash <= 4 ? fromHash : 1;
  renderShell();
  go(step);
}

// ---------- início ----------
setOnSessionExpired(() => showLogin('Sua sessão expirou. Entre novamente.'));
if (getSession()) enterApp();
else showLogin();
