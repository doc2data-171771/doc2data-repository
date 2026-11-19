// Configurações do front-end. É o único arquivo que normalmente precisa ser editado.

// Endereço da API. Para testar contra outra API sem mexer no código,
// defina window.DOC2DATA_API_URL antes de carregar o site.
export const API_URL = (window.DOC2DATA_API_URL || 'https://doc2data-repository.vercel.app').replace(/\/+$/, '');

// Nome exibido no topo e na tela de login.
export const BRAND = 'Opto Capital';

// Documentos com confiança abaixo deste valor (0 a 100) ganham um alerta na validação.
export const LOW_CONFIDENCE = 80;

// Limites de upload (iguais aos da API).
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 50;
export const ACCEPTED_TYPES = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/webp': 'WEBP',
};

// Quem pode fazer o quê (a API confere de novo; aqui é só para esconder/desabilitar botões).
export const PERMISSIONS = {
  enviar: ['admin', 'operador'],
  processar: ['admin', 'operador'],
  validar: ['admin', 'validador'],
};

// Rótulo e cor de cada status de documento.
export const STATUS = {
  recebido: { label: 'Recebido', tone: 'slate' },
  processando: { label: 'Lendo com IA', tone: 'sky' },
  extraido: { label: 'Aguardando validação', tone: 'amber' },
  validado: { label: 'Validado', tone: 'emerald' },
  rejeitado: { label: 'Rejeitado', tone: 'rose' },
  erro: { label: 'Erro na leitura', tone: 'rose' },
};
