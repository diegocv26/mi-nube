require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Un nombre de usuario por persona, sin distinguir mayúsculas ("Diego" = "diego")
  await pool.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username))'
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS files (
      id            SERIAL PRIMARY KEY,
      original_name TEXT NOT NULL,
      stored_name   TEXT NOT NULL UNIQUE,
      mime_type     TEXT NOT NULL,
      size          BIGINT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Columnas nuevas: no tocan tus datos actuales
  await pool.query('ALTER TABLE files ADD COLUMN IF NOT EXISTS thumb_name TEXT');
  await pool.query(
    'ALTER TABLE files ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL'
  );
  await pool.query('ALTER TABLE files ADD COLUMN IF NOT EXISTS device TEXT');
  await pool.query('ALTER TABLE files ADD COLUMN IF NOT EXISTS metadata JSONB');
  await pool.query('CREATE INDEX IF NOT EXISTS files_user_id_idx ON files (user_id)');
}

module.exports = { pool, initDb };
