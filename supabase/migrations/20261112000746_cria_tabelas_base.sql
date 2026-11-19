-- doc2data: tabelas base (rodar nesta ordem)

-- 1) Tabelas sem dependencia
create table if not exists canais (
  id uuid primary key default gen_random_uuid(),
  nome varchar(30) not null unique,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists tipos_documento (
  id uuid primary key default gen_random_uuid(),
  nome varchar(80) not null unique,
  descricao text,
  ativo boolean not null default true
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome varchar(120) not null,
  perfil varchar(20) not null check (perfil in ('admin', 'operador', 'validador')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Documentos
create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  nome_arquivo varchar(255) not null,
  caminho_arquivo text not null,
  mime_type varchar(100) not null,
  tamanho_bytes bigint not null,
  status varchar(20) not null default 'recebido'
    check (status in ('recebido', 'processando', 'extraido', 'validado', 'rejeitado', 'erro')),
  canal_id uuid references canais(id),
  tipo_documento_id uuid references tipos_documento(id),
  enviado_por uuid references profiles(id),
  data_envio timestamptz not null default now()
);

-- 3) Processamento, extracao e validacao
create table if not exists processamentos (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references documentos(id) on delete cascade,
  status varchar(20) not null default 'em_andamento'
    check (status in ('em_andamento', 'concluido', 'erro')),
  ferramenta varchar(80) not null,
  modelo varchar(100),
  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  erro text
);

create table if not exists dados_extraidos (
  id uuid primary key default gen_random_uuid(),
  processamento_id uuid not null unique references processamentos(id) on delete cascade,
  dados jsonb not null,
  confianca numeric(5,2) check (confianca between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists validacoes (
  id uuid primary key default gen_random_uuid(),
  dados_extraidos_id uuid not null references dados_extraidos(id) on delete cascade,
  usuario_id uuid not null references profiles(id),
  status varchar(20) not null check (status in ('aprovado', 'corrigido', 'rejeitado')),
  dados_corrigidos jsonb,
  observacao text,
  validado_em timestamptz not null default now()
);

-- 4) Exportacao
create table if not exists exportacoes (
  id uuid primary key default gen_random_uuid(),
  formato varchar(10) not null check (formato in ('xlsx', 'csv')),
  caminho_arquivo text not null,
  status varchar(20) not null default 'pendente'
    check (status in ('pendente', 'gerado', 'erro')),
  solicitado_por uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists exportacao_documentos (
  exportacao_id uuid not null references exportacoes(id) on delete cascade,
  documento_id uuid not null references documentos(id),
  primary key (exportacao_id, documento_id)
);

-- 5) Seguranca: RLS ligado em tudo (sem politicas = a API publica nao enxerga nada)
alter table canais enable row level security;
alter table tipos_documento enable row level security;
alter table profiles enable row level security;
alter table documentos enable row level security;
alter table processamentos enable row level security;
alter table dados_extraidos enable row level security;
alter table validacoes enable row level security;
alter table exportacoes enable row level security;
alter table exportacao_documentos enable row level security;
