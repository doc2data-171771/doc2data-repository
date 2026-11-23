// Testes com valores reais de uma rodada de testes do doc2data (documentos fictícios com
// dígitos verificadores corretos) e com erros que a IA cometeu nessa rodada.
const test = require('node:test');
const assert = require('node:assert/strict');

const br = require('../src/utils/documentos-br');
const { normalizarCampos } = require('../src/services/normalizacao');
const { buildTable, separarListas } = require('../src/utils/tabular');

const BOLETO = {
  linha: '99994.41711 09000.045212 87300.832158 9 16560000128745',
  codigo: '99999165600001287454417109000045218730083215',
};
const ENERGIA = {
  linha: '83670000002-6 85210371000-4 07731902845-0 26110000215-1',
  codigo: '83670000002852103710000773190284526110000215',
};

test('boleto: linha digitável <-> código de barras', () => {
  assert.equal(br.linhaParaBarras(BOLETO.linha).codigo, BOLETO.codigo);
  assert.ok(br.linhaParaBarras(BOLETO.linha).camposOk);
  assert.equal(br.barrasParaLinha(BOLETO.codigo), BOLETO.linha);
  assert.ok(br.barrasValido(BOLETO.codigo));
});

test('arrecadação (conta de consumo): linha digitável <-> código de barras', () => {
  assert.equal(br.linhaParaBarras(ENERGIA.linha).codigo, ENERGIA.codigo);
  assert.equal(br.barrasParaLinha(ENERGIA.codigo), ENERGIA.linha);
  assert.ok(br.barrasValido(ENERGIA.codigo));
});

test('dígito errado na linha digitável gera alerta', () => {
  const errada = BOLETO.linha.replace('41711', '41712');
  const { alertas } = normalizarCampos({ linha_digitavel: errada });
  assert.ok(alertas.some((a) => a.includes('Linha digitável')));
});

test('CPF, CNPJ (inclusive alfanumérico) e chave de acesso', () => {
  assert.ok(br.cpfValido('318.664.270-16'));
  assert.ok(!br.cpfValido('318.664.270-17'));
  assert.ok(br.cnpjValido('41.926.083/0001-21'));
  assert.ok(!br.cnpjValido('41.926.083/0001-22'));
  assert.ok(br.cnpjValido('12.ABC.345/01DE-35')); // exemplo oficial da Receita
  assert.ok(br.chaveValida('35261141926083000121550010000482171259880008'));
  assert.ok(!br.chaveValida('35261141926083000121550010000482171259880009'));
});

test('caso real: IA pôs a linha digitável (sem hífens) no campo codigo_barras', () => {
  const { campos, alertas } = normalizarCampos({
    tipo_documento: 'conta_energia',
    codigo_barras: '836700000026 852103710004 077319028450 261100002151',
  });
  assert.deepEqual(alertas, []);
  assert.equal(campos.codigo_barras, ENERGIA.codigo);
  assert.equal(campos.linha_digitavel, '836700000026 852103710004 077319028450 261100002151');
});

test('caso real: só a linha digitável do boleto -> preenche o código de barras', () => {
  const { campos, tipo, confianca } = normalizarCampos(
    { tipo_documento: 'boleto', linha_digitavel: BOLETO.linha, emitente_documento: '28.417.305/0001-12' },
    { confianca: 98 }
  );
  assert.equal(tipo, 'boleto');
  assert.equal(campos.codigo_barras, BOLETO.codigo);
  assert.equal(campos.tipo_documento, undefined);
  assert.equal(confianca, 98);
});

test('chave com espaços é limpa; tipo desconhecido vira "outro"', () => {
  const { campos, tipo } = normalizarCampos({
    tipo_documento: 'recibo de mercado',
    chave_acesso: '3526 1141 9260 8300 0121 5500 1000 0482 1712 5988 0008',
  });
  assert.equal(campos.chave_acesso, '35261141926083000121550010000482171259880008');
  assert.equal(tipo, 'outro');
});

test('caso real: NFC-e sem itens não gera alerta de soma; com item faltando, gera e baixa a confiança', () => {
  const base = { tipo_documento: 'nfce', valor_total: 222.04, valor_desconto: 3.5 };
  assert.deepEqual(normalizarCampos(base).alertas, []);

  const itens = [
    { descricao: 'LEITE UHT INTEGRAL 1L', valor_total: 32.94 },
    { descricao: 'ARROZ BRANCO TIPO 1 5KG', valor_total: 27.9 },
  ];
  const r = normalizarCampos({ ...base, itens }, { confianca: 100 });
  assert.equal(r.alertas.length, 1);
  assert.match(r.alertas[0], /soma dos itens/);
  assert.equal(r.confianca, 90);
  assert.deepEqual(r.campos.alertas_validacao, r.alertas);
});

test('CPF inválido em campo de documento gera alerta; numero_documento é ignorado', () => {
  const { alertas } = normalizarCampos({ destinatario_documento: '111.222.333-44', numero_documento: '12345678901' });
  assert.equal(alertas.length, 1);
  assert.match(alertas[0], /CPF inválido/);
});

test('export: colunas prioritárias primeiro e listas em abas', () => {
  const registros = [
    { meta: { arquivo: 'a.pdf', tipo_documento: 'NFC-e' }, dados: { extra: 1, valor_total: 10, itens: [{ descricao: 'X', valor_total: 10 }] } },
    { meta: { arquivo: 'b.pdf', tipo_documento: 'Boleto' }, dados: { emitente_nome: 'Y', linha_digitavel: '1' } },
  ];
  const { principais, abas } = separarListas(registros);
  assert.equal(principais[0].itens, '1 (ver aba Itens)');
  assert.deepEqual(abas.Itens, [{ arquivo: 'a.pdf', n: 1, descricao: 'X', valor_total: 10 }]);

  const { headers } = buildTable(principais, ['arquivo', 'tipo_documento', 'emitente_nome', 'valor_total', 'linha_digitavel']);
  assert.deepEqual(headers, ['arquivo', 'tipo_documento', 'emitente_nome', 'valor_total', 'linha_digitavel', 'extra', 'itens']);
});
