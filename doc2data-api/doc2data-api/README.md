# doc2data-api

API do **MVP de automação documental**, feita para ficar **hospedada na Vercel**. Ela fica no meio do caminho:

```
Front-end  ──(JSON / upload)──►  ESTA API (Vercel)  ──►  Supabase (login + tabelas + arquivos)
```

O front **nunca** fala direto com o banco. Ele só fala com esta API, e a API cuida de login,
regras, banco e arquivos.

Fluxo que a API implementa (igual ao seu diagrama):

```
upload do documento → leitura automática (extrator) → dados extraídos
        → validação humana (aprova / corrige / rejeita) → planilha CSV
```

Não usa Express nem nenhum pacote externo: só o Node.js. Não precisa rodar `npm install`.

---

## 1. O que precisa existir no Supabase (peça para quem cuida do banco)

Sua parte é a API, então este é o "checklist de entrega" do banco. Se algum item faltar,
a API avisa com uma mensagem clara.

- [ ] As **9 tabelas** do modelo (`profiles`, `canais`, `tipos_documento`, `documentos`,
      `processamentos`, `dados_extraidos`, `validacoes`, `exportacoes`, `exportacao_documentos`)
      com os nomes de colunas exatamente como no modelo.
- [ ] Dois **buckets privados** no Storage: `documentos` e `exportacoes`
      (Supabase → Storage → New bucket → deixe **Public bucket desligado**).
- [ ] Pelo menos **um usuário administrador**:
  1. Supabase → Authentication → Users → *Add user* (e-mail e senha).
  2. Copie o `id` (UUID) do usuário criado e rode no SQL Editor:
     ```sql
     insert into profiles (id, nome, perfil, ativo, created_at, updated_at)
     values ('COLE-O-UUID-AQUI', 'Seu Nome', 'admin', true, now(), now());
     ```
- [ ] Se as colunas `status` e `perfil` tiverem regra `CHECK` no banco, os valores aceitos precisam ser
      os usados pela API (lista na seção 7). Se forem outros, é só editar `src/constants.js`.

> A API usa a chave **secreta** do Supabase, que ignora o RLS. Quem controla o acesso é a API
> (só usuário logado, ativo e com perfil cadastrado entra).

---

## 2. Publicar na Vercel, passo a passo

