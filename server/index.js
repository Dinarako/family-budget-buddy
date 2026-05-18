'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const initSqlJs = require('sql.js');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret-change-in-production';
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'budget.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── sql.js helpers ───────────────────────────────────────────────────────────

let db;

function save() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function dbGet(sql, params) {
  const stmt = db.prepare(sql);
  if (params && params.length) stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : undefined;
  stmt.free();
  return row;
}

function dbAll(sql, params) {
  const stmt = db.prepare(sql);
  if (params && params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function dbRun(sql, params) {
  db.run(sql, params || []);
  save();
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    monthly_income REAL NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS budget_members (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(budget_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS expense_items (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`;

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:4173',
    'http://localhost:3000',
  ],
  credentials: true,
}));
app.use(express.json());

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getBudgetMemberRole(budgetId, userId) {
  const row = dbGet(
    'SELECT role FROM budget_members WHERE budget_id = ? AND user_id = ?',
    [budgetId, userId]
  );
  return row ? row.role : null;
}

function formatUser(user) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name || null,
    avatar_url: user.avatar_url || null,
    created_at: user.created_at,
  };
}

// ─── Auth routes ─────────────────────────────────────────────────────────────

app.post('/api/auth/register', (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase()])) {
    return res.status(400).json({ error: 'An account with this email already exists' });
  }
  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);
  dbRun(
    'INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
    [id, email.toLowerCase(), passwordHash, displayName || email.split('@')[0]]
  );
  const user = dbGet('SELECT id, email, display_name, avatar_url, created_at FROM users WHERE id = ?', [id]);
  const token = jwt.sign({ sub: id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: formatUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: formatUser(user) });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = dbGet(
    'SELECT id, email, display_name, avatar_url, created_at FROM users WHERE id = ?',
    [req.userId]
  );
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: formatUser(user) });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const user = dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (user) {
    dbRun(
      "UPDATE users SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
      [bcrypt.hashSync(newPassword, 10), user.id]
    );
  }
  res.json({ success: true });
});

app.put('/api/auth/update-password', requireAuth, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  dbRun(
    "UPDATE users SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    [bcrypt.hashSync(newPassword, 10), req.userId]
  );
  res.json({ success: true });
});

// ─── User routes ─────────────────────────────────────────────────────────────

app.get('/api/users/search', requireAuth, (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email query param required' });
  const user = dbGet(
    'SELECT id, email, display_name FROM users WHERE email = ?',
    [String(email).toLowerCase()]
  );
  if (!user) return res.status(404).json({ error: 'No account found with that email' });
  res.json({ user: { id: user.id, email: user.email, display_name: user.display_name } });
});

// ─── Budget routes ────────────────────────────────────────────────────────────

app.get('/api/budgets', requireAuth, (req, res) => {
  const budgets = dbAll(
    `SELECT b.id, b.name, b.monthly_income, b.created_by, b.created_at, b.updated_at,
       bm.role AS member_role,
       (SELECT COUNT(*) FROM budget_members WHERE budget_id = b.id) AS member_count
     FROM budgets b
     JOIN budget_members bm ON bm.budget_id = b.id AND bm.user_id = ?
     ORDER BY b.created_at DESC`,
    [req.userId]
  );
  res.json({ budgets });
});

app.post('/api/budgets', requireAuth, (req, res) => {
  const { name, monthly_income = 0 } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Budget name is required' });
  }
  const id = uuidv4();
  dbRun('INSERT INTO budgets (id, name, monthly_income, created_by) VALUES (?, ?, ?, ?)',
    [id, String(name).trim(), monthly_income, req.userId]);
  dbRun('INSERT INTO budget_members (id, budget_id, user_id, role) VALUES (?, ?, ?, ?)',
    [uuidv4(), id, req.userId, 'admin']);
  const budget = dbGet('SELECT * FROM budgets WHERE id = ?', [id]);
  res.status(201).json({ budget });
});

app.get('/api/budgets/:id', requireAuth, (req, res) => {
  const role = getBudgetMemberRole(req.params.id, req.userId);
  if (!role) return res.status(403).json({ error: 'Access denied' });
  const budget = dbGet('SELECT * FROM budgets WHERE id = ?', [req.params.id]);
  if (!budget) return res.status(404).json({ error: 'Budget not found' });
  res.json({ budget, role });
});

app.put('/api/budgets/:id', requireAuth, (req, res) => {
  const role = getBudgetMemberRole(req.params.id, req.userId);
  if (!role || role === 'viewer') return res.status(403).json({ error: 'Access denied' });
  const budget = dbGet('SELECT * FROM budgets WHERE id = ?', [req.params.id]);
  if (!budget) return res.status(404).json({ error: 'Budget not found' });
  const { name, monthly_income } = req.body;
  dbRun(
    "UPDATE budgets SET name = ?, monthly_income = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    [
      name !== undefined ? name : budget.name,
      monthly_income !== undefined ? monthly_income : budget.monthly_income,
      req.params.id,
    ]
  );
  res.json({ budget: dbGet('SELECT * FROM budgets WHERE id = ?', [req.params.id]) });
});

// ─── Expense routes ───────────────────────────────────────────────────────────

app.get('/api/budgets/:id/expenses', requireAuth, (req, res) => {
  if (!getBudgetMemberRole(req.params.id, req.userId)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json({
    expenses: dbAll(
      'SELECT * FROM expense_items WHERE budget_id = ? ORDER BY created_at DESC',
      [req.params.id]
    ),
  });
});

app.post('/api/budgets/:id/expenses', requireAuth, (req, res) => {
  const role = getBudgetMemberRole(req.params.id, req.userId);
  if (!role || role === 'viewer') return res.status(403).json({ error: 'Access denied' });
  const { category, name, amount } = req.body;
  if (!category || !name || amount == null) {
    return res.status(400).json({ error: 'category, name, and amount are required' });
  }
  const id = uuidv4();
  dbRun(
    'INSERT INTO expense_items (id, budget_id, category, name, amount, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    [id, req.params.id, category, name, amount, req.userId]
  );
  res.status(201).json({ expense: dbGet('SELECT * FROM expense_items WHERE id = ?', [id]) });
});

app.delete('/api/budgets/:id/expenses/:expId', requireAuth, (req, res) => {
  const role = getBudgetMemberRole(req.params.id, req.userId);
  if (!role || role === 'viewer') return res.status(403).json({ error: 'Access denied' });
  dbRun('DELETE FROM expense_items WHERE id = ? AND budget_id = ?',
    [req.params.expId, req.params.id]);
  res.json({ success: true });
});

// ─── Member routes ────────────────────────────────────────────────────────────

app.get('/api/budgets/:id/members', requireAuth, (req, res) => {
  if (!getBudgetMemberRole(req.params.id, req.userId)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json({
    members: dbAll(
      `SELECT bm.id, bm.user_id, bm.role, bm.created_at, u.email, u.display_name
       FROM budget_members bm
       JOIN users u ON u.id = bm.user_id
       WHERE bm.budget_id = ?
       ORDER BY bm.created_at ASC`,
      [req.params.id]
    ),
  });
});

app.post('/api/budgets/:id/members', requireAuth, (req, res) => {
  if (getBudgetMemberRole(req.params.id, req.userId) !== 'admin') {
    return res.status(403).json({ error: 'Only admins can add members' });
  }
  const { email, role: memberRole = 'viewer' } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!['admin', 'editor', 'viewer'].includes(memberRole)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const target = dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!target) {
    return res.status(404).json({ error: 'No account found with that email. They must register first.' });
  }
  if (dbGet('SELECT id FROM budget_members WHERE budget_id = ? AND user_id = ?', [req.params.id, target.id])) {
    return res.status(400).json({ error: 'User is already a member of this budget' });
  }
  dbRun('INSERT INTO budget_members (id, budget_id, user_id, role) VALUES (?, ?, ?, ?)',
    [uuidv4(), req.params.id, target.id, memberRole]);
  res.status(201).json({ success: true });
});

app.put('/api/budgets/:id/members/:memberId', requireAuth, (req, res) => {
  if (getBudgetMemberRole(req.params.id, req.userId) !== 'admin') {
    return res.status(403).json({ error: 'Only admins can update roles' });
  }
  const { role: newRole } = req.body;
  if (!['admin', 'editor', 'viewer'].includes(newRole)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  dbRun('UPDATE budget_members SET role = ? WHERE id = ? AND budget_id = ?',
    [newRole, req.params.memberId, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/budgets/:id/members/:memberId', requireAuth, (req, res) => {
  if (getBudgetMemberRole(req.params.id, req.userId) !== 'admin') {
    return res.status(403).json({ error: 'Only admins can remove members' });
  }
  const member = dbGet('SELECT user_id FROM budget_members WHERE id = ?', [req.params.memberId]);
  if (member && member.user_id === req.userId) {
    return res.status(400).json({ error: 'You cannot remove yourself from the budget' });
  }
  dbRun('DELETE FROM budget_members WHERE id = ? AND budget_id = ?',
    [req.params.memberId, req.params.id]);
  res.json({ success: true });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  save();

  app.listen(PORT, () => {
    console.log(`Budget API server running at http://localhost:${PORT}`);
    console.log(`Database: ${DB_PATH}`);
  });
}

boot().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
