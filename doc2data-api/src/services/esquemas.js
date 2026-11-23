// Vocabulário de campos da extração. Todos os tipos usam os mesmos nomes para o que é comum
// (emitente, destinatário, datas, valor total...), para que a planilha tenha uma coluna por conceito.

// Tipos que a IA pode identificar: código -> nome gravado em tipos_documento.
const TIPOS = {
  boleto: 'Boleto bancário',
  nfe: 'NF-e (DANFE)',
  nfce: 'NFC-e (cupom fiscal)',
  nfse: 'NFS-e (nota de serviço)',
  conta_energia: 'Conta de energia',
  conta_agua: 'Conta de água',
  fatura_telecom: 'Fatura de telecom',
  fatura_cartao: 'Fatura de cartão de crédito',
  documento_identificacao: 'Documento de identificação',
  comprovante_pagamento: 'Comprovante de pagamento',
  outro: 'Outro',
};

// Campos comuns, na ordem em que aparecem na planilha.
const CAMPOS_COMUNS = [
  ['emitente_nome', 'quem emite/cobra: empresa, banco, beneficiário, prestador, concessionária, órgão emissor'],
  ['emitente_documento', 'CNPJ ou CPF do emitente, como impresso'],
  ['destinatario_nome', 'quem recebe/paga: cliente, pagador, tomador, consumidor, titular, portador'],
  ['destinatario_documento', 'CNPJ ou CPF do destinatário, como impresso'],
  ['numero_documento', 'número da nota, fatura, conta ou documento, como impresso'],
  ['serie', 'série da nota, como impressa'],
  ['data_emissao', 'AAAA-MM-DD'],
  ['hora_emissao', 'HH:MM:SS'],
  ['data_vencimento', 'AAAA-MM-DD'],
  ['competencia', 'mês de referência, AAAA-MM'],
  ['valor_total', 'valor final a pagar ou total da nota (número)'],
  ['valor_desconto', 'número'],
  ['chave_acesso', 'chave de acesso de NF-e/NFC-e/NFS-e/NFCom, só os dígitos'],
  ['protocolo_autorizacao', 'só o número do protocolo, sem data'],
  ['codigo_barras', 'os 44 dígitos do código de barras, só se estiverem impressos; NÃO confundir com a linha digitável'],
  ['linha_digitavel', 'a sequência numérica impressa acima do código de barras (47 ou 48 dígitos), como impressa'],
  ['pix_copia_cola', 'payload Pix copia-e-cola completo'],
];

const ESPECIFICOS = {
  boleto: 'banco_codigo, nosso_numero, agencia_codigo_beneficiario, especie_documento, instrucoes',
  nfe: 'natureza_operacao, emitente_inscricao_estadual, destinatario_inscricao_estadual, valor_produtos, base_calculo_icms, valor_icms, valor_ipi, valor_pis, valor_cofins, valor_frete, transportador_nome, transportador_documento, informacoes_complementares',
  nfce: 'valor_tributos, forma_pagamento, valor_troco',
  nfse: 'codigo_servico, descricao_servico, municipio_prestacao, valor_servico, aliquota_iss, valor_iss, iss_retido (true/false), valor_irrf, valor_pis, valor_cofins, valor_csll, valor_inss, valor_liquido',
  conta_energia: 'numero_instalacao, codigo_cliente, leitura_anterior, leitura_atual, consumo_kwh, bandeira_tarifaria, valor_icms, valor_pis, valor_cofins, valor_iluminacao_publica',
  conta_agua: 'matricula, numero_hidrometro, leitura_anterior, leitura_atual, consumo_m3, valor_agua, valor_esgoto',
  fatura_telecom: 'codigo_cliente, plano, valor_icms, base_calculo_icms',
  fatura_cartao: 'cartao_final, bandeira, data_fechamento, pagamento_minimo, limite_total, limite_disponivel, saldo_anterior',
  documento_identificacao: 'nome_completo, cpf, rg, orgao_emissor, data_nascimento, data_validade, filiacao_mae, filiacao_pai, numero_registro, categoria',
};

const LISTAS = [
  'itens: TODOS os produtos, serviços ou lançamentos listados, um objeto por linha, na ordem do documento.',
  '  - Produtos (NF-e, NFC-e): codigo, descricao, ncm, cfop, unidade, quantidade, valor_unitario, valor_desconto, valor_total.',
  '  - Lançamentos (fatura de cartão): data (AAAA-MM-DD ou DD/MM), descricao, local, parcela, valor (negativo para pagamentos/créditos).',
  '  - Serviços cobrados (contas, faturas): descricao, quantidade, valor_unitario, valor_total.',
  'parcelas: duplicatas ou parcelas, cada uma com numero, vencimento (AAAA-MM-DD) e valor.',
];

function descricaoEsquema() {
  return [
    `Classifique o documento em "tipo_documento" com um destes códigos: ${Object.keys(TIPOS).join(', ')}.`,
    'Use exatamente estes nomes para os campos comuns, quando existirem no documento:',
    ...CAMPOS_COMUNS.map(([k, d]) => `- ${k}: ${d}`),
    'Campos específicos recomendados por tipo (use estes nomes quando se aplicarem):',
    ...Object.entries(ESPECIFICOS).map(([t, c]) => `- ${t}: ${c}`),
    'Listas (arrays de objetos):',
    ...LISTAS.map((l) => `- ${l}`),
    'Outros dados relevantes que não se encaixem acima podem ser incluídos com nomes curtos em snake_case, escritos corretamente em português sem acentos.',
  ].join('\n');
}

const ORDEM_COLUNAS = CAMPOS_COMUNS.map(([k]) => k);

module.exports = { TIPOS, ORDEM_COLUNAS, descricaoEsquema };
