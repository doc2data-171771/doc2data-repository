require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ausente: ${name}. Configure no arquivo .env (local) ou em Environment Variables (Vercel).`
    );
  }
  return value;
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  corsOrigins: (process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  supabase: {
    url: required('SUPABASE_URL'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    anonKey: required('SUPABASE_ANON_KEY'),
  },
  buckets: {
    documentos: process.env.BUCKET_DOCUMENTOS || 'documentos',
    exportacoes: process.env.BUCKET_EXPORTACOES || 'exportacoes',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-4-hydrogen',
  },
  upload: {
    // 20 MB: limite para enviar o arquivo inline ao Gemini
    maxBytes: 20 * 1024 * 1024,
    mimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
  },
  // Valores aceitos pelos CHECKs do banco
  perfis: ['admin', 'operador', 'validador'],
  statusDocumento: ['recebido', 'processando', 'extraido', 'validado', 'rejeitado', 'erro'],
};
