// Arranque del servidor: HTTP simple (desarrollo) o HTTPS con redirección (uso en red local)
const fs = require('fs');
const http = require('http');
const https = require('https');

// Las subidas de videos grandes pueden tardar más que el límite por defecto de Node (5 minutos)
const UPLOAD_TIMEOUT_MS = 60 * 60 * 1000;

// Del encabezado Host saca solo el nombre (sin puerto) y descarta valores raros,
// para que nadie pueda usar la redirección para mandar a otro sitio.
function safeHost(hostHeader) {
  const m = /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::\d+)?$/i.exec(hostHeader || '');
  return m ? m[1] : 'localhost';
}

// Escucha en un puerto y, si falla al arrancar, explica el motivo en vez de mostrar un volcado de errores
function listen(server, port, onReady) {
  server.on('error', (err) => {
    if (server.listening) return console.error('Error del servidor:', err.message);
    if (err.code === 'EADDRINUSE') {
      console.error(`El puerto ${port} ya está en uso.`);
      console.error('Seguramente quedó otro backend corriendo. Mirá quién lo usa con:');
      console.error(`  ss -ltnp | grep ':${port}'`);
    } else if (err.code === 'EACCES') {
      console.error(`No hay permiso para usar el puerto ${port}.`);
    } else {
      console.error(`No se pudo abrir el puerto ${port}:`, err.message);
    }
    process.exit(1);
  });
  server.listen(port, '0.0.0.0', onReady);
}

function startServers(app, { port, httpsPort, useHttps, keyPath, certPath }) {
  if (!useHttps) {
    const server = http.createServer(app);
    server.requestTimeout = UPLOAD_TIMEOUT_MS;
    listen(server, port, () => console.log(`Servidor HTTP en puerto ${port}`));
    return [server];
  }

  let tls;
  try {
    tls = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  } catch (err) {
    console.error(`No se pudieron leer los certificados: ${err.message}`);
    console.error('Generalos con mkcert (paso 1 de la guía) y revisá HTTPS_KEY / HTTPS_CERT.');
    process.exit(1);
  }

  const secure = https.createServer({ ...tls, minVersion: 'TLSv1.2' }, app);
  secure.requestTimeout = UPLOAD_TIMEOUT_MS;
  listen(secure, httpsPort, () => console.log(`Servidor HTTPS en puerto ${httpsPort}`));

  // El puerto HTTP solo redirige al HTTPS (307 mantiene el método y no queda cacheada para siempre)
  const redirect = http.createServer((req, res) => {
    if (!req.url.startsWith('/')) {
      res.writeHead(400);
      return res.end();
    }
    try {
      res.writeHead(307, {
        Location: `https://${safeHost(req.headers.host)}:${httpsPort}${req.url}`,
      });
    } catch {
      res.writeHead(400);
    }
    res.end();
  });
  listen(redirect, port, () => console.log(`Puerto ${port}: redirige a HTTPS (${httpsPort})`));

  return [secure, redirect];
}

module.exports = { startServers, safeHost };
