require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const sharp = require('sharp');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { pool, initDb } = require('./db');

const execFileAsync = promisify(execFile);

const app = express();
const PORT = process.env.PORT || 4000;
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbs');
const DIST_DIR = path.join(__dirname, '../frontend/dist');
fs.mkdirSync(THUMB_DIR, { recursive: true }); // también crea UPLOAD_DIR

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('Falta JWT_SECRET en backend/.env (mínimo 32 caracteres). Mirá el paso 2.');
  process.exit(1);
}
const ALLOW_REGISTER = process.env.ALLOW_REGISTER !== 'false';

const COOKIE_OPTS = {
  httpOnly: true,   // JavaScript del navegador no puede leer la cookie
  sameSite: 'lax',  // no se envía desde otros sitios (protege de CSRF)
  secure: process.env.COOKIE_SECURE === 'true', // true solo si usás HTTPS
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
};

// Hash de relleno: se compara cuando el usuario no existe, para que
// la respuesta tarde lo mismo y no se pueda adivinar qué usuarios hay
const DUMMY_HASH = bcrypt.hashSync('contraseña-de-relleno', 10);

app.disable('x-powered-by'); // no avisar que usamos Express
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); // el navegador no adivina tipos
  res.setHeader('X-Frame-Options', 'DENY');           // nadie puede meter la app en un iframe
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.json());
app.use(cookieParser());
// ---------- Utilidades ----------

// Multer a veces entrega nombres con tildes mal decodificados ("canciÃ³n").
function fixName(name) {
  const fixed = Buffer.from(name, 'latin1').toString('utf8');
  return fixed.includes('\uFFFD') ? name : fixed;
}

// Escapa % y _ para que la búsqueda no los trate como comodines
const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

// Deduce el dispositivo a partir del User-Agent del navegador
function parseDevice(ua = '') {
  let os = 'Dispositivo desconocido';
  if (/iPhone/.test(ua)) os = 'iPhone';
  else if (/iPad/.test(ua)) os = 'iPad';
  else if (/Android/.test(ua)) {
    const m = ua.match(/Android [\d.]+; ([^;)]+)/);
    const model = m && m[1].trim();
    os = model && model !== 'K' && !/^Build/.test(model) ? `Android (${model})` : 'Android';
  } else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'Mac';
  else if (/CrOS/.test(ua)) os = 'Chromebook';
  else if (/Linux/.test(ua)) os = 'Linux';

  let browser = 'navegador desconocido';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox\/|FxiOS/.test(ua)) browser = 'Firefox';
  else if (/Chrome\/|CriOS/.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  return `${os} · ${browser}`;
}

// Miniatura WebP de 480px. Devuelve el nombre o null si falla (por ejemplo HEIC).
async function makeThumb(storedName) {
  const thumbName = path.parse(storedName).name + '.webp';
  try {
    await sharp(path.join(UPLOAD_DIR, storedName))
      .rotate()
      .resize({ width: 480, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(path.join(THUMB_DIR, thumbName));
    return thumbName;
  } catch (err) {
    console.warn('Sin miniatura para', storedName, '-', err.message);
    return null;
  }
}

// ---------- Metadatos ----------

async function imageMeta(fullPath) {
  try {
    const m = await sharp(fullPath).metadata();
    const rotated = m.orientation >= 5; // orientaciones 5 a 8 giran la foto 90°
    return {
      width: rotated ? m.height : m.width,
      height: rotated ? m.width : m.height,
      format: m.format,
      colorSpace: m.space,
      hasAlpha: m.hasAlpha,
      density: m.density,
    };
  } catch {
    return {};
  }
}

// Videos y audios: usa ffprobe (viene con ffmpeg)
async function probeMedia(fullPath, kind) {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', fullPath],
      { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
    );
    const info = JSON.parse(stdout);
    const streams = info.streams || [];
    const fmt = info.format || {};
    // En un audio, la "portada" aparece como stream de video: la ignoramos
    const video = kind === 'video' ? streams.find((s) => s.codec_type === 'video') : null;
    const audio = streams.find((s) => s.codec_type === 'audio');
    const tags = Object.fromEntries(
      Object.entries(fmt.tags || {}).map(([k, v]) => [k.toLowerCase(), v])
    );

    const meta = {
      container: fmt.format_long_name || fmt.format_name,
      duration: fmt.duration ? Number(fmt.duration) : undefined,
      bitrate: fmt.bit_rate ? Number(fmt.bit_rate) : undefined,
      title: tags.title,
      artist: tags.artist,
      album: tags.album,
    };

    if (video) {
      const sideRotation = video.side_data_list?.find((d) => d.rotation !== undefined)?.rotation;
      const rotation = Math.abs(Number(sideRotation ?? video.tags?.rotate ?? 0));
      const swap = rotation === 90 || rotation === 270; // videos grabados en vertical
      const [n, d] = String(video.avg_frame_rate || '0/1').split('/').map(Number);
      const fps = d ? n / d : 0;
      meta.width = swap ? video.height : video.width;
      meta.height = swap ? video.width : video.height;
      meta.fps = fps > 0 ? Math.round(fps * 100) / 100 : undefined;
      meta.videoCodec = video.codec_name;
      meta.createdAt = tags.creation_time;
    }
    if (audio) {
      meta.audioCodec = audio.codec_name;
      meta.sampleRate = audio.sample_rate ? Number(audio.sample_rate) : undefined;
      meta.channels = audio.channels;
    }
    return meta;
  } catch (err) {
    if (err.code === 'ENOENT') console.warn('ffprobe no está instalado: sudo apt install ffmpeg');
    else console.warn('No se pudieron leer metadatos de', path.basename(fullPath));
    return {};
  }
}

function extractMetadata(storedName, mime) {
  const full = path.join(UPLOAD_DIR, storedName);
  const kind = mime.split('/')[0];
  return kind === 'image' ? imageMeta(full) : probeMedia(full, kind);
}

// Completa miniaturas y metadatos de los archivos subidos antes de esta versión
async function backfill() {
  const { rows } = await pool.query(
    `SELECT id, stored_name, mime_type, thumb_name, (metadata IS NULL) AS needs_meta
       FROM files
      WHERE metadata IS NULL OR (thumb_name IS NULL AND mime_type LIKE 'image/%')`
  );
  for (const f of rows) {
    const thumb =
      f.thumb_name || (f.mime_type.startsWith('image/') ? await makeThumb(f.stored_name) : null);
    const meta = f.needs_meta ? await extractMetadata(f.stored_name, f.mime_type) : null;
    await pool.query(
      'UPDATE files SET thumb_name = COALESCE($1, thumb_name), metadata = COALESCE($2, metadata) WHERE id = $3',
      [thumb, meta ? JSON.stringify(meta) : null, f.id]
    );
  }
}

// ---------- Autenticación ----------

function setSession(res, user) {
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: '30d',
  });
  res.cookie('token', token, COOKIE_OPTS);
}

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Iniciá sesión para continuar' });
  try {
    req.user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }); // { id, username }
    next();
  } catch {
    res.clearCookie('token');
    res.status(401).json({ error: 'Tu sesión venció, volvé a iniciar sesión' });
  }
}

