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

// Junta as chaves de todas as linhas e monta a matriz. As colunas de "prioridade" que existirem
// vêm primeiro, nessa ordem; as demais seguem a ordem em que aparecem.
function buildTable(rows, prioridade = []) {
  const presentes = new Set(rows.flatMap((r) => Object.keys(r)));
  const headers = prioridade.filter((k) => presentes.has(k));
  const seen = new Set(headers);
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

const ehListaDeObjetos = (v) => Array.isArray(v) && v.length > 0 && v.every(isPlainObject);
const nomeAba = (k) => (k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ')).slice(0, 31);

// Para o XLSX: tira as listas de objetos (itens, parcelas...) da linha do documento e
// devolve uma aba por lista, com uma linha por elemento e a coluna "arquivo" para ligar ao documento.
// registros: [{ meta: { arquivo, ... }, dados: {...} }]
function separarListas(registros) {
  const abas = {};
  const principais = registros.map(({ meta, dados }) => {
    const resto = {};
    for (const [k, v] of Object.entries(dados || {})) {
      if (!ehListaDeObjetos(v)) {
        resto[k] = v;
        continue;
      }
      const aba = nomeAba(k);
      resto[k] = `${v.length} (ver aba ${aba})`;
      abas[aba] = abas[aba] || [];
      v.forEach((item, i) => abas[aba].push({ arquivo: meta.arquivo, n: i + 1, ...flatten(item) }));
    }
    return { ...meta, ...flatten(resto) };
  });
  return { principais, abas };
}

module.exports = { flatten, buildTable, toCsv, separarListas };
