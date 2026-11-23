# doc2data-api

API (Node.js + Express + Supabase) do MVP de automação documental.

Fluxo: **enviar documento → IA lê e extrai os dados → pessoa confere/corrige → exporta para planilha ou pergunta ao assistente**.

## Como as tabelas do banco são usadas

| Tabela | Quem mexe | Para quê |
|---|---|---|
| `profiles` | `/auth` | Nome de cada conta |
| `canais`, `tipos_documento` | `/canais`, `/tipos-documento` | Cadastros compartilhados para classificar documentos |
| `documentos` | `/documentos` | Um registro por arquivo enviado; `status` acompanha o fluxo e `enviado_por` diz de quem é |
| `processamentos` | `POST /documentos/:id/processar` | Cada tentativa de leitura pela IA (guarda ferramenta, modelo, erro) |
| `dados_extraidos` | (criado no processamento) | JSON extraído pela IA + `confianca` |
| `validacoes` | `/validacoes` | Aprovação, correção ou rejeição humana |
| `exportacoes`, `exportacao_documentos` | `/exportacoes` | Planilhas geradas e quais documentos entraram |

Status do documento: `recebido` → `processando` → `extraido` → `validado` (ou `rejeitado`). Se a IA falhar: `erro` (dá para processar de novo).

**Cada conta só acessa o que é dela.** Todas as rotas de documentos, validações, exportações e o assistente filtram pelo usuário logado. Um documento de outra conta responde `404`.

## Passo a passo para colocar no ar

### 1. Banco (Supabase)
1. No **SQL Editor**, rode `../supabase/migrations/20261112000746_cria_tabelas_base.sql`.
2. Rode `../supabase/complementar.sql` (cria os buckets `documentos` e `exportacoes`, índices e cadastros iniciais).

> As tabelas estão com RLS ligado e sem políticas. Por isso a API usa a chave **service_role** (só no servidor). Ela ignora o RLS, então o isolamento entre contas é feito pela API.

### 2. Chaves
- Supabase → **Project Settings → API**: copie `Project URL`, `anon public` e `service_role`.
- Gemini: crie a chave no **Google AI Studio**. Se o modelo padrão estiver indisponível, troque com `GEMINI_MODEL`.

### 3. Rodar no seu computador
```bash
npm install
cp .env.example .env      # abra o .env e preencha as chaves
npm run dev               # http://localhost:3000
```
Teste: abra `http://localhost:3000/health` → deve aparecer `{"status":"ok"}`.

### 4. Publicar na Vercel
1. Na Vercel: **Add New → Project** → escolha o repositório, com **Root Directory** `doc2data-api` → **Deploy**.
2. Em **Settings → Environment Variables**, cadastre as variáveis do `.env.example` (sem `PORT`).
3. Faça **Redeploy**. A URL pública será algo como `https://seu-projeto.vercel.app`.
4. Em `CORS_ORIGIN`, coloque o endereço do front-end (ex.: `https://seu-front.vercel.app`).

**Nunca** coloque a `service_role` no front-end nem no GitHub.

## Como o front-end usa a API

Todas as rotas (exceto `/health` e `/auth/*`) exigem o header `Authorization: Bearer <access_token>`.

1. **Criar conta:** `POST /auth/registro` com `{ "nome": "...", "email": "...", "senha": "..." }` (senha de 8+ caracteres) → devolve a sessão, igual ao login.
2. **Login:** `POST /auth/login` com `{ "email": "...", "senha": "..." }` → devolve `access_token` e `refresh_token`. Quando expirar, `POST /auth/refresh` com `{ "refresh_token": "..." }`.
3. **Registrar o upload:** `POST /documentos/upload-url`
   ```json
   { "arquivos": [
       { "nome_arquivo": "rg.pdf", "mime_type": "application/pdf", "tamanho_bytes": 123456,
         "canal_id": "(opcional)", "tipo_documento_id": "(opcional)" }
   ] }
   ```
   Aceita um arquivo (objeto direto) ou lote (`arquivos`, até 50). Devolve, para cada um, o `documento` e `upload.{caminho, token, signed_url}`.
