// Funções puras (sem dependências) para transformar JSON extraído em tabela.

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// { endereco: { cidade: 'SP' } } -> { 'endereco.cidade': 'SP' }
function flatten(obj, prefix = '', out = {}) {
  if (!isPlainObject(obj)) {
    out[prefix || 'valor'] = Array.isArray(obj) ? JSON.stringify(obj) : obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v)) flatten(v, key, out);
    else out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
  }
  return out;
}

// Junta as chaves de todas as linhas (na ordem em que aparecem) e monta a matriz.
function buildTable(rows) {
  const headers = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  const matrix = rows.map((row) => headers.map((h) => (row[h] === undefined ? '' : row[h])));
  return { headers, matrix };
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'string' ? value : String(value);
  // Evita "injeção de fórmula" ao abrir o CSV no Excel
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[;"\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

// CSV com ";" e BOM, para abrir corretamente no Excel em português.
function toCsv(headers, matrix) {
  const lines = [headers, ...matrix].map((row) => row.map(csvCell).join(';'));
  return '﻿' + lines.join('\r\n');
}

module.exports = { flatten, buildTable, toCsv };
