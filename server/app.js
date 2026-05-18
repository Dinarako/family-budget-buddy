'use strict';

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { dbGet, dbAll, dbRun } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret-change-in-production';

const app = express();

app.use(cors({ origin: true, credentials: true }));
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

async function getMemberRole(budgetId, userId) {
  const row = await dbGet(
    'SELECT role FROM budget_members WHERE budget_id = $1 AND user_id = $2',
    [budgetId, userId]
  );
  return row ? row.role : null;
}

function formatUser(u) {
  return {
    id: u.id,
    email: u.email,
    display_name: u.display_name || null,
    avatar_url: u.avatar_url || null,
    created_at: u.created_at,
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    if (await dbGet('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]))
      return res.status(400).json({ error: 'An account with this email already exists' });

    const id = uuidv4();
    const user = await dbGet(
      `INSERT INTO users (id, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, avatar_url, created_at`,
      [id, email.toLowerCase(), bcrypt.hashSync(password, 10), displayName || email.split('@')[0]]
    );
    const token = jwt.sign({ sub: id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const user = await dbGet('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await dbGet(
      'SELECT id, email, display_name, avatar_url, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: formatUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword)
      return res.status(400).json({ error: 'Email and new password are required' });
    if (newPassword.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const user = await dbGet('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (user) {
      await dbRun(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [bcrypt.hashSync(newPassword, 10), user.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

app.put('/api/auth/update-password', requireAuth, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    await dbRun(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [bcrypt.hashSync(newPassword, 10), req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Password update failed' });
  }
});

// ─── Users ────────────────────────────────────────────────────────────────────

app.get('/api/users/search', requireAuth, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email query param required' });
    const user = await dbGet(
      'SELECT id, email, display_name FROM users WHERE email = $1',
      [String(email).toLowerCase()]
    );
    if (!user) return res.status(404).json({ error: 'No account found with that email' });
    res.json({ user: { id: user.id, email: user.email, display_name: user.display_name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ─── Budgets ──────────────────────────────────────────────────────────────────

app.get('/api/budgets', requireAuth, async (req, res) => {
  try {
    const budgets = await dbAll(
      `SELECT b.id, b.name, b.monthly_income, b.created_by, b.created_at, b.updated_at,
              bm.role AS member_role,
              (SELECT COUNT(*)::int FROM budget_members WHERE budget_id = b.id) AS member_count
       FROM budgets b
       JOIN budget_members bm ON bm.budget_id = b.id AND bm.user_id = $1
       ORDER BY b.created_at DESC`,
      [req.userId]
    );
    res.json({ budgets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load budgets' });
  }
});

app.post('/api/budgets', requireAuth, async (req, res) => {
  try {
    const { name, monthly_income = 0 } = req.body;
    if (!name || !String(name).trim())
      return res.status(400).json({ error: 'Budget name is required' });

    const id = uuidv4();
    const budget = await dbGet(
      `INSERT INTO budgets (id, name, monthly_income, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, String(name).trim(), monthly_income, req.userId]
    );
    await dbRun(
      'INSERT INTO budget_members (id, budget_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [uuidv4(), id, req.userId, 'admin']
    );
    res.status(201).json({ budget });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

app.get('/api/budgets/:id', requireAuth, async (req, res) => {
  try {
    const role = await getMemberRole(req.params.id, req.userId);
    if (!role) return res.status(403).json({ error: 'Access denied' });
    const budget = await dbGet('SELECT * FROM budgets WHERE id = $1', [req.params.id]);
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    res.json({ budget, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load budget' });
  }
});

app.put('/api/budgets/:id', requireAuth, async (req, res) => {
  try {
    const role = await getMemberRole(req.params.id, req.userId);
    if (!role || role === 'viewer') return res.status(403).json({ error: 'Access denied' });

    const current = await dbGet('SELECT * FROM budgets WHERE id = $1', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Budget not found' });

    const { name, monthly_income } = req.body;
    const budget = await dbGet(
      `UPDATE budgets
       SET name = $1, monthly_income = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [
        name !== undefined ? name : current.name,
        monthly_income !== undefined ? monthly_income : current.monthly_income,
        req.params.id,
      ]
    );
    res.json({ budget });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

// ─── Expenses ─────────────────────────────────────────────────────────────────

app.get('/api/budgets/:id/expenses', requireAuth, async (req, res) => {
  try {
    if (!await getMemberRole(req.params.id, req.userId))
      return res.status(403).json({ error: 'Access denied' });
    const expenses = await dbAll(
      'SELECT * FROM expense_items WHERE budget_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ expenses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load expenses' });
  }
});

app.post('/api/budgets/:id/expenses', requireAuth, async (req, res) => {
  try {
    const role = await getMemberRole(req.params.id, req.userId);
    if (!role || role === 'viewer') return res.status(403).json({ error: 'Access denied' });

    const { category, name, amount } = req.body;
    if (!category || !name || amount == null)
      return res.status(400).json({ error: 'category, name, and amount are required' });

    const expense = await dbGet(
      `INSERT INTO expense_items (id, budget_id, category, name, amount, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [uuidv4(), req.params.id, category, name, amount, req.userId]
    );
    res.status(201).json({ expense });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

app.delete('/api/budgets/:id/expenses/:expId', requireAuth, async (req, res) => {
  try {
    const role = await getMemberRole(req.params.id, req.userId);
    if (!role || role === 'viewer') return res.status(403).json({ error: 'Access denied' });
    await dbRun(
      'DELETE FROM expense_items WHERE id = $1 AND budget_id = $2',
      [req.params.expId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// ─── Members ──────────────────────────────────────────────────────────────────

app.get('/api/budgets/:id/members', requireAuth, async (req, res) => {
  try {
    if (!await getMemberRole(req.params.id, req.userId))
      return res.status(403).json({ error: 'Access denied' });
    const members = await dbAll(
      `SELECT bm.id, bm.user_id, bm.role, bm.created_at, u.email, u.display_name
       FROM budget_members bm
       JOIN users u ON u.id = bm.user_id
       WHERE bm.budget_id = $1
       ORDER BY bm.created_at ASC`,
      [req.params.id]
    );
    res.json({ members });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load members' });
  }
});

app.post('/api/budgets/:id/members', requireAuth, async (req, res) => {
  try {
    if (await getMemberRole(req.params.id, req.userId) !== 'admin')
      return res.status(403).json({ error: 'Only admins can add members' });

    const { email, role: memberRole = 'viewer' } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!['admin', 'editor', 'viewer'].includes(memberRole))
      return res.status(400).json({ error: 'Invalid role' });

    const target = await dbGet('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!target)
      return res.status(404).json({ error: 'No account found with that email. They must register first.' });

    if (await dbGet('SELECT id FROM budget_members WHERE budget_id = $1 AND user_id = $2', [req.params.id, target.id]))
      return res.status(400).json({ error: 'User is already a member of this budget' });

    await dbRun(
      'INSERT INTO budget_members (id, budget_id, user_id, role) VALUES ($1, $2, $3, $4)',
      [uuidv4(), req.params.id, target.id, memberRole]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

app.put('/api/budgets/:id/members/:memberId', requireAuth, async (req, res) => {
  try {
    if (await getMemberRole(req.params.id, req.userId) !== 'admin')
      return res.status(403).json({ error: 'Only admins can update roles' });

    const { role: newRole } = req.body;
    if (!['admin', 'editor', 'viewer'].includes(newRole))
      return res.status(400).json({ error: 'Invalid role' });

    await dbRun(
      'UPDATE budget_members SET role = $1 WHERE id = $2 AND budget_id = $3',
      [newRole, req.params.memberId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

app.delete('/api/budgets/:id/members/:memberId', requireAuth, async (req, res) => {
  try {
    if (await getMemberRole(req.params.id, req.userId) !== 'admin')
      return res.status(403).json({ error: 'Only admins can remove members' });

    const member = await dbGet(
      'SELECT user_id FROM budget_members WHERE id = $1',
      [req.params.memberId]
    );
    if (member && member.user_id === req.userId)
      return res.status(400).json({ error: 'You cannot remove yourself from the budget' });

    await dbRun(
      'DELETE FROM budget_members WHERE id = $1 AND budget_id = $2',
      [req.params.memberId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ─── Global error handler ────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