function credentialsError(username, password) {
  if (!/^[\w.-]{3,30}$/.test(username)) {
    return 'El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo';
  }
  if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
  if (Buffer.byteLength(password) > 72) return 'La contraseña es demasiado larga';
  return null;
}

// Los intentos fallidos de login se limitan por IP. Los exitosos no cuentan.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados registros desde esta dirección. Probá más tarde.' },
});
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);

app.post('/api/auth/register', async (req, res) => {
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  const problem = credentialsError(username, password);
  if (problem) return res.status(400).json({ error: problem });

  const { rows: [{ count }] } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (count > 0 && !ALLOW_REGISTER) {
    return res.status(403).json({ error: 'El registro está cerrado' });
  }

  const hash = await bcrypt.hash(password, 10);
  let user;
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, hash]
    );
    user = rows[0];
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });
    }
    throw err;
  }

  // La primera cuenta se queda con los archivos que ya existían
  if (count === 0) {
    await pool.query('UPDATE files SET user_id = $1 WHERE user_id IS NULL', [user.id]);
  }

  setSession(res, user);
  res.status(201).json(user);
});

app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  const { rows } = await pool.query(
    'SELECT id, username, password_hash FROM users WHERE LOWER(username) = LOWER($1)',
    [username]
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

  setSession(res, user);
  res.json({ id: user.id, username: user.username });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, username FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]) {
    res.clearCookie('token');
    return res.status(401).json({ error: 'Usuario inexistente' });
  }
  res.json(rows[0]);
});

// ---------- Todo lo de abajo requiere sesión ----------

// Archivos y miniaturas (express.static soporta "Range" para adelantar videos)
app.use(
  '/uploads',
  requireAuth,
  express.static(UPLOAD_DIR, {
    maxAge: '30d',
    immutable: true,
    // "private": que ninguna caché compartida guarde archivos que están tras un login
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'private, max-age=2592000, immutable');
      // Si alguien abre un archivo directo, el navegador no ejecuta nada de su contenido
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    },
  })
);
app.use('/api', requireAuth);

// Busca un archivo por :id. Si ownerOnly, exige que sea del usuario actual.
// Devuelve null (y ya respondió el error) si no corresponde seguir.
async function loadFile(req, res, { ownerOnly = false } = {}) {
  const id = /^\d{1,9}$/.test(req.params.id) ? Number(req.params.id) : 0;
  const { rows } = await pool.query('SELECT * FROM files WHERE id = $1', [id]);
  const file = rows[0];
  if (!file) {
    res.status(404).json({ error: 'No encontrado' });
    return null;
  }
  if (ownerOnly && file.user_id !== req.user.id) {
    res.status(403).json({ error: 'Solo el dueño del archivo puede hacer esto' });
    return null;
  }
  return file;
}