4. **Enviar o arquivo direto ao Storage:** `PUT` do arquivo em `upload.signed_url`. O arquivo não passa pela API porque a Vercel limita o corpo das requisições a cerca de 4,5 MB.
5. **Ler com IA:** `POST /documentos/:id/processar` (um por vez; em lote, o front chama em sequência).
6. **Conferir:** `POST /validacoes`
   ```json
   { "dados_extraidos_id": "...", "status": "aprovado" }
   { "dados_extraidos_id": "...", "status": "corrigido", "dados_corrigidos": { "nome": "..." } }
   { "dados_extraidos_id": "...", "status": "rejeitado", "observacao": "Imagem ilegível" }
   ```
   O `dados_extraidos_id` vem em `POST .../processar` ou em `GET /documentos/:id`.
7. **Exportar:** `POST /exportacoes` com `{ "formato": "xlsx", "documento_ids": ["..."] }` ou `{ "formato": "csv", "todos_validados": true }` → devolve `download_url` (link válido por 1 hora). A planilha usa o dado corrigido na conferência quando houver.
8. **Assistente:** `POST /assistente` com `{ "pergunta": "Some o valor das notas de novembro", "documento_ids": ["..."] }` (`documento_ids` é opcional) → devolve `{ "resposta": "...", "documentos_analisados": 12 }`. Usa até 100 documentos já lidos pela IA, só da conta logada.

## Endpoints

| Método e rota | Quem pode |
|---|---|
| `GET /health` | público |
| `POST /auth/registro`, `POST /auth/login`, `POST /auth/refresh` | público |
| `GET /me` | qualquer logado |
| `GET /canais`, `GET /tipos-documento` | qualquer logado |
| `POST/PATCH /canais`, `POST/PATCH /tipos-documento` | perfil `admin` no banco (contas criadas pelo cadastro não têm) |
| `POST /documentos/upload-url`, `GET /documentos`, `GET/PATCH/DELETE /documentos/:id`, `POST /documentos/:id/processar` | dono do documento |
| `POST /validacoes` | dono do documento |
| `POST/GET /exportacoes`, `GET /exportacoes/:id/download` | dono da exportação |
| `POST /assistente` | qualquer logado (analisa só os próprios documentos) |

Filtros de `GET /documentos`: `status`, `canal_id`, `tipo_documento_id`, `busca` (parte do nome), `page`, `limit`. Para a fila de conferência use `?status=extraido`.

## Extração e conferência automática

- **Campos padronizados** (`src/services/esquemas.js`): o prompt pede o tipo do documento e nomes fixos para o que é comum a todos (`emitente_nome`, `emitente_documento`, `destinatario_nome`, `data_emissao`, `data_vencimento`, `valor_total`, `chave_acesso`, `codigo_barras`, `linha_digitavel`...), além das listas `itens` (produtos ou lançamentos) e `parcelas`. Assim a planilha tem uma coluna por conceito.
- **Tipo do documento**: se o usuário não escolheu, o tipo identificado pela IA é gravado em `tipos_documento` (criado na hora, se ainda não existir).
- **Conferência automática** (`src/services/normalizacao.js`), feita depois de cada leitura:
  - converte linha digitável ↔ código de barras (boleto e contas de consumo), mesmo se a IA trocar os campos;
  - confere os dígitos verificadores de linha digitável, código de barras, chave de acesso (44 dígitos), CPF e CNPJ (inclusive alfanumérico);
  - compara a soma dos itens com o total da NF-e/NFC-e.

  Cada problema vira uma frase em `alertas_validacao` (mostrada em vermelho na tela de conferência, e o documento sai da aprovação em lote) e baixa a confiança em 10 pontos.
- **Planilha XLSX**: colunas comuns primeiro; listas de objetos (`itens`, `parcelas`) vão para abas próprias, com a coluna `arquivo` ligando ao documento. O CSV mantém as listas como JSON.
- Testes: `npm test` (Node, sem dependências extras).

## Limitações conhecidas do MVP
- Arquivos aceitos: PDF, PNG, JPG e WEBP de até 20 MB.
- A leitura com IA é síncrona (até 60 s na Vercel). Para volumes grandes, o ideal é uma fila em segundo plano. Se o Gemini estiver sobrecarregado, a leitura falha e pode ser refeita.
- O cadastro confirma o e-mail na hora (sem link de verificação).
- Validar grava em duas etapas (`validacoes` e depois `documentos.status`) sem transação. Se uma falhar, a API devolve erro e a validação pode ser refeita.
