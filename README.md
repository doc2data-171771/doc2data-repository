# doc2data

MVP de **automação documental**: recebe documentos (um a um ou em lote), lê o conteúdo com IA, deixa uma pessoa conferir os dados extraídos e exporta tudo para uma planilha.

Projeto desenvolvido para o desafio **ENIAC LINK+** ("MVP de automação documental"), com a Otpro Capital e a Sofipe Corretora.

## Como funciona

```
Documento  →  Leitura com IA  →  Dados extraídos  →  Validação humana  →  Planilha (xlsx/csv)
(PDF/imagem)    (Gemini)          (JSON + confiança)   (aprova/corrige/rejeita)
```

O status de cada documento acompanha o fluxo:

`recebido` → `processando` → `extraido` → `validado` (ou `rejeitado`). Se a leitura falhar, o status vira `erro` e o documento pode ser processado de novo.

## Estrutura do repositório

| Pasta | O que contém |
|---|---|
| `MVP/` | Front-end: site em HTML, CSS e JavaScript (`index.html`) |
| `doc2data-api/` | API em Node.js + Express (código, scripts SQL e documentação própria) |
| `supabase/` | Arquivos do banco de dados no Supabase |

A documentação detalhada da API está em [`doc2data-api/README.md`](doc2data-api/README.md).

## Tecnologias

- **Front-end:** HTML, CSS e JavaScript
- **API:** Node.js 20+, Express
- **Banco de dados, login e arquivos:** Supabase (PostgreSQL, Auth e Storage)
- **IA para leitura dos documentos:** Google Gemini
- **Planilhas:** ExcelJS (`.xlsx`) e CSV
- **Hospedagem:** Vercel

## Banco de dados

Nove tabelas, todas com RLS (Row Level Security) ligado e sem políticas públicas. O acesso é feito somente pela API, com a chave `service_role` guardada no servidor.

| Tabela | Para que serve |
|---|---|
| `profiles` | Usuários e seus perfis: `admin`, `operador` ou `validador` |
| `canais` | Por onde o documento chegou (upload web, e-mail, lote) |
| `tipos_documento` | Classificação do documento |
| `documentos` | Um registro por arquivo enviado, com o status do fluxo |
| `processamentos` | Cada tentativa de leitura pela IA (ferramenta, modelo, erro) |
| `dados_extraidos` | JSON extraído pela IA e o nível de confiança |
| `validacoes` | Aprovação, correção ou rejeição feita por uma pessoa |
| `exportacoes` | Planilhas geradas |
| `exportacao_documentos` | Quais documentos entraram em cada planilha |

## Perfis de usuário

| Perfil | Pode |
|---|---|
| `admin` | Tudo, incluindo criar usuários e cadastros |
| `operador` | Enviar documentos e processá-los com IA |
| `validador` | Aprovar, corrigir ou rejeitar os dados extraídos |

## API

Todas as rotas, exceto `/health` e `/auth/*`, exigem o header `Authorization: Bearer <access_token>`.

| Rota | O que faz |
|---|---|
| `POST /auth/login` | Login (e-mail e senha) |
| `GET /me` | Dados do usuário logado |
| `POST /documentos/upload-url` | Registra documentos e devolve URLs para envio direto ao Storage |
| `GET /documentos` | Lista com filtros (`status`, `canal_id`, `tipo_documento_id`, `busca`) |
| `POST /documentos/:id/processar` | Lê o documento com IA e grava os dados extraídos |
| `POST /validacoes` | Aprova, corrige ou rejeita os dados extraídos |
| `POST /exportacoes` | Gera a planilha (`xlsx` ou `csv`) e devolve o link para baixar |
| `/canais`, `/tipos-documento`, `/usuarios` | Cadastros |

A lista completa, com exemplos de requisição, está em [`doc2data-api/README.md`](doc2data-api/README.md).

## Como rodar a API no seu computador

Requisitos: Node.js 20 ou superior.

```bash
cd doc2data-api
npm install
cp .env.example .env     # no Windows: copy .env.example .env
# preencha o .env com as suas chaves
npm run dev              # http://localhost:3000
```

Teste: abra `http://localhost:3000/health`. Deve aparecer `{"status":"ok"}`.

### Variáveis de ambiente

| Variável | Onde obter |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API (`anon public`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (`service_role`) |
| `GEMINI_API_KEY` | Google AI Studio |
| `GEMINI_MODEL` | Opcional (padrão: `gemini-2.5-flash`) |
| `CORS_ORIGIN` | Endereço do front-end (use `*` apenas para testes) |

> **Segurança:** o arquivo `.env` nunca deve ir para o GitHub (o `.gitignore` já o bloqueia). A chave `service_role` dá acesso total ao banco e só pode existir no servidor, nunca no front-end.

## Banco de dados: primeira configuração

1. No **SQL Editor** do Supabase, rode o SQL das tabelas base.
2. Rode `doc2data-api/sql/complementar.sql` (buckets do Storage, índices e cadastros iniciais).
3. Crie o primeiro admin: cadastre o usuário em Authentication → Users e depois insira a linha correspondente em `profiles` (o passo a passo está no próprio `complementar.sql`).

## Publicação na Vercel

O repositório tem duas partes publicadas em **dois projetos separados** da Vercel, ambos ligados a este repositório:

| Projeto | Root Directory | O que publica |
|---|---|---|
| API | `doc2data-api` | A API (Express como função serverless) |
| Front-end | `MVP` | O site estático (Framework Preset: Other, sem build) |

Para a API, cadastre as variáveis de ambiente em **Settings → Environment Variables** e faça um **Redeploy** sempre que alterá-las. Depois de publicar o front-end, troque o `CORS_ORIGIN` da API para o endereço dele.

## Organização do Git

- `main`: versão estável do projeto.
- Novas funcionalidades e testes são feitos em branches separados e depois mesclados.
- Nunca faça `git push --force` em branches compartilhados.

## Limitações conhecidas do MVP

- Arquivos aceitos: PDF, PNG, JPG e WEBP, de até 20 MB cada.
- A leitura com IA é feita um documento por vez e tem tempo limite de 60 segundos na Vercel. Para grandes volumes, o ideal é uma fila em segundo plano.
- A validação grava em duas etapas (`validacoes` e `documentos.status`) sem transação. Se uma falhar, a API devolve erro e a validação pode ser refeita.
