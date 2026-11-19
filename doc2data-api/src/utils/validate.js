const { AppError } = require('./errors');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function requireUuid(value, field) {
  if (!isUuid(value)) throw new AppError(400, `${field} deve ser um UUID válido`);
  return value;
}

function optionalUuid(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return requireUuid(value, field);
}

function requireString(value, field, max) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(400, `${field} é obrigatório`);
  }
  const v = value.trim();
  if (max && v.length > max) {
    throw new AppError(400, `${field} deve ter no máximo ${max} caracteres`);
  }
  return v;
}

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const from = (page - 1) * limit;
  return { page, limit, from, to: from + limit - 1 };
}

// Nome seguro para usar no caminho do Storage (sem acentos/espaços/símbolos).
function sanitizeFileName(name) {
  const clean = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (clean || 'arquivo').slice(-120);
}

module.exports = {
  isUuid,
  isPlainObject,
  requireUuid,
  optionalUuid,
  requireString,
  parsePagination,
  sanitizeFileName,
};
