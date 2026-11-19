// Etapa 1: entrada de documentos (upload em lote) e fila.
import { ACCEPTED_TYPES, MAX_FILES_PER_REQUEST, MAX_FILE_BYTES } from '../config.js';
import { api, uploadToSignedUrl } from '../api.js';
import { countByStatus, state } from '../store.js';
import { fmtBytes, fmtDateTime, h, statusBadge, toast } from '../dom.js';
import { icon } from '../icons.js';
import { emptyState, kpi, pageHead, pool } from './parts.js';

const ui = { files: [], canalId: '', tipoId: '', uploading: false, canalFilter: 'ALL' };

// Volta o estado da tela ao inicial (ao sair do sistema).
export function reset() {
  Object.assign(ui, { files: [], canalId: '', tipoId: '', uploading: false, canalFilter: 'ALL' });
}

export function render(main, ctx) {
  const counts = countByStatus();
  let uploadCard;
  const redraw = () => uploadCard.replaceWith((uploadCard = buildUploadCard()));

  function buildUploadCard() {
    return ctx.can('enviar') ? uploadCardFor(ctx, redraw) : h('section', { class: 'card pad' },
      h('h2', { class: 'card-title' }, 'Upload de documentos'),
      emptyState(`O perfil "${state.user.perfil}" não envia documentos. Peça a um operador ou administrador.`));
  }

  uploadCard = buildUploadCard();

  main.append(
    pageHead({
      step: 1,
      kicker: 'Entrada centralizada de documentos',
      title: 'Entrada de documentos',
      text: 'Envie PDFs e imagens (um ou vários de uma vez). Todos entram na mesma fila, aguardando a leitura por IA.',
      actions: [h('button', { class: 'btn btn-primary', onclick: () => ctx.go(2) }, 'Ir para a leitura com IA', icon('arrowRight', 14))],
    }),
    h('div', { class: 'grid grid-4' },
      kpi('Documentos no sistema', counts.total),
      kpi('Aguardando leitura', counts.recebido + counts.erro + counts.processando, { tone: 'sky' }),
      kpi('Aguardando validação', counts.extraido, { tone: 'amber' }),
      kpi('Validados', counts.validado, { tone: 'emerald' })),
    h('div', { class: 'layout layout-entrada' }, uploadCard, queueCard()));
}

// ---------- upload ----------
function uploadCardFor(ctx, redraw) {
  const input = h('input', {
    type: 'file', multiple: true, class: 'sr-only', id: 'fileInput',
    accept: '.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp',
    onchange: () => { addFiles(input.files); input.value = ''; redraw(); },
  });

  const dropzone = h('label', {
    class: 'dropzone', for: 'fileInput',
    ondragover: (e) => { e.preventDefault(); dropzone.classList.add('over'); },
    ondragleave: () => dropzone.classList.remove('over'),
    ondrop: (e) => { e.preventDefault(); dropzone.classList.remove('over'); addFiles(e.dataTransfer.files); redraw(); },
  },
    h('span', { class: 'dropzone-icon' }, icon('upload', 22)),
    h('strong', null, 'Arraste os arquivos aqui ou clique para escolher'),
    h('small', null, `PDF, PNG, JPG ou WEBP · até ${fmtBytes(MAX_FILE_BYTES)} cada · até ${MAX_FILES_PER_REQUEST} por envio`));

  const select = (label, value, options, onchange) =>
    h('label', { class: 'field' },
      h('span', { class: 'field-label' }, label),
      h('select', { class: 'input', value, disabled: ui.uploading, onchange: (e) => onchange(e.target.value) },
        h('option', { value: '' }, '— não informado —'),
        options.map((o) => h('option', { value: o.id }, o.nome))));

  const pending = ui.files.filter((f) => f.status !== 'ok');
  return h('section', { class: 'card pad stack' },
    h('h2', { class: 'card-title' }, 'Upload de documentos'),
    h('div', { class: 'grid grid-2' },
      select('Canal de origem', ui.canalId, state.canais, (v) => (ui.canalId = v)),
      select('Tipo de documento', ui.tipoId, state.tipos, (v) => (ui.tipoId = v))),
    dropzone, input,
    ui.files.length ? h('ul', { class: 'file-list' }, ui.files.map((item, i) => fileRow(item, i, redraw))) : null,
    h('button', {
      class: 'btn btn-primary btn-block', disabled: ui.uploading || !pending.length,
      onclick: () => send(ctx, redraw),
    }, ui.uploading ? 'Enviando…' : pending.length ? `Enviar ${pending.length} arquivo${pending.length > 1 ? 's' : ''}` : 'Selecione arquivos para enviar'),
    h('p', { class: 'note' }, icon('info', 14),
      'Nada é aprovado automaticamente: toda leitura da IA passa pela conferência humana (etapa 3) antes de ser exportada.'));
}

