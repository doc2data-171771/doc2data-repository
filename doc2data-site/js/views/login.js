import { BRAND } from '../config.js';
import { login } from '../api.js';
import { h, replaceChildren, spinner } from '../dom.js';
import { icon } from '../icons.js';

const STEPS = [
  ['Entrada unificada', 'Envie PDFs e imagens, um a um ou em lote, para uma fila única.'],
  ['Leitura com IA', 'A IA lê cada documento e extrai os campos, com um nível de confiança.'],
  ['Validação humana', 'Uma pessoa confere os dados lado a lado com o original antes de aprovar.'],
  ['Saída estruturada', 'Exportação dos dados aprovados para planilha (.xlsx) ou CSV.'],
];

export function renderLogin(root, { onLogin, notice = '' }) {
  const error = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const email = h('input', { id: 'email', class: 'input', type: 'email', required: true, autocomplete: 'username', placeholder: 'voce@empresa.com.br' });
  const senha = h('input', { id: 'senha', class: 'input', type: 'password', required: true, autocomplete: 'current-password' });
  const remember = h('input', { type: 'checkbox' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Entrar', icon('arrowRight', 14));

  async function onSubmit(event) {
    event.preventDefault();
    error.hidden = true;
    submit.disabled = true;
    replaceChildren(submit, spinner(), 'Entrando…');
    try {
      await login(email.value.trim(), senha.value, remember.checked);
      await onLogin();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      submit.disabled = false;
      replaceChildren(submit, 'Entrar', icon('arrowRight', 14));
      senha.select();
    }
  }

  replaceChildren(root,
    h('section', { class: 'login' },
      h('div', { class: 'login-brand' },
        h('div', { class: 'brand' },
          h('span', { class: 'brand-mark' }, icon('file', 20)),
          h('div', null, h('strong', { class: 'brand-name' }, BRAND), h('small', null, 'Central de Documentos'))),
        h('div', { class: 'login-pitch' },
          h('h1', null, 'Do documento à planilha, sem digitar.'),
          h('p', null, 'Leitura automática por IA e conferência humana antes de qualquer dado seguir para a planilha.'),
          h('ol', { class: 'login-steps' },
            STEPS.map(([title, text], i) =>
              h('li', null, h('span', { class: 'step-num' }, i + 1), h('div', null, h('strong', null, title), h('p', null, text))))))),
      h('div', { class: 'login-form-wrap' },
        h('form', { class: 'login-form', onsubmit: onSubmit },
          h('h2', null, 'Entrar na plataforma'),
          h('p', { class: 'muted' }, 'Use o e-mail e a senha cadastrados pelo administrador.'),
          notice ? h('p', { class: 'form-notice' }, notice) : null,
          h('label', { class: 'field', for: 'email' }, h('span', { class: 'field-label' }, 'E-mail'), email),
          h('label', { class: 'field', for: 'senha' }, h('span', { class: 'field-label' }, 'Senha'), senha),
          h('label', { class: 'check' }, remember, h('span', null, 'Manter conectado neste dispositivo')),
          error,
          submit,
          h('p', { class: 'muted small' }, 'Sem acesso? Peça ao administrador para criar o seu usuário.')))));

  email.focus();
}
