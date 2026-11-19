-- doc2data: complemento ao SQL das tabelas base (rodar DEPOIS dele, no SQL Editor do Supabase)

-- 1) Buckets PRIVADOS do Storage (arquivos enviados e planilhas geradas)
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false),
       ('exportacoes', 'exportacoes', false)
on conflict (id) do nothing;

-- 2) Indices para as listagens e filtros da API
create index if not exists idx_documentos_status       on documentos (status);
create index if not exists idx_documentos_data_envio   on documentos (data_envio desc);
create index if not exists idx_documentos_canal        on documentos (canal_id);
create index if not exists idx_documentos_tipo         on documentos (tipo_documento_id);
create index if not exists idx_processamentos_doc      on processamentos (documento_id, iniciado_em desc);
create index if not exists idx_validacoes_dados        on validacoes (dados_extraidos_id, validado_em desc);
create index if not exists idx_exportacao_docs_doc     on exportacao_documentos (documento_id);

-- 3) (Opcional) Exemplos de cadastros iniciais - ajuste aos documentos reais do projeto
insert into canais (nome, descricao) values
  ('upload_web', 'Envio manual pelo site'),
  ('email',      'Recebido por e-mail'),
  ('lote',       'Envio em lote')
on conflict (nome) do nothing;

insert into tipos_documento (nome, descricao) values
  ('Documento de identificação', 'RG, CNH ou similar'),
  ('Comprovante de residência',  'Conta de consumo ou similar'),
  ('Outro',                      'Tipo não classificado')
on conflict (nome) do nothing;

-- 4) PRIMEIRO ADMIN (a API só deixa entrar quem tem linha em "profiles")
--    a) No painel: Authentication > Users > Add user (marque "Auto Confirm User")
--    b) Copie o "User UID" do usuário criado e rode (trocando os valores):
--
-- insert into profiles (id, nome, perfil)
-- values ('COLE-O-USER-UID-AQUI', 'Seu Nome', 'admin');
--
--    Depois disso, os demais usuários são criados pela própria API (POST /usuarios).