function fileRow(item, index, redraw) {
  const [statusLabel, statusTone] = { aguardando: ['Aguardando', 'slate'], enviando: ['Enviando…', 'sky'], ok: ['Enviado', 'emerald'], erro: ['Falhou', 'rose'] }[item.status];
  return h('li', { class: 'file-row' },
    icon('file', 16),
    h('div', { class: 'file-info' },
      h('strong', { title: item.file.name }, item.file.name),
      h('small', null, fmtBytes(item.file.size), item.error ? ` · ${item.error}` : '')),
    h('span', { class: `badge badge-${statusTone}` }, statusLabel),
    h('button', {
      class: 'icon-btn', type: 'button', title: 'Remover', disabled: ui.uploading,
      onclick: () => { ui.files.splice(index, 1); redraw(); },
    }, icon('x', 14)));
}

function addFiles(fileList) {
  const problems = [];
  for (const file of fileList) {
    if (!ACCEPTED_TYPES[file.type]) problems.push(`${file.name}: tipo não aceito`);
    else if (file.size > MAX_FILE_BYTES) problems.push(`${file.name}: maior que ${fmtBytes(MAX_FILE_BYTES)}`);
    else if (file.size === 0) problems.push(`${file.name}: arquivo vazio`);
    else if (!ui.files.some((f) => f.file.name === file.name && f.file.size === file.size)) {
      ui.files.push({ file, status: 'aguardando', error: '' });
    }
  }
  if (problems.length) toast(`Não adicionados — ${problems.join('; ')}`, 'error', 8000);
}

async function send(ctx, redraw) {
  const items = ui.files.filter((f) => f.status !== 'ok');
  if (!items.length) return;
  ui.uploading = true;
  items.forEach((i) => { i.status = 'aguardando'; i.error = ''; });
  redraw();

  let ok = 0;
  let failed = 0;
  for (let start = 0; start < items.length; start += MAX_FILES_PER_REQUEST) {
    const chunk = items.slice(start, start + MAX_FILES_PER_REQUEST);
    let registered;
    try {
      registered = await api.post('/documentos/upload-url', {
        arquivos: chunk.map(({ file }) => ({
          nome_arquivo: file.name,
          mime_type: file.type,
          tamanho_bytes: file.size,
          canal_id: ui.canalId || undefined,
          tipo_documento_id: ui.tipoId || undefined,
        })),
      });
    } catch (err) {
      chunk.forEach((i) => { i.status = 'erro'; i.error = err.message; });
      failed += chunk.length;
      continue;
    }

    await pool(chunk.map((item, index) => ({ item, target: registered.arquivos[index] })), 4, async ({ item, target }) => {
      item.status = 'enviando';
      redraw();
      try {
        await uploadToSignedUrl(target.upload.signed_url, item.file);
        item.status = 'ok';
        ok++;
      } catch (err) {
        item.status = 'erro';
        item.error = `${err.message}. O registro foi criado sem o arquivo; peça a um admin para excluí-lo.`;
        failed++;
      }
      redraw();
    });
  }

  ui.uploading = false;
  ui.files = ui.files.filter((f) => f.status !== 'ok');
  if (ok) toast(`${ok} documento${ok > 1 ? 's enviados' : ' enviado'} para a fila.`, 'success');
  if (failed) toast(`${failed} arquivo${failed > 1 ? 's falharam' : ' falhou'}. Veja a lista.`, 'error', 8000);
  try { await ctx.reload(); } catch (err) { toast(err.message, 'error'); }
}

// ---------- fila ----------
function queueCard() {
  const list = h('div', { class: 'queue-list' });
  const title = h('h2', { class: 'card-title' });

  function paint() {
    const docs = state.docs.filter((d) =>
      ui.canalFilter === 'ALL' ? true : ui.canalFilter === '' ? !d.canalId : d.canalId === ui.canalFilter);
    title.textContent = `Fila de documentos (${docs.length})`;
    list.replaceChildren(...(docs.length
      ? docs.map((d) => h('div', { class: 'queue-row' },
        icon('file', 16),
        h('div', { class: 'queue-info' },
          h('strong', { title: d.nome }, d.nome),
          h('small', null, [d.canal || 'Sem canal', d.tipo, fmtBytes(d.tamanho), fmtDateTime(d.enviadoEm)].filter(Boolean).join(' · '))),
        statusBadge(d.status)))
      : [emptyState('Nenhum documento por aqui ainda.')]));
  }

  const filter = h('select', {
    class: 'input input-sm', 'aria-label': 'Filtrar por canal', value: ui.canalFilter,
    onchange: (e) => { ui.canalFilter = e.target.value; paint(); },
  },
    h('option', { value: 'ALL' }, 'Todos os canais'),
    state.canais.map((c) => h('option', { value: c.id }, c.nome)),
    h('option', { value: '' }, 'Sem canal'));

  paint();
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, title, filter),
    list);
}
