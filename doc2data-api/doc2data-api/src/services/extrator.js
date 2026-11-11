// =====================================================================
//  EXTRATOR  —  o ÚNICO lugar que precisa mudar para ligar o OCR / IA de verdade
// =====================================================================
// Hoje ele é SIMULADO: não lê o documento, só devolve dados de exemplo.
// Assim o fluxo completo (upload -> extração -> validação -> planilha) já funciona de ponta a ponta.
//
// Para trocar pelo real, reescreva a função "extrair" mantendo o que ela recebe e devolve:
//
//   recebe:  { buffer, mime, nomeArquivo, tipoDocumento }
//              buffer        = conteúdo do arquivo (Buffer)
//              mime          = 'application/pdf' | 'image/png' | 'image/jpeg'
//              tipoDocumento = linha da tabela tipos_documento (ou null)
//   devolve: { dados, confianca, modelo }
//              dados     = objeto com os campos lidos (vai para a coluna jsonb)
//              confianca = número de 0 a 100 (ou null se não houver)
//              modelo    = nome do modelo usado (ou null)

import { config } from '../config.js';

export const ferramenta = 'simulado'; // vai para processamentos.ferramenta

export async function extrair({ nomeArquivo, tipoDocumento }) {
  await new Promise((resolver) => setTimeout(resolver, config.atrasoExtratorMs)); // finge que "demora"

  return {
    dados: {
      cliente: 'EXEMPLO SIMULADO',
      numero_documento: '000000',
      valor: 0,
      data_emissao: null,
      tipo_documento: tipoDocumento?.nome ?? null,
      arquivo_origem: nomeArquivo,
      aviso: 'Dados simulados. Troque o extrator (src/services/extrator.js) pelo OCR/IA real.',
    },
    confianca: null,
    modelo: null,
  };
}
