# doc2data – Front-end (HTML/CSS/JS puro)

Sem framework e sem build. Abra `index.html` por um servidor estático (Vercel, GitHub Pages).

## Publicar na Vercel
1. Coloque esta pasta no repositório (ex.: `site/`).
2. Vercel > Settings > Root Directory = `site`; Framework = Other; sem Build/Output.
3. Se a API tiver outra URL, edite `API_URL` em `js/config.js`.
4. Na API (Vercel), `CORS_ORIGIN` = URL do front, e faça redeploy.

Nome da marca: `BRAND` em `js/config.js`.