### 2.1 Contas
- Crie uma conta no **GitHub** (https://github.com).
- Crie uma conta na **Vercel** (https://vercel.com → *Sign Up* → *Continue with GitHub*).

### 2.2 Subir o código para o GitHub
1. No GitHub, clique no **+** (canto superior direito) → **New repository**.
2. Nome: `doc2data-api`. Marque **Private**. Clique em **Create repository**.
3. Na página do repositório vazio, clique no link **uploading an existing file**.
4. Descompacte o zip e **arraste para a página o CONTEÚDO da pasta `doc2data-api`**
   (`src`, `api`, `testes`, `package.json`, `vercel.json`, `.gitignore`, `.vercelignore`, `README.md`, `.env.example`).
   - Arquivos que começam com ponto (`.gitignore`, `.vercelignore`, `.env.example`) ficam ocultos:
     no Mac aperte `Cmd + Shift + .`; no Windows ative *Exibir → Itens ocultos*.
   - **Nunca envie um arquivo `.env` com suas chaves.** As chaves vão só no painel da Vercel (passo 2.3).
5. Clique em **Commit changes**.

> Prefere o terminal? Dentro da pasta: `git init`, `git add .`, `git commit -m "API doc2data"`,
> `git branch -M main`, `git remote add origin URL-DO-REPOSITORIO`, `git push -u origin main`.

### 2.3 Criar o projeto na Vercel
1. Na Vercel: **Add New… → Project**. Autorize o acesso ao GitHub e clique em **Import** no repositório `doc2data-api`.
2. Preencha assim:
   - **Framework Preset:** `Other`
   - **Root Directory:** deixe como está (a pasta onde está o `package.json`)
   - **Build Command** e **Output Directory:** deixe vazios
3. Abra **Environment Variables** e cadastre uma por uma (nome e valor):

   | Nome | Valor |
   |---|---|
   | `SUPABASE_URL` | Supabase → Project Settings → API → *Project URL* |
   | `SUPABASE_ANON_KEY` | chave pública (*anon* / *publishable*) |
   | `SUPABASE_SERVICE_KEY` | chave **secreta** (*service_role* / *secret*) |
   | `FRONTEND_URL` | endereço do seu front, ex.: `https://meu-front.vercel.app` (sem `/` no final). Por enquanto pode ser `*` |
   | `MAX_ARQUIVO_MB` | `4` |
   | `MAX_ARQUIVOS_POR_ENVIO` | `5` |
   | `EXTRATOR_ATRASO_MS` | `1000` |

   (Não precisa cadastrar `PORT`.)
4. Clique em **Deploy** e espere terminar.

### 2.4 Conferir que funcionou
A Vercel mostra o endereço da API, algo como `https://doc2data-api.vercel.app`.

1. Abra `https://SEU-ENDERECO.vercel.app/saude` no navegador. Deve mostrar `{"ok":true}`.
2. Teste o login (seção 4), trocando `localhost:3000` pelo seu endereço da Vercel.

### 2.5 Ligar o front-end
- No código do front, troque o endereço da API (`const API = ...`) pelo endereço da Vercel (exemplo na seção 5).
- Se o front for HTML/CSS/JS puro, ele também pode ficar na Vercel: crie **outro projeto** na Vercel com a pasta do front
  (*Framework Preset: Other*). O endereço que ele ganhar (`https://....vercel.app`) é o que vai em `FRONTEND_URL` da API.
- Depois de mudar qualquer variável: **Settings → Environment Variables**, edite, e vá em
  **Deployments → ⋯ (no último deploy) → Redeploy**. A mudança só vale depois de um novo deploy.

### 2.6 Atualizar a API depois
Alterou um arquivo? Suba a mudança no GitHub (*Add file → Upload files* ou `git push`).
A Vercel faz um novo deploy sozinha.

### 2.7 Se algo der errado

| O que aparece | O que fazer |
|---|---|
| `Faltam variáveis de ambiente na Vercel: ...` | Cadastre as variáveis (2.3) e faça **Redeploy** |
| Erro de **CORS** no console do navegador | `FRONTEND_URL` precisa ser exatamente o endereço do front (com `https://`, sem `/` no final). Depois, **Redeploy** |
| Abre uma tela de login da Vercel ou volta `401` em HTML | Você abriu um endereço de *Preview*. Use o endereço de **Produção** (o de `Domains`) |
| `413` / `FUNCTION_PAYLOAD_TOO_LARGE` | O envio passou de 4,5 MB (limite da Vercel). Envie arquivos menores, 1 por vez |
| `504` / `FUNCTION_INVOCATION_TIMEOUT` | A leitura do documento passou de 60 s |
| `O bucket "documentos" não existe...` | Peça para criarem os buckets no Supabase (seção 1) |
| `502 Não consegui falar com o Supabase` | `SUPABASE_URL` errado no painel da Vercel |

Os logs aparecem na Vercel: **Deployments → (deploy) → Logs**.

### 2.8 Particularidades da Vercel (já tratadas no código)
- **Leitura do documento:** na Vercel a função "congela" assim que responde, então a leitura roda **antes** da resposta
  (limite de 60 s). Por isso `POST /documentos` com `processar=true` já volta com o documento `processado`.
  No computador local ela continua em segundo plano.
- **Tamanho do envio:** a Vercel recusa requisições com mais de **4,5 MB** no total. Para lote, o front deve
  enviar **1 arquivo por requisição** (um `fetch` por arquivo).

---

## 3. Rodando no seu computador (opcional, só para testar)

1. Instale o **Node.js** (versão 22 recomendada; 20.6 ou mais nova também serve) em https://nodejs.org. Confira com `node -v`.
2. Abra o terminal **dentro** da pasta `doc2data-api`.
3. Crie o `.env`: Mac/Linux `cp .env.example .env` · Windows (PowerShell) `copy .env.example .env`.
4. Preencha o `.env` com os mesmos valores da tabela da seção 2.3.
5. Inicie: `npm start` → aparece `API no ar em http://localhost:3000`. (`npm run dev` reinicia sozinho ao editar.)
6. Abra http://localhost:3000/saude → `{"ok":true}`.

### Testes automáticos (não precisam de internet nem de Supabase)

```bash
npm test
```

Sobe a API e um Supabase "de mentirinha" e percorre o fluxo inteiro, inclusive o modo Vercel.
Se tudo estiver certo, termina com `# fail 0`.

---

## 4. Testando as rotas no terminal (antes de ligar o front)

```bash
# Endereço da API (troque pelo da Vercel; localmente é http://localhost:3000)
API=https://SEU-ENDERECO.vercel.app

# 1) Login — copie o "access_token" da resposta
curl -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@email.com","senha":"suasenha"}'

# 2) Guarde o token numa variável (Mac/Linux)
TOKEN="cole-o-access_token-aqui"

# 3) Quem sou eu?
curl $API/auth/me -H "Authorization: Bearer $TOKEN"

# 4) Enviar um PDF e já ler (arquivo de até 4 MB)
curl -X POST $API/documentos \
  -H "Authorization: Bearer $TOKEN" \
  -F "arquivo=@/caminho/do/arquivo.pdf" \
  -F "processar=true"

# 5) Ver o documento
curl $API/documentos/ID-DO-DOCUMENTO -H "Authorization: Bearer $TOKEN"
```

---

## 5. Como o front-end usa a API

Toda rota (menos `/`, `/saude`, `/auth/login` e `/auth/refresh`) exige o cabeçalho
`Authorization: Bearer <access_token>`. Erros sempre voltam como `{ "erro": "mensagem em português" }`.

```js
const API = 'https://SEU-ENDERECO.vercel.app'; // endereço da API na Vercel
let token = null;

// 1) Login
async function entrar(email, senha) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });
  const dados = await r.json();
  if (!r.ok) throw new Error(dados.erro);
  token = dados.access_token; // guarde (ex.: em memória) e use nas próximas chamadas
  return dados.usuario;
}

// Função auxiliar para chamar as outras rotas
async function chamar(metodo, caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(corpo && !(corpo instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
    body: corpo instanceof FormData ? corpo : corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await r.json();
  if (!r.ok) throw new Error(dados.erro);
  return dados;
}

// 2) Enviar documentos: UM arquivo por requisição (limite de 4,5 MB da Vercel).
//    <input type="file" multiple id="arquivos">
async function enviar(canalId, tipoId) {
  const resultados = [];
  for (const arquivo of document.getElementById('arquivos').files) {
    const form = new FormData();
    form.append('arquivo', arquivo);
    form.append('canal_id', canalId);
    form.append('tipo_documento_id', tipoId);
    form.append('processar', 'true'); // lê o documento (na Vercel, já volta "processado")
    resultados.push(await chamar('POST', '/documentos', form)); // { documentos: [...], falhas: [...] }
  }
  return resultados;
}

// 3) Ver o resultado da leitura
//    d.dados_extraidos.dados = o que foi lido; d.documento.status = 'processado' ou 'erro'
const ver = (id) => chamar('GET', `/documentos/${id}`);

// 4) Validação humana
const validar = (dadosExtraidosId, status, dadosCorrigidos, observacao) =>
  chamar('POST', `/dados-extraidos/${dadosExtraidosId}/validacoes`, {
    status, // 'aprovado' | 'corrigido' | 'rejeitado'
    dados_corrigidos: dadosCorrigidos, // só quando 'corrigido'
    observacao,
  });

// 5) Gerar a planilha e baixar
async function exportar(idsDosDocumentos) {
  const { exportacao } = await chamar('POST', '/exportacoes', { documento_ids: idsDosDocumentos });
  const { url } = await chamar('GET', `/exportacoes/${exportacao.id}/arquivo`);
  window.location.href = url; // baixa o CSV (o link vale 5 minutos)
}
```

---

## 6. Lista de rotas

| Método | Rota | O que faz |
|---|---|---|
| GET | `/` · `/saude` | Confere se a API está no ar |
| POST | `/auth/login` | `{email, senha}` → `{access_token, refresh_token, expires_in, usuario}` |
| POST | `/auth/refresh` | `{refresh_token}` → novo `access_token` |
| GET | `/auth/me` | Dados do usuário logado |
| GET | `/canais` · `/tipos-documento` | Lista (`?ativo=true` só os ativos) |
| POST | `/canais` · `/tipos-documento` | Cria `{nome, descricao}` (**só admin**) |
| PATCH | `/canais/:id` · `/tipos-documento/:id` | Edita `nome`, `descricao`, `ativo` (**só admin**) |
| POST | `/documentos` | Upload (multipart): `arquivo`/`arquivos`, `canal_id`, `tipo_documento_id`, `processar` |
| GET | `/documentos` | Lista. Filtros: `status`, `canal_id`, `tipo_documento_id`, `enviado_por`, `limite`, `offset` |
| GET | `/documentos/:id` | Documento + processamentos + dados extraídos + validações |
| GET | `/documentos/:id/arquivo` | Link temporário (5 min) do arquivo original |
| POST | `/documentos/:id/processar` | Inicia/refaz a leitura (responde 202) |
| GET | `/documentos/:id/processamentos` | Histórico de leituras do documento |
| GET | `/processamentos/:id` | Um processamento + dados extraídos |
| GET | `/dados-extraidos/:id` | Dados extraídos + validações |
| POST | `/dados-extraidos/:id/validacoes` | `{status, dados_corrigidos?, observacao?}` |
| POST | `/exportacoes` | `{documento_ids: [...], formato: "csv"}` → gera a planilha |
| GET | `/exportacoes` | Lista exportações |
| GET | `/exportacoes/:id` | Exportação + ids dos documentos |
| GET | `/exportacoes/:id/arquivo` | Link temporário (5 min) para baixar o CSV |

Regras do upload: PDF, PNG ou JPG (a API confere o conteúdo real, não só a extensão), até 4 MB por arquivo e
5 arquivos por envio (ajustável nas variáveis). Se o lote tiver arquivo inválido, **nada** é salvo.

---

## 7. Status usados (ficam em `src/constants.js`)

- **documentos.status:** `recebido` → `processando` → `processado` → `validado` (ou `rejeitado`) → `exportado`; `erro` se a leitura falhar
- **processamentos.status:** `processando`, `concluido`, `erro`
- **validacoes.status:** `aprovado`, `corrigido`, `rejeitado`
- **exportacoes.status:** `concluido`, `erro`
- **perfil:** `admin` pode criar/editar canais e tipos; qualquer outro perfil ativo usa o resto da API

---

## 8. O que ainda é provisório

- **A leitura é SIMULADA.** `src/services/extrator.js` devolve dados de exemplo (`ferramenta = "simulado"`).
  Esse é o único arquivo a trocar quando o OCR/IA real estiver pronto (o próprio arquivo explica o que receber e devolver).
  Se a leitura real demorar mais de 60 s, será preciso mudar o desenho (fila ou processo separado).
- **Documentos de até 4,5 MB por requisição** (limite da Vercel). PDFs escaneados costumam ser maiores. A solução é o front
  enviar direto para o Storage do Supabase por link assinado. Isso ainda não está implementado.
- **Só CSV** (abre no Excel, com acentos e vírgula decimal corretos). `.xlsx` ainda não.
- **Sem limite de tentativas de login** e sem logs de auditoria. Vale incluir antes de uso real.
- Foi testada com um Supabase simulado e **ainda não foi testada na Vercel de verdade**.
  O primeiro teste é o `/saude` e o login da seção 2.4.

## 9. Mapa das pastas

```
api/index.js         entrada da API na Vercel
vercel.json          manda todas as rotas para api/index.js e define o tempo máximo (60 s)
src/
  server.js          liga o servidor local (npm start)
  app.js             registra as rotas e trata erros
  config.js          lê as variáveis (.env local ou painel da Vercel)
  constants.js       status, perfil e nomes dos buckets
  http.js            mini-router, leitura de JSON/upload, CORS
  supabase.js        fala com Auth, banco e Storage
  auth.js            confere o token e o perfil do usuário
  routes/            uma pasta por assunto (auth, catálogos, documentos, ...)
  services/          extrator (simulado), leitura do documento, CSV
testes/              testes automáticos + Supabase de mentirinha
```
