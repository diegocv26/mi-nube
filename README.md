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

## HTTPS en la red local
1. `sudo apt install mkcert libnss3-tools` y `mkcert -install`.
2. `mkdir certs && mkcert -cert-file certs/cert.pem -key-file certs/key.pem localhost 127.0.0.1 ::1 TU-PC.local TU_IP`
3. `cd frontend && npm run build`, y luego `cd ../backend && npm run start:https` (puerto 4443).
4. Instalar `rootCA.pem` (carpeta de `mkcert -CAROOT`) en cada dispositivo. Nunca compartir `rootCA-key.pem`.
