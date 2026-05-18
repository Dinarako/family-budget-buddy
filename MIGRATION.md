# Migration Report: Supabase → Self-Hosted

## What was removed

| Service | Purpose | Files deleted / emptied |
|---------|---------|------------------------|
| `@supabase/supabase-js` | Database, Auth, Realtime client | `src/integrations/supabase/` (entire directory) |
| Supabase Auth | Sign-up, sign-in, session management | replaced in `useAuth.tsx` |
| Supabase PostgreSQL | All database queries | replaced in every component |
| Supabase Realtime | Live budget / expense updates | removed; state is updated locally after each mutation |
| Supabase Edge Functions | `send-password-reset-email`, `send-login-email` | `supabase/functions/` (kept for reference, no longer called) |
| Resend (email service) | Password reset emails | removed entirely |
| `.env` keys: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Service credentials | replaced in `.env` |

---

## What was replaced

### Backend (new)

| Added | Purpose |
|-------|---------|
| `server/index.js` | Express 4 REST API server — auth, budgets, expenses, members |
| `data/budget.db` | SQLite database file (auto-created on first run, git-ignored) |
| **`sql.js`** | Pure-WASM SQLite; no native compilation needed |
| **`express`** | HTTP server |
| **`bcryptjs`** | Password hashing (bcrypt, pure JS) |
| **`jsonwebtoken`** | JWT signing / verification |
| **`cors`** | CORS headers for local dev |
| **`dotenv`** | Load `.env` on the server |
| **`uuid`** | UUID v4 generation |

### Frontend (changed)

| File | Change |
|------|--------|
| `src/lib/api.ts` | New — thin `fetch()` wrapper that attaches the JWT bearer token |
| `src/lib/types.ts` | New — local type definitions (`LocalUser`, `Budget`, `ExpenseItem`, `BudgetMember`, …) |
| `src/hooks/useAuth.tsx` | Rewritten — stores JWT + user in `localStorage`; calls `/api/auth/*` endpoints |
| `src/pages/Auth.tsx` | Updated — "Reset Password" tab now asks for email + new password directly (no email sent) |
| `src/pages/Index.tsx` | Rewritten — Supabase queries → `apiRequest()` calls; realtime removed, state updated after each mutation |
| `src/components/BudgetSelector.tsx` | Rewritten — Supabase queries → `apiRequest()` calls |
| `src/components/MembersDialog.tsx` | Rewritten — Supabase queries → `apiRequest()` calls; member lookup fixed (email → server user search) |

---

## What still depends on external infrastructure

**Nothing.** The app is fully self-contained.

The `supabase/` directory (migrations and edge function source) has been left in place for
reference but is not used at runtime.

---

## Breaking changes and notes

### Password reset (UI change)
Supabase previously sent an email with a magic link via Resend. The "Reset Password"
tab now asks for **email + new password in one step**. No email is sent. This is
appropriate for a locally-hosted, single-household app where all users have physical
access to the machine or are trusted.

If you later add email delivery, wire a mailer (Nodemailer + SMTP, or similar) into
`POST /api/auth/reset-password` in `server/index.js`.

### Realtime removed
Supabase Realtime (WebSocket `postgres_changes`) has been replaced by optimistic local
state updates. After any mutation (add/remove expense, update income) the local React
state is updated immediately without a round-trip. Multiple simultaneous browser tabs
will see stale data until they reload; for a single-user or household app this is fine.

### Member lookup
The old `MembersDialog` had a broken email-to-user-ID lookup (it was querying by ID,
not email). The new implementation calls `GET /api/users/search?email=…` on the
server and correctly resolves the user. Members must already have a registered account
before they can be added.

---

## How to run locally

### 1. Copy environment file

```bash
cp .env.example .env
```

Edit `.env` and set a strong `JWT_SECRET`.

### 2. Install dependencies

```bash
npm install
```

### 3. Start both servers in one terminal

```bash
npm run dev:all
```

Or in two separate terminals:

```bash
# Terminal 1 — API server (port 3001)
npm run dev:server

# Terminal 2 — Vite dev server (port 5173)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

The SQLite database is created automatically at `data/budget.db` on first start.

### 4. Production build

```bash
npm run build      # produces dist/
npm run dev:server # or NODE_ENV=production node server/index.js
```

Serve `dist/` with any static file host (nginx, `serve`, etc.) and keep the API server
running as a background process.

---

## Environment variables

| Variable | Where used | Description |
|----------|-----------|-------------|
| `VITE_API_URL` | Frontend (Vite) | URL of the API server. Default: `http://localhost:3001` |
| `PORT` | Server | Port the Express server listens on. Default: `3001` |
| `JWT_SECRET` | Server | Secret for signing JWT tokens. **Change before deploying.** |

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
