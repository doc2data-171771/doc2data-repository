class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Permite usar async/await nas rotas sem try/catch em todas.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Converte erros do Supabase/Postgres em respostas HTTP amigáveis.
function throwIfError(error, overrides = {}) {
  if (!error) return;
  console.error('[supabase]', error.code, error.message);

  if (error.code === '23505') {
    throw new AppError(409, overrides.unique || 'Já existe um registro com esse valor');
  }
  if (error.code === '23503') {
    throw new AppError(
      409,
      overrides.fk || 'Operação bloqueada: referência inexistente ou registro em uso'
    );
  }
  if (error.code === '23514' || error.code === '22P02' || error.code === '23502') {
    throw new AppError(400, overrides.invalid || 'Dados inválidos para esta operação');
  }
  throw new AppError(500, 'Erro ao acessar o banco de dados');
}

function notFound(req, res) {
  res.status(404).json({ erro: 'Rota não encontrada' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ erro: err.message, detalhes: err.details });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição' });
  }
  console.error('[erro inesperado]', err);
  return res.status(500).json({ erro: 'Erro interno do servidor' });
}

module.exports = { AppError, asyncHandler, throwIfError, notFound, errorHandler };
