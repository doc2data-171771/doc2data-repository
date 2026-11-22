# doc2data

MVP de **automação documental**: recebe documentos (um a um ou em lote), lê o conteúdo com IA, deixa uma pessoa conferir os dados extraídos e exporta tudo para uma planilha. Um assistente de IA responde perguntas sobre os dados dos documentos.

Projeto desenvolvido para o desafio **ENIAC LINK+** ("MVP de automação documental"), com a Otpro Capital e a Sofipe Corretora.

## Como funciona

```
Documento  →  Leitura com IA  →  Dados extraídos  →  Conferência humana  →  Planilha (xlsx/csv)
(PDF/imagem)    (Gemini)          (JSON + confiança)   (aprova/corrige/rejeita)    ou Assistente IA
```

O status de cada documento acompanha o fluxo:

`recebido` → `processando` → `extraido` → `validado` (ou `rejeitado`). Se a leitura falhar, o status vira `erro` e o documento pode ser processado de novo.

## Estrutura do repositório

```
doc2data-api/   API em Node.js + Express (ver doc2data-api/README.md)
web/            Front-end em React + TypeScript + Vite (ver web/README.md)
supabase/
  migrations/       tabelas base
  complementar.sql  buckets do Storage, índices e cadastros iniciais
  seed.sql          dados de teste
```

## Contas

Qualquer pessoa cria a própria conta pela tela de login ("Criar conta"). Cada conta enxerga e mexe **apenas nos próprios documentos**, conferências e planilhas: a API filtra tudo pelo dono (`documentos.enviado_por`). Não há área de administração.

Os cadastros de **canais** e **tipos de documento** são compartilhados por todas as contas e mantidos direto no banco (`supabase/complementar.sql`).

## Tecnologias

- **Front-end:** React, TypeScript, Vite, Tailwind CSS e TanStack Query
- **API:** Node.js 20+, Express
- **Banco de dados, login e arquivos:** Supabase (PostgreSQL, Auth e Storage)
- **IA:** Google Gemini (leitura dos documentos e assistente)
- **Planilhas:** ExcelJS (`.xlsx`) e CSV
- **Hospedagem:** Vercel

## Banco de dados

Nove tabelas, todas com RLS (Row Level Security) ligado e sem políticas públicas. O acesso é feito somente pela API, com a chave `service_role` guardada no servidor.

| Tabela | Para que serve |
|---|---|
| `profiles` | Nome de cada conta (ligado ao usuário do Supabase Auth) |
| `canais` | Por onde o documento chegou (upload web, e-mail, lote) |
| `tipos_documento` | Classificação do documento |
| `documentos` | Um registro por arquivo enviado, com o status do fluxo e o dono (`enviado_por`) |
| `processamentos` | Cada tentativa de leitura pela IA (ferramenta, modelo, erro) |
| `dados_extraidos` | JSON extraído pela IA e o nível de confiança |
| `validacoes` | Aprovação, correção ou rejeição feita por uma pessoa |
| `exportacoes` | Planilhas geradas |
| `exportacao_documentos` | Quais documentos entraram em cada planilha |

## API

Todas as rotas, exceto `/health` e `/auth/*`, exigem o header `Authorization: Bearer <access_token>`.

| Rota | O que faz |
|---|---|
| `POST /auth/registro` | Cria uma conta (nome, e-mail e senha) e já devolve a sessão |
| `POST /auth/login` | Login (e-mail e senha) |
| `GET /me` | Dados do usuário logado |
| `POST /documentos/upload-url` | Registra documentos e devolve URLs para envio direto ao Storage |
| `GET /documentos` | Lista com filtros (`status`, `canal_id`, `tipo_documento_id`, `busca`) |
| `POST /documentos/:id/processar` | Lê o documento com IA e grava os dados extraídos |
| `POST /validacoes` | Aprova, corrige ou rejeita os dados extraídos |
| `POST /exportacoes` | Gera a planilha (`xlsx` ou `csv`) e devolve o link para baixar |
| `POST /assistente` | A IA analisa os dados dos documentos da conta e responde à instrução |
| `GET /canais`, `GET /tipos-documento` | Cadastros para classificar documentos |

A lista completa, com exemplos de requisição, está em [`doc2data-api/README.md`](doc2data-api/README.md).

## Como rodar no seu computador

Requisitos: Node.js 20 ou superior.

```bash
# API
cd doc2data-api
npm install
cp .env.example .env     # no Windows: copy .env.example .env  — depois preencha as chaves
npm run dev              # http://localhost:3000  (teste: /health → {"status":"ok"})

# Front-end (em outro terminal)
cd web
npm install
npm run dev              # http://localhost:5173
```

Por padrão o front roda em **modo demonstração** (dados fictícios, sem API). Para usar a API local, crie `web/.env.development.local` com:

```
VITE_API_URL=http://localhost:3000
VITE_MOCK=false
```

### Variáveis de ambiente da API

| Variável | Onde obter |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API (`anon public`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (`service_role`) |
| `GEMINI_API_KEY` | Google AI Studio |
| `GEMINI_MODEL` | Opcional (padrão: `gemini-4-hydrogen`) |
| `CORS_ORIGIN` | Endereço do front-end (use `*` apenas para testes) |

> **Segurança:** os arquivos `.env` nunca devem ir para o GitHub (o `.gitignore` já os bloqueia). A chave `service_role` dá acesso total ao banco e só pode existir no servidor, nunca no front-end.

## Banco de dados: primeira configuração

1. No **SQL Editor** do Supabase, rode `supabase/migrations/20261112000746_cria_tabelas_base.sql`.
2. Rode `supabase/complementar.sql` (buckets do Storage, índices e cadastros iniciais).
3. Pronto: as contas são criadas pela própria tela de cadastro.

## Publicação na Vercel

Dois projetos separados da Vercel, ambos ligados a este repositório:

| Projeto | Root Directory | O que publica |
|---|---|---|
| API | `doc2data-api` | A API (Express como função serverless) |
| Front-end | `web` | O app React (Framework Preset: Vite; variável `VITE_API_URL`) |

Para a API, cadastre as variáveis de ambiente em **Settings → Environment Variables** e faça um **Redeploy** sempre que alterá-las. Depois de publicar o front-end, coloque o endereço dele no `CORS_ORIGIN` da API.

## Organização do Git

- `main`: versão estável do projeto.
- Novas funcionalidades e testes são feitos em branches separados e depois mesclados por pull request.
- Nunca faça `git push --force` em branches compartilhados.

## Limitações conhecidas do MVP

- Arquivos aceitos: PDF, PNG, JPG e WEBP, de até 20 MB cada.
- A leitura com IA é feita um documento por vez e tem tempo limite de 60 segundos na Vercel. Se o Gemini estiver sobrecarregado, a leitura falha e pode ser refeita.
- O cadastro confirma o e-mail na hora, sem link de verificação.
- A validação grava em duas etapas (`validacoes` e `documentos.status`) sem transação. Se uma falhar, a API devolve erro e a validação pode ser refeita.
