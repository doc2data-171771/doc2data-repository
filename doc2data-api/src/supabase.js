const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

const options = { auth: { autoRefreshToken: false, persistSession: false } };

// Cliente com a service_role: ignora o RLS. Como as tabelas têm RLS ligado e
// nenhuma política, é ESTE cliente (somente no back-end) que lê e grava no banco.
// A segurança fica nos middlewares da API (login + perfil).
const admin = createClient(config.supabase.url, config.supabase.serviceRoleKey, options);

// Cliente "anon" novo a cada uso, só para login/refresh (evita misturar sessões).
function anonClient() {
  return createClient(config.supabase.url, config.supabase.anonKey, options);
}

module.exports = { admin, anonClient };
