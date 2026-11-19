// Etapa 4: exportação dos documentos validados para planilha.
import { api } from '../api.js';
import { countByStatus, dadosFinais, state } from '../store.js';
import { badge, fmtDateTime, h, prettyKey, replaceChildren, spinner, toast, toText } from '../dom.js';
import { icon } from '../icons.js';
import { emptyState, kpi, pageHead, topKeys } from './parts.js';

const ui = { excluded: new Set(), exporting: false, history: null };

export function reset() {
  ui.excluded.clear();
  Object.assign(ui, { exporting: false, history: null });
}

export function render(main, ctx) {
  const counts = countByStatus();
  const validated = state.docs.filter((d) => d.status === 'validado');
  const selected = () => validated.filter((d) => !ui.excluded.has(d.id));

  const exportBtns = h('div', { class: 'stack' });
  const tableBox = h('div', { class: 'table-wrap' });
  const historyBox = h('div', { class: 'stack' });
  const countLabel = h('span');

  function paintExport() {
    const n = selected().length;
    countLabel.textContent = `${n} de ${validated.length} selecionados`;
    const option = (format, title, text, iconName, primary) =>
      h('button', {
        class: `export-option ${primary ? 'primary' : ''}`, disabled: !n || ui.exporting,
        onclick: () => exportNow(ctx, format, selected(), paintExport, paintHistory),
      },
        h('span', { class: 'export-icon' }, icon(iconName, 18)),
        h('span', { class: 'export-text' }, h('strong', null, title), h('small', null, text)),
        ui.exporting ? spinner() : icon('download', 16));
    replaceChildren(exportBtns, 
      option('xlsx', 'Planilha Excel (.xlsx)', 'Uma linha por documento, com os dados validados', 'sheet', true),
      option('csv', 'Arquivo CSV', 'Separado por ponto e vírgula (abre direto no Excel)', 'table', false),
      h('div', { class: 'export-option disabled' },
        h('span', { class: 'export-icon' }, icon('zap', 18)),
        h('span', { class: 'export-text' }, h('strong', null, 'Sistema financeiro / ERP'), h('small', null, 'Integração prevista para depois do MVP')),
        h('span', { class: 'badge badge-slate' }, 'Em breve')));
  }

  function paintTable() {
    if (!validated.length) {
      return replaceChildren(tableBox, emptyState('Ainda não há documentos validados. Aprove documentos na etapa 3 para exportá-los.'));
    }
    const keys = topKeys(validated.map(dadosFinais), 4);
    const all = h('input', { type: 'checkbox', checked: !ui.excluded.size, 'aria-label': 'Selecionar todos', onchange: (e) => {
      ui.excluded = e.target.checked ? new Set() : new Set(validated.map((d) => d.id));
      paintTable(); paintExport();
    } });
    replaceChildren(tableBox, h('table', { class: 'table' },
      h('thead', null, h('tr', null,
        h('th', { class: 'col-check' }, all), h('th', null, 'Arquivo'), h('th', null, 'Canal'), h('th', null, 'Validado em'),
        keys.map((k) => h('th', null, prettyKey(k))))),
      h('tbody', null, validated.map((doc) => {
        const data = dadosFinais(doc);
        return h('tr', null,
          h('td', { class: 'col-check' }, h('input', { type: 'checkbox', checked: !ui.excluded.has(doc.id), 'aria-label': `Selecionar ${doc.nome}`, onchange: (e) => {
            if (e.target.checked) ui.excluded.delete(doc.id); else ui.excluded.add(doc.id);
            paintExport(); all.checked = !ui.excluded.size;
          } })),
          h('td', { class: 'cell-strong', title: doc.nome }, doc.nome),
          h('td', null, doc.canal || '—'),
          h('td', { class: 'mono small' }, fmtDateTime(doc.validadoEm)),
          keys.map((k) => h('td', { class: 'mono small' }, data[k] === undefined || data[k] === null ? '—' : toText(data[k]))));
      }))));
  }

  async function paintHistory() {
    if (!ui.history) {
      replaceChildren(historyBox, h('p', { class: 'muted small row' }, spinner(), 'Carregando histórico…'));
      try {
        ui.history = (await api.get('/exportacoes?limit=8')).dados;
      } catch (err) {
        return replaceChildren(historyBox, h('p', { class: 'form-error' }, err.message));
      }
    }
    replaceChildren(historyBox, ui.history.length
      ? ui.history.map((e) => h('div', { class: 'history-row' },
        icon(e.formato === 'xlsx' ? 'sheet' : 'table', 16),
        h('div', { class: 'queue-info' },
          h('strong', null, `${e.formato.toUpperCase()} · ${e.exportacao_documentos?.[0]?.count ?? '?'} documentos`),
          h('small', null, `${fmtDateTime(e.created_at)}${e.solicitante?.nome ? ` · ${e.solicitante.nome}` : ''}`)),
        e.status === 'gerado'
          ? h('button', { class: 'btn btn-ghost btn-sm', onclick: () => redownload(e.id) }, icon('download', 13), 'Baixar')
          : badge(e.status === 'pendente' ? 'Pendente' : 'Erro', e.status === 'pendente' ? 'slate' : 'rose')))
      : [emptyState('Nenhuma exportação feita ainda.')]);
  }

  main.append(
    pageHead({
      step: 4, tone: 'emerald',
      kicker: 'Dados estruturados',
      title: 'Exportação dos dados validados',
      text: 'Só documentos aprovados na validação humana entram na planilha. Os pendentes ficam retidos por segurança.',
      actions: counts.extraido
        ? [h('button', { class: 'btn btn-amber', onclick: () => ctx.go(3) }, icon('arrowLeft', 14), `Voltar e conferir pendentes (${counts.extraido})`)]
        : [],
    }),
    h('div', { class: 'grid grid-4' },
      kpi('Prontos para exportar', counts.validado, { tone: 'emerald' }),
      kpi('Pendentes de revisão', counts.extraido, { tone: 'amber', hint: 'retidos na fila' }),
      kpi('Rejeitados', counts.rejeitado, { tone: counts.rejeitado ? 'rose' : '' }),
      kpi('Com erro de leitura', counts.erro, { tone: counts.erro ? 'rose' : '' })),
    h('div', { class: 'layout layout-saida' },
      h('div', { class: 'stack' },
        h('section', { class: 'card pad stack' }, h('h2', { class: 'card-title' }, 'Destino dos dados'), countLabel, exportBtns,
          h('p', { class: 'note' }, icon('info', 14), 'Cada linha traz o canal de origem, a confiança da IA e a data da validação. Se houve correção, vale o dado corrigido.')),
        h('section', { class: 'card pad stack' }, h('h2', { class: 'card-title' }, 'Exportações anteriores'), historyBox)),
      h('section', { class: 'card' },
        h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, `Prévia (${validated.length} documentos validados)`)),
        tableBox)));

  paintExport();
  paintTable();
  paintHistory();
}

async function exportNow(ctx, formato, docs, paintExport, paintHistory) {
  if (ui.exporting || !docs.length) return;
  ui.exporting = true;
  paintExport();
  try {
    const res = await api.post('/exportacoes', { formato, documento_ids: docs.map((d) => d.id) });
    download(res.download_url);
    toast(`Planilha gerada com ${docs.length} documento${docs.length > 1 ? 's' : ''}.`, 'success');
    ui.history = null;
  } catch (err) {
    toast(err.message, 'error', 8000);
  } finally {
    ui.exporting = false;
    paintExport();
    paintHistory();
  }
}

async function redownload(id) {
  try {
    download((await api.get(`/exportacoes/${id}/download`)).download_url);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function download(url) {
  const a = h('a', { href: url, rel: 'noopener' });
  document.body.append(a);
  a.click();
  a.remove();
}
