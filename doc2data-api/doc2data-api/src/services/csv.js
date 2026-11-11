// Gera a planilha CSV que abre direto no Excel brasileiro:
//   - separador ";"  - decimal com vírgula  - UTF-8 com BOM (acentos corretos)

// {a: {b: 1}, c: 2}  ->  {'a.b': 1, c: 2}
export function achatar(valor, prefixo = '', saida = {}) {
  if (valor !== null && typeof valor === 'object' && !Array.isArray(valor)) {
    for (const [chave, v] of Object.entries(valor)) {
      achatar(v, prefixo ? `${prefixo}.${chave}` : chave, saida);
    }
  } else if (prefixo) {
    saida[prefixo] = valor;
  }
  return saida;
}

function celula(valor) {
  if (valor === null || valor === undefined) return '';
  let texto;
  if (typeof valor === 'number') texto = String(valor).replace('.', ',');
  else if (typeof valor === 'boolean') texto = valor ? 'sim' : 'não';
  else if (typeof valor === 'object') texto = JSON.stringify(valor);
  else texto = String(valor);

  // Proteção: texto lido de documentos que começa com = + - @ viraria "fórmula" no Excel.
  // Um apóstrofo na frente faz o Excel tratar como texto.
  if (typeof valor === 'string' && /^[=+\-@\t\r]/.test(texto) && !/^-?\d+([.,]\d+)?$/.test(texto)) {
    texto = `'${texto}`;
  }
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function gerarCsv(colunas, linhas) {
  const cabecalho = colunas.map(celula).join(';');
  const corpo = linhas.map((linha) => colunas.map((coluna) => celula(linha[coluna])).join(';'));
  return `﻿${[cabecalho, ...corpo].join('\r\n')}\r\n`;
}
