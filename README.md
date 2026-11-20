# Mi nube

Nube local con PERN (PostgreSQL, Express, React, Node): subida de imágenes, videos y audios,
carpetas por tipo, miniaturas, búsqueda, login con usuarios y propiedades de cada archivo.

## Requisitos
Node 20.19+, PostgreSQL, ffmpeg (`sudo apt install ffmpeg`).

## Puesta en marcha
1. Crear usuario y base en PostgreSQL (`nube_user` / `nube_db`).
2. `cd backend && cp .env.example .env` y completar los valores.
3. `npm install && npm run dev` (backend, puerto 4000).
4. En otra terminal: `cd frontend && npm install && npm run dev` (puerto 5173).
