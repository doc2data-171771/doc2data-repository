# doc2data · web

Front-end do doc2data em **React + TypeScript + Vite**. Fala com a `doc2data-api` e cobre o fluxo inteiro do desafio:

**Entrada → Leitura com IA → Conferência humana → Planilha**

| Tela | Rota | Quem usa |
|---|---|---|
| Visão geral | `/` | todos |
| Entrada (upload único ou em lote) | `/entrada` | admin, operador |
| Documentos (lista, filtros, leitura com IA em fila) | `/documentos` | todos |
| Conferência individual (original ao lado da ficha) | `/documentos/:id` | admin, validador |
| Mesa de conferência (em lote) | `/conferencia` | admin, validador |
| Planilhas (exportação XLSX/CSV e histórico) | `/planilhas` | todos |
| Administração (pessoas, tipos, canais) | `/admin` | admin |

## Rodar

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

Em desenvolvimento, o `.env.development` liga o **modo demonstração** (`VITE_MOCK=true`): o app roda com dados fictícios no navegador, sem API nem Supabase. Para usar a API de verdade, crie um `.env.local`:

```
VITE_API_URL=http://localhost:3000
VITE_MOCK=false
```

## Publicar na Vercel

Crie um projeto apontando para este repositório com:

| Configuração | Valor |
|---|---|
| Root Directory | `web` |
| Framework Preset | Vite |
| Environment Variables | `VITE_API_URL=https://<endereço-da-api>` |

O `vercel.json` já redireciona as rotas para o `index.html`. Depois de publicar, coloque o endereço do front no `CORS_ORIGIN` da API e faça um Redeploy dela.

## Como funciona por dentro

- `src/lib/api.ts`: tipos (espelham as tabelas do Supabase) e o cliente HTTP, com token Bearer e renovação automática da sessão (`/auth/refresh`).
- `src/lib/mock.ts`: backend fictício do modo demonstração. Só é carregado quando `VITE_MOCK=true`.
- `src/lib/processador.tsx`: fila de leitura por IA no navegador. A API lê um documento por chamada (até ~60 s na Vercel), então o front roda 2 por vez em segundo plano.
- `src/lib/format.ts`: rótulos, formatação pt-BR e **verificações por campo** (dígito verificador de CPF/CNPJ, datas, campos vazios), que mostram onde conferir primeiro. A API ainda devolve só uma confiança geral.
- Upload: `POST /documentos/upload-url` e depois `PUT` direto no Storage pela URL assinada. O arquivo não passa pela API.
- Conferência: sem alterações, envia `aprovado`; com alterações, envia `corrigido` com o objeto final; para rejeitar, exige um motivo.

Atalhos na conferência individual: **A** aprova, **R** rejeita, **J/K** vão para o próximo/anterior, **Ctrl+Enter** aprova mesmo com o foco num campo.

## Identidade visual

"Mesa de conferência": papel quente, tinta quase preta e um único acento cor de carimbo. Os títulos usam a serifa editorial Instrument Serif, a interface usa Geist e números e códigos usam Geist Mono com algarismos tabulares. Um documento aprovado recebe um carimbo **CONFERIDO**. Há tema claro e escuro, e as fontes ficam no próprio pacote (sem CDN).

## Limitações conhecidas

- A mesa de conferência carrega os 50 documentos mais recentes a conferir (um detalhe por documento, porque a listagem da API não traz os dados extraídos).
- A tela de Planilhas mostra até 100 conferidos; "Exportar todos" usa `todos_validados` da API quando há mais.
