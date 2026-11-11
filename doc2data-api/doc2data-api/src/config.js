// Lê as configurações do arquivo .env.
// (O comando "npm start" já carrega o .env sozinho, graças ao "node --env-file=.env".)

const numero = (valor, padrao) =>
  valor !== undefined && valor !== '' && Number.isFinite(Number(valor)) ? Number(valor) : padrao;

export const config = {
  porta: numero(process.env.PORT, 3000),
  frontendUrl: process.env.FRONTEND_URL || '*',
  supabaseUrl: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
  anonKey: process.env.SUPABASE_ANON_KEY || '',
  serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  // Na Vercel, o envio inteiro (todos os arquivos juntos) não pode passar de 4,5 MB.
  maxArquivoMb: numero(process.env.MAX_ARQUIVO_MB, 4),
  maxArquivos: numero(process.env.MAX_ARQUIVOS_POR_ENVIO, 5),
  atrasoExtratorMs: numero(process.env.EXTRATOR_ATRASO_MS, 1000),
};

// Devolve os nomes das variáveis obrigatórias que não foram preenchidas.
export function variaveisFaltando() {
  return ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY'].filter(
    (nome) => !process.env[nome],
  );
}
