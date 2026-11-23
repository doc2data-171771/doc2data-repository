// Confere e normaliza os campos devolvidos pela IA (funções puras, sem rede nem banco).
// Devolve os campos corrigidos e uma lista de alertas em português para a pessoa que confere.

const { TIPOS } = require('./esquemas');
const {
  soDigitos,
  chaveValida,
  cpfValido,
  cnpjValido,
  barrasValido,
  linhaParaBarras,
  barrasParaLinha,
} = require('../utils/documentos-br');

const PENALIDADE_POR_ALERTA = 10;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/\./g, '').replace(',', '.')));

function normalizarTipo(tipo) {
  const t = String(tipo ?? '').trim().toLowerCase();
  if (TIPOS[t]) return t;
  const porNome = Object.entries(TIPOS).find(([, nome]) => nome.toLowerCase() === t);
  return porNome ? porNome[0] : t ? 'outro' : null;
}

// Linha digitável e código de barras: aceita qualquer um dos dois (até trocados) e preenche o outro.
function normalizarCobranca(campos, alertas) {
  const candidatos = [campos.codigo_barras, campos.linha_digitavel].filter((v) => v != null && v !== '');
  if (!candidatos.length) return;

  let codigo = null;
  let linhaImpressa = null;
  for (const v of candidatos) {
    const d = soDigitos(v);
    if (d.length === 44) codigo = codigo || d;
    else if (d.length === 47 || d.length === 48) linhaImpressa = linhaImpressa || String(v).trim();
  }

  if (linhaImpressa) {
    const conv = linhaParaBarras(linhaImpressa);
    if (!conv.camposOk) alertas.push('Linha digitável com dígito verificador inválido: confira a digitação.');
    if (codigo && codigo !== conv.codigo) {
      alertas.push('Código de barras e linha digitável não correspondem ao mesmo pagamento.');
    }
    codigo = codigo || conv.codigo;
  }

  if (!codigo) {
    alertas.push('Código de barras / linha digitável com quantidade de dígitos inválida.');
    return;
  }
  if (!barrasValido(codigo)) alertas.push('Código de barras com dígito verificador inválido.');

  campos.codigo_barras = codigo;
  campos.linha_digitavel = linhaImpressa || barrasParaLinha(codigo);
}

function conferirDocumentos(campos, alertas) {
  for (const [k, v] of Object.entries(campos)) {
    if (typeof v !== 'string' || !v.trim()) continue;
    const d = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
    const ehCampoDoc = /(^|_)(cpf|cnpj|documento)$/.test(k) && k !== 'numero_documento' && k !== 'tipo_documento';
    if (!ehCampoDoc) continue;
    if (d.length === 11 && !/[A-Z]/.test(d)) {
      if (!cpfValido(d)) alertas.push(`CPF inválido em "${k}" (${v}).`);
    } else if (d.length === 14) {
      if (!cnpjValido(d)) alertas.push(`CNPJ inválido em "${k}" (${v}).`);
    }
  }
}

function normalizarChave(campos, alertas) {
  for (const k of Object.keys(campos)) {
    if (!/^chave_acesso/.test(k) || typeof campos[k] !== 'string') continue;
    const d = soDigitos(campos[k]);
    if (!d) continue;
    campos[k] = d;
    if (d.length === 44 && !chaveValida(d)) alertas.push(`Chave de acesso com dígito verificador inválido em "${k}".`);
    else if (d.length !== 44 && d.length !== 50) alertas.push(`Chave de acesso com ${d.length} dígitos em "${k}".`);
  }
}

// Soma dos itens x totais da nota (só para notas de produto, onde a relação é direta).
function conferirTotais(tipo, campos, alertas) {
  if (!['nfe', 'nfce'].includes(tipo) || !Array.isArray(campos.itens) || !campos.itens.length) return;
  const soma = campos.itens.reduce((acc, it) => acc + (isObj(it) ? num(it.valor_total) || 0 : 0), 0);
  const produtos = num(campos.valor_produtos);
  const esperado = Number.isFinite(produtos) && produtos > 0 ? produtos : num(campos.valor_total) + (num(campos.valor_desconto) || 0);
  if (Number.isFinite(esperado) && Math.abs(soma - esperado) > 0.05) {
    alertas.push(
      `A soma dos itens (${soma.toFixed(2)}) não bate com o total dos produtos (${esperado.toFixed(2)}): pode faltar item.`
    );
  }
}

function normalizarCampos(entrada, { tipo: tipoInformado, confianca } = {}) {
  const campos = { ...(isObj(entrada) ? entrada : {}) };
  const alertas = [];

  const tipo = normalizarTipo(campos.tipo_documento ?? tipoInformado);
  delete campos.tipo_documento; // o tipo vai para a tabela tipos_documento, não para os dados
  delete campos.alertas_validacao; // recalculado sempre

  normalizarCobranca(campos, alertas);
  normalizarChave(campos, alertas);
  conferirDocumentos(campos, alertas);
  conferirTotais(tipo, campos, alertas);

  if (alertas.length) campos.alertas_validacao = alertas;

  let conf = Number.isFinite(confianca) ? confianca : null;
  if (conf !== null) conf = Math.max(0, conf - PENALIDADE_POR_ALERTA * alertas.length);

  return { campos, tipo, alertas, confianca: conf };
}

module.exports = { normalizarCampos, normalizarTipo };