// ---------- Multer ----------
// Solo extensiones conocidas: evita que "algo.html" pase por imagen
const SAFE_EXT = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.heic', '.heif', '.bmp', '.tif', '.tiff',
  '.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi', '.3gp', '.ogv',
  '.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga', '.opus', '.flac', '.weba',
]);
const extOf = (name) => path.extname(name).toLowerCase();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, crypto.randomUUID() + extOf(file.originalname)),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB por archivo
  fileFilter: (req, file, cb) => {
    const mimeOk =
      /^(image|video|audio)\//.test(file.mimetype) && file.mimetype !== 'image/svg+xml';
    if (mimeOk && SAFE_EXT.has(extOf(file.originalname))) return cb(null, true);
    const err = new Error('Solo imágenes, videos y audios con extensión conocida (sin SVG)');
    err.status = 400;
    cb(err);
  },
});

// ---------- Rutas de archivos ----------

// Subir uno o varios archivos
app.post('/api/files', upload.array('files', 100), async (req, res) => {
  const device = parseDevice(req.get('user-agent') || '');
  const saved = [];
  for (const f of req.files) {
    const thumb = f.mimetype.startsWith('image/') ? await makeThumb(f.filename) : null;
    const meta = await extractMetadata(f.filename, f.mimetype);
    const { rows } = await pool.query(
      `INSERT INTO files (original_name, stored_name, mime_type, size, thumb_name, user_id, device, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [fixName(f.originalname), f.filename, f.mimetype, f.size, thumb, req.user.id, device, JSON.stringify(meta)]
    );
    saved.push({ ...rows[0], owner: req.user.username });
  }
  res.status(201).json(saved);
});

// Listar con filtros: ?type=image|video|audio  &q=texto  &limit=12
app.get('/api/files', async (req, res) => {
  const { type, q, limit } = req.query;
  const where = [];
  const params = [];

  if (['image', 'video', 'audio'].includes(type)) {
    params.push(`${type}/%`);
    where.push(`f.mime_type LIKE $${params.length}`);
  }
  if (typeof q === 'string' && q.trim()) {
    params.push(`%${escapeLike(q.trim())}%`);
    where.push(`f.original_name ILIKE $${params.length}`);
  }

  let sql = 'SELECT f.*, u.username AS owner FROM files f LEFT JOIN users u ON u.id = f.user_id';
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY f.created_at DESC';

  const lim = parseInt(limit, 10);
  if (lim > 0) {
    params.push(Math.min(lim, 200));
    sql += ` LIMIT $${params.length}`;
  }

  const { rows } = await pool.query(sql, params);
  res.json(rows);
});

// Resumen por tipo para la página de inicio
app.get('/api/stats', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT split_part(mime_type, '/', 1) AS type,
           COUNT(*)::int AS count,
           COALESCE(SUM(size), 0)::bigint AS size
    FROM files GROUP BY 1
  `);
  const stats = {
    image: { count: 0, size: 0 },
    video: { count: 0, size: 0 },
    audio: { count: 0, size: 0 },
  };
  for (const r of rows) {
    if (stats[r.type]) stats[r.type] = { count: Number(r.count), size: Number(r.size) };
  }
  res.json(stats);
});

// Renombrar (solo el dueño)
app.patch('/api/files/:id', async (req, res) => {
  const name = String(req.body?.name ?? '')
    .replace(/[\u0000-\u001f\u007f\/\\]/g, '')
    .trim();
  if (!name || name.length > 255) {
    return res.status(400).json({ error: 'El nombre no es válido (de 1 a 255 caracteres)' });
  }
  const file = await loadFile(req, res, { ownerOnly: true });
  if (!file) return;
  await pool.query('UPDATE files SET original_name = $1 WHERE id = $2', [name, file.id]);
  res.json({ ok: true, original_name: name });
});

// Descargar con el nombre original
app.get('/api/files/:id/download', async (req, res) => {
  const file = await loadFile(req, res);
  if (!file) return;
  res.download(path.join(UPLOAD_DIR, file.stored_name), file.original_name);
});

// Eliminar (solo el dueño): base de datos + archivo + miniatura
app.delete('/api/files/:id', async (req, res) => {
  const file = await loadFile(req, res, { ownerOnly: true });
  if (!file) return;
  await pool.query('DELETE FROM files WHERE id = $1', [file.id]);
  await fs.promises.unlink(path.join(UPLOAD_DIR, file.stored_name)).catch(() => {});
  if (file.thumb_name) {
    await fs.promises.unlink(path.join(THUMB_DIR, file.thumb_name)).catch(() => {});
  }
  res.json({ ok: true });
});

// Modo "producción": Express sirve el frontend compilado
app.use(express.static(DIST_DIR));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
    if (err) next();
  });
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || (err instanceof multer.MulterError ? 400 : 500);
  res.status(status).json({ error: err.message });
});

initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`Servidor en puerto ${PORT}`));
    backfill().catch((err) => console.error('Error completando metadatos:', err));
  })
  .catch((err) => {
    console.error('No se pudo conectar a PostgreSQL:', err.message);
    process.exit(1);
  });
