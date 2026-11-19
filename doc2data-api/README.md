# doc2data-api

API (Node.js + Express + Supabase) do MVP de automação documental.

Fluxo: **enviar documento → IA lê e extrai os dados → pessoa valida/corrige → exporta para planilha**.

## Como as tabelas do banco são usadas

| Tabela | Quem mexe | Para quê |
|---|---|---|
| `profiles` | `/auth`, `/usuarios` | Perfil de cada usuário: `admin`, `operador` ou `validador` |
| `canais`, `tipos_documento` | `/canais`, `/tipos-documento` | Cadastros usados para classificar documentos |
| `documentos` | `/documentos` | Um registro por arquivo enviado; o campo `status` acompanha o fluxo |
| `processamentos` | `POST /documentos/:id/processar` | Cada tentativa de leitura pela IA (guarda ferramenta, modelo, erro) |
| `dados_extraidos` | (criado no processamento) | JSON extraído pela IA + `confianca` |
| `validacoes` | `/validacoes` | Aprovação, correção ou rejeição humana |
| `exportacoes`, `exportacao_documentos` | `/exportacoes` | Planilhas geradas e quais documentos entraram |

Status do documento: `recebido` → `processando` → `extraido` → `validado` (ou `rejeitado`). Se a IA falhar: `erro` (dá para processar de novo).

## Passo a passo para colocar no ar

### 1. Banco (Supabase)
1. Rode no **SQL Editor** o SQL das tabelas base (o que você já tem).
2. Rode o arquivo `sql/complementar.sql` (cria os buckets `documentos` e `exportacoes`, índices e exemplos de cadastro). Como o banco não é com você, pode passar este arquivo para quem cuida dele.
3. Crie o primeiro admin: siga o item 4 dentro do `sql/complementar.sql`.

> As tabelas estão com RLS ligado e sem políticas. Por isso a API usa a chave **service_role** (só no servidor). Ela ignora o RLS, então a segurança fica nos perfis da API.

### 2. Chaves
- Supabase → **Project Settings → API**: copie `Project URL`, `anon public` e `service_role`.
- Gemini: crie a chave no **Google AI Studio**. Confira na documentação se o nome do modelo em `GEMINI_MODEL` ainda é o atual.

### 3. Rodar no seu computador (para testar)
```bash
npm install
cp .env.example .env      # abra o .env e preencha as chaves
npm run dev               # http://localhost:3000
```
Teste: abra `http://localhost:3000/health` → deve aparecer `{"status":"ok"}`.

### 4. Publicar na Vercel
1. Suba esta pasta para um repositório no GitHub (o `.gitignore` já impede o envio do `.env`).
2. Na Vercel: **Add New → Project** → escolha o repositório → **Deploy**.
3. Em **Settings → Environment Variables**, cadastre as mesmas variáveis do `.env.example` (sem `PORT`).
4. Faça **Redeploy**. A URL pública será algo como `https://seu-projeto.vercel.app`.
5. Em `CORS_ORIGIN`, coloque o endereço do front-end (ex.: `https://seu-front.vercel.app`).

**Nunca** coloque a `service_role` no front-end nem no GitHub.

## Como o front-end usa a API

Todas as rotas (exceto `/health` e `/auth/*`) exigem o header `Authorization: Bearer <access_token>`.

1. **Login:** `POST /auth/login` com `{ "email": "...", "senha": "..." }` → devolve `access_token` e `refresh_token`. Quando expirar, `POST /auth/refresh` com `{ "refresh_token": "..." }`.
2. **Registrar o upload:** `POST /documentos/upload-url`
   ```json
   { "arquivos": [
       { "nome_arquivo": "rg.pdf", "mime_type": "application/pdf", "tamanho_bytes": 123456,
         "canal_id": "(opcional)", "tipo_documento_id": "(opcional)" }
   ] }
   ```
   Aceita um arquivo (objeto direto) ou lote (`arquivos`, até 50). Devolve, para cada um, o `documento` e `upload.{caminho, token}`.
3. **Enviar o arquivo direto ao Storage** (no front-end, com `@supabase/supabase-js` e a chave `anon`):
   ```js
   await supabase.storage.from('documentos').uploadToSignedUrl(upload.caminho, upload.token, arquivo)
   ```
   O arquivo não passa pela API porque a Vercel limita o corpo das requisições a cerca de 4,5 MB.
4. **Ler com IA:** `POST /documentos/:id/processar` (um por vez; em lote, o front chama em sequência).
5. **Validar:** `POST /validacoes`
   ```json
   { "dados_extraidos_id": "...", "status": "aprovado" }
   { "dados_extraidos_id": "...", "status": "corrigido", "dados_corrigidos": { "nome": "..." } }
   { "dados_extraidos_id": "...", "status": "rejeitado", "observacao": "Imagem ilegível" }
   ```
   O `dados_extraidos_id` vem em `POST .../processar` ou em `GET /documentos/:id`.
6. **Exportar:** `POST /exportacoes` com `{ "formato": "xlsx", "documento_ids": ["..."] }` ou `{ "formato": "csv", "todos_validados": true }` → devolve `download_url` (link válido por 1 hora). A planilha usa o dado corrigido pelo validador quando houver.

## Endpoints

| Método e rota | Quem pode |
|---|---|
| `POST /auth/login`, `POST /auth/refresh` | público |
| `GET /me` | qualquer logado |
| `GET/POST/PATCH /usuarios` | admin |
| `GET /canais`, `GET /tipos-documento` | qualquer logado |
| `POST/PATCH /canais`, `POST/PATCH /tipos-documento` | admin |
| `POST /documentos/upload-url` | admin, operador |
| `GET /documentos`, `GET /documentos/:id` | qualquer logado |
| `PATCH /documentos/:id`, `POST /documentos/:id/processar` | admin, operador |
| `DELETE /documentos/:id` | admin |
| `GET /processamentos`, `GET /processamentos/:id` | qualquer logado |
| `GET /validacoes` | qualquer logado |
| `POST /validacoes` | admin, validador |
| `POST/GET /exportacoes`, `GET /exportacoes/:id/download` | qualquer logado |

Filtros de `GET /documentos`: `status`, `canal_id`, `tipo_documento_id`, `busca` (parte do nome), `page`, `limit`. Para a fila de validação use `?status=extraido`.

## Limitações conhecidas do MVP
- Arquivos aceitos: PDF, PNG, JPG e WEBP de até 20 MB.
- A leitura com IA é síncrona (até 60 s na Vercel). Para volumes grandes, o ideal é uma fila em segundo plano.
- Validar grava em duas etapas (`validacoes` e depois `documentos.status`) sem transação. Se uma falhar, a API devolve erro e a validação pode ser refeita.
