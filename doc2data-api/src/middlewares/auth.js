const { admin } = require('../supabase');
const { AppError, asyncHandler, throwIfError } = require('../utils/errors');

// 1) Confere o token (JWT) enviado no header: Authorization: Bearer <token>
// 2) Busca o perfil do usuário na tabela profiles (admin / operador / validador)
const authenticate = asyncHandler(async (req, res, next) => {
  const [type, token] = (req.headers.authorization || '').split(' ');
  if (type !== 'Bearer' || !token) {
    throw new AppError(401, 'Token de acesso ausente. Faça login em /auth/login');
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw new AppError(401, 'Token inválido ou expirado');

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, nome, perfil, ativo')
    .eq('id', data.user.id)
    .maybeSingle();
  throwIfError(profileError);

  if (!profile) throw new AppError(403, 'Usuário sem perfil cadastrado. Fale com um administrador');
  if (!profile.ativo) throw new AppError(403, 'Usuário desativado');

  req.user = {
    id: profile.id,
    email: data.user.email,
    nome: profile.nome,
    perfil: profile.perfil,
  };
  next();
});

// Uso: router.post('/', requirePerfil('admin', 'operador'), ...)
const requirePerfil =
  (...perfis) =>
  (req, res, next) => {
    if (!perfis.includes(req.user.perfil)) {
      return next(new AppError(403, `Acesso negado. Perfis permitidos: ${perfis.join(', ')}`));
    }
    next();
  };

module.exports = { authenticate, requirePerfil };
