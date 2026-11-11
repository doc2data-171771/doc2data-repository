import { autenticar, carregarPerfil } from '../auth.js';
import { HttpError } from '../http.js';
import { login, renovarSessao } from '../supabase.js';

export default function rotasAuth(router) {
  // Login: o front manda e-mail e senha e recebe o token para usar nas outras rotas.
  router.post('/auth/login', async (ctx) => {
    const { email, senha } = await ctx.json();
    if (typeof email !== 'string' || typeof senha !== 'string' || !email || !senha) {
      throw new HttpError(400, 'Informe "email" e "senha".');
    }
    const sessao = await login(email.trim(), senha);
    const usuario = await carregarPerfil(sessao.user);
    return {
      access_token: sessao.access_token,
      refresh_token: sessao.refresh_token,
      expires_in: sessao.expires_in, // segundos até o token vencer
      usuario,
    };
  });

  // Troca o refresh_token por um access_token novo (quando o antigo vence).
  router.post('/auth/refresh', async (ctx) => {
    const { refresh_token: refreshToken } = await ctx.json();
    if (typeof refreshToken !== 'string' || !refreshToken) {
      throw new HttpError(400, 'Informe "refresh_token".');
    }
    const sessao = await renovarSessao(refreshToken);
    return {
      access_token: sessao.access_token,
      refresh_token: sessao.refresh_token,
      expires_in: sessao.expires_in,
    };
  });

  // Quem sou eu? (o front usa para mostrar o nome e saber o perfil)
  router.get('/auth/me', autenticar, (ctx) => ({ usuario: ctx.usuario }));
}
