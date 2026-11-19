// Visualizador do documento original (PDF ou imagem), usado na validação.
import { api, fetchBlob } from './api.js';
import { h, replaceChildren, spinner } from './dom.js';
import { icon } from './icons.js';

const cache = new Map(); // id do documento -> { objectUrl, downloadUrl }
const MAX_CACHE = 12;

async function loadPreview(doc) {
  if (cache.has(doc.id)) return cache.get(doc.id);
  const full = await api.get(`/documentos/${doc.id}`);
  const downloadUrl = full.download_url;
  if (!downloadUrl) throw new Error('A API não devolveu o link do arquivo');
  const blob = await fetchBlob(downloadUrl, doc.mime);
  const entry = { objectUrl: URL.createObjectURL(blob), downloadUrl };

  cache.set(doc.id, entry);
  if (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value;
    URL.revokeObjectURL(cache.get(oldest).objectUrl);
    cache.delete(oldest);
  }
  return entry;
}

export function clearViewerCache() {
  for (const entry of cache.values()) URL.revokeObjectURL(entry.objectUrl);
  cache.clear();
}

// Cria um visualizador. Uso: const v = createViewer(); container.append(v.el); v.show(doc)
export function createViewer({ compact = false } = {}) {
  let zoom = 100;
  let current = null;
  let token = 0;

  const title = h('span', { class: 'viewer-title' });
  const zoomLabel = h('span', { class: 'mono viewer-zoom-label' }, '100%');
  const zoomBox = h('div', { class: 'viewer-zoom' },
    h('button', { class: 'icon-btn', title: 'Diminuir', type: 'button', onclick: () => setZoom(zoom - 20) }, icon('zoomOut')),
    zoomLabel,
    h('button', { class: 'icon-btn', title: 'Aumentar', type: 'button', onclick: () => setZoom(zoom + 20) }, icon('zoomIn')));
  const stage = h('div', { class: 'viewer-stage' });
  const el = h('div', { class: `viewer ${compact ? 'viewer-compact' : ''}` },
    h('div', { class: 'viewer-bar' }, h('div', { class: 'viewer-name' }, icon('file'), title), zoomBox),
    stage);

  function setZoom(value) {
    zoom = Math.min(300, Math.max(40, value));
    zoomLabel.textContent = `${zoom}%`;
    const img = stage.querySelector('img');
    if (img) img.style.width = `${zoom}%`;
  }

  function placeholder(text) {
    replaceChildren(stage, h('p', { class: 'viewer-empty' }, text));
  }

  async function show(doc) {
    current = doc;
    const mine = ++token;
    title.textContent = doc ? doc.nome : '';
    if (!doc) {
      zoomBox.hidden = true;
      return placeholder('Selecione um documento para ver o original.');
    }
    const isImage = doc.mime.startsWith('image/');
    zoomBox.hidden = !isImage;
    zoom = 100;
    zoomLabel.textContent = '100%';
    replaceChildren(stage, h('div', { class: 'viewer-empty' }, spinner(), ' Carregando documento…'));

    try {
      const { objectUrl, downloadUrl } = await loadPreview(doc);
      if (mine !== token) return; // o usuário já trocou de documento
      const open = h('a', { class: 'viewer-link', href: downloadUrl, target: '_blank', rel: 'noopener' },
        icon('external', 13), ' Abrir arquivo original');
      const content = isImage
        ? h('img', { src: objectUrl, alt: `Documento ${doc.nome}`, style: { width: '100%' } })
        : h('iframe', { src: objectUrl, title: `Documento ${doc.nome}` });
      replaceChildren(stage, content, open);
    } catch (err) {
      if (mine !== token) return;
      replaceChildren(stage, h('p', { class: 'viewer-empty' }, `Não foi possível exibir o arquivo (${err.message}).`));
    }
  }

  return { el, show, get current() { return current; } };
}
