// Valores fixos usados pela API. Se o banco usar outros nomes de status/perfil,
// é só ajustar aqui — o resto do código usa estas constantes.

export const PERFIL_ADMIN = 'admin'; // quem pode cadastrar canais e tipos de documento

export const STATUS_DOC = {
  RECEBIDO: 'recebido', // arquivo salvo, ainda não lido
  PROCESSANDO: 'processando', // extrator trabalhando
  PROCESSADO: 'processado', // dados extraídos, esperando validação humana
  VALIDADO: 'validado', // humano aprovou (ou corrigiu)
  REJEITADO: 'rejeitado', // humano rejeitou
  EXPORTADO: 'exportado', // já saiu em alguma planilha
  ERRO: 'erro', // falhou no processamento
};

export const STATUS_PROC = {
  PROCESSANDO: 'processando',
  CONCLUIDO: 'concluido',
  ERRO: 'erro',
};

export const STATUS_VALIDACAO = ['aprovado', 'corrigido', 'rejeitado'];

export const STATUS_EXPORTACAO = { CONCLUIDO: 'concluido', ERRO: 'erro' };
export const FORMATOS_EXPORTACAO = ['csv'];

// Nomes dos "buckets" (pastas) do Supabase Storage. Precisam existir e ser PRIVADOS.
export const BUCKET_DOCUMENTOS = 'documentos';
export const BUCKET_EXPORTACOES = 'exportacoes';
