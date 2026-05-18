'use strict';

const { Pool, types } = require('pg');

// pg returns NUMERIC as string by default — parse as float
types.setTypeParser(1700, val => parseFloat(val));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

let schemaReady = false;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  TEXT,
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    monthly_income NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_by     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS budget_members (
    id         TEXT PRIMARY KEY,
    budget_id  TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    role       TEXT NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('admin', 'editor', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(budget_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS expense_items (
    id         TEXT PRIMARY KEY,
    budget_id  TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    category   TEXT NOT NULL,
    name       TEXT NOT NULL,
    amount     NUMERIC(10,2) NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(SCHEMA);
  schemaReady = true;
}

async function dbGet(sql, params) {
  await ensureSchema();
  const { rows } = await pool.query(sql, params);
  return rows[0];
}

async function dbAll(sql, params) {
  await ensureSchema();
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function dbRun(sql, params) {
  await ensureSchema();
  return pool.query(sql, params);
}

module.exports = { dbGet, dbAll, dbRun };
