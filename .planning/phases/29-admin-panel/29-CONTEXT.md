# Phase 29: Admin Panel — Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Source:** Inline brainstorm (no spec file per memory `feedback_superpowers_workflow`)

<domain>
## Phase Boundary

Phase 29 builds **separate admin web app** в `frog_evolution_code/admin/` для управления игроками (super-admin only). Foundation для future analytics dashboard.

Сильно отличается от Phase 22-28 — это **второе приложение** в monorepo. Не trogает game client (`frog_evolution_code/client/`). Backend (`frog_evolution_code/server/`) расширяется новыми `/admin/*` routes.

</domain>

<decisions>
## Implementation Decisions

### App layout — separate Vite app
- Path: `frog_evolution_code/admin/`
- Own `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`
- Build output: `admin/dist/`
- Dev server: separate port (e.g. 5174 — client uses 5173)
- Deploy: either `admin.example.com` separate domain OR `example.com/admin` subpath behind same host

### Frontend stack (all libs)
```
Build:    Vite
Framework: React 19 + TypeScript
Styling:   Tailwind CSS v3 + shadcn/ui (component library)
Routing:   React Router v6
Tables:    TanStack Table v8 (data grids)
Queries:   TanStack Query v5 (API state)
Charts:    Recharts (placeholder + future analytics)
Forms:     React Hook Form + Zod (validation)
HTTP:      Axios (with auth interceptor для JWT)
```

shadcn/ui components needed: Button, Input, Label, Card, Table, Dialog, Toast, Form, DropdownMenu, Badge.

### Backend extensions (Fastify)
- `@fastify/jwt` — issuance + verification, secret в `JWT_SECRET` env
- `@fastify/cors` — origin whitelist via `ADMIN_ORIGIN` env (с development fallback `*`)
- `bcrypt` — password hash compare

### Auth model — single super-admin
- No Admin Prisma table в Phase 29
- `.env` vars:
  - `ADMIN_EMAIL` — login email (string)
  - `ADMIN_PASSWORD_HASH` — bcrypt hash (10 rounds)
  - `JWT_SECRET` — sign secret для JWT
  - `ADMIN_ORIGIN` — CORS origin whitelist (e.g. `https://admin.example.com`)
- Login route: `POST /admin/login` `{email, password}` → `{token: string, expiresIn: number}`. Server compares email exact + bcrypt password. Issues JWT 24h.
- JWT payload: `{sub: 'super-admin', iat, exp}`
- Middleware `requireAdmin` validates JWT on `/admin/*` except `/admin/login`.

### Backend routes (server/src/routes/admin.ts new)

```
POST /admin/login
  body: { email: string, password: string }
  → { token: string, expiresIn: 86400 }
  | 401 (bad credentials)

GET /admin/users?page=N&pageSize=20&search=Q&sortBy=col&sortDir=asc
  → {
      items: AdminUserRow[],
      total: number,
      page: number,
      pageSize: number
    }
  AdminUserRow: { id, email, currentLocation, maxLevel, gold (string BigInt), essence, lastSeen, banned, createdAt }

GET /admin/users/:id
  → AdminUserDetail (full game state — все поля GameState из Prisma + cosmic blob parsed)

POST /admin/users/:id/grant
  body: { kind: 'gold'|'essence'|'serum', element?: Element, amount: number }
  → { success: true, newValue: number }
  Validation: amount > 0, element required if kind === 'serum'

POST /admin/users/:id/ban
  body: { banned: boolean }
  → { success: true, banned: boolean }
```

### Prisma schema additions (minimal)
- `User.banned: Boolean @default(false)` — new field на existing User model
- Migration: add column с default false (non-breaking)

### MVP UI screens

#### 1. Login screen
- Route: `/login`
- Form: email + password (Zod schema)
- Submit → POST /admin/login → store JWT в memory + sessionStorage
- Error toast при 401
- Redirect to `/` если уже logged in

#### 2. Dashboard
- Route: `/`
- Placeholder card с Recharts stub graph (mock data для preview)
- Future: signups/day, DAU, retention, quest completion rate

#### 3. Users list
- Route: `/users`
- TanStack Table:
  - Columns: id, email, currentLocation, maxLevel, gold (formatted), essence, lastSeen, banned (badge), actions (link to detail)
  - Search input → filters email
  - Sort на: maxLevel, gold, essence, lastSeen
  - Pagination: page size 20, page controls
- React Query fetches /admin/users with current filter/sort/page

#### 4. User detail
- Route: `/users/:id`
- 2-column layout:
  - Left: GameState card (location/level/gold/essence + cosmic blob preview as collapsible JSON)
  - Right: Actions panel
    - Grant gold (input + submit)
    - Grant essence (input + submit)
    - Grant серум (dropdown element + input amount + submit)
    - Ban toggle (button)
  - Each action → react-hook-form + Zod validation
- Toast notifications on success/error

### Layout shell
- AppShell component с:
  - Top nav bar: «Frog Evolution Admin» logo + email indicator + Logout button
  - Sidebar (collapsible): Dashboard / Users
  - Main content area
- ProtectedRoute wrapper redirects to /login если no JWT

### Axios setup
- baseURL: `import.meta.env.VITE_API_URL` (e.g. http://localhost:3000)
- Auth interceptor: Bearer token из state on every request
- Response interceptor: catch 401 → logout + redirect to /login

### React Query setup
- QueryClient with defaults: refetchOnWindowFocus=false, staleTime=30s
- Keys structure: `['users', {page, search, sort}]`, `['user', id]`

### Environment files
- `admin/.env.example` — VITE_API_URL placeholder
- `server/.env.example` extension — ADMIN_EMAIL, ADMIN_PASSWORD_HASH, JWT_SECRET, ADMIN_ORIGIN

### Build chain
- `cd admin && npm install` — separate deps install
- `cd admin && npm run build` — Vite build → `admin/dist/`
- `cd admin && npm test` — vitest (optional, MVP может skip)
- Root scripts: `npm run admin:dev`, `npm run admin:build`, `npm run admin:lint`

### Cliclability (admin context — desktop-first)
- shadcn/ui handles accessibility за нас
- Buttons type="button" по default
- Forms used React Hook Form — controlled inputs

</decisions>

<canonical_refs>
## Canonical References

### Existing project structure
- `frog_evolution_code/client/` — game web app (React+Vite+Phaser)
- `frog_evolution_code/server/` — Fastify backend
- `frog_evolution_code/server/prisma/schema.prisma` — Prisma schema (User, GameState)

### Server entry points
- `frog_evolution_code/server/src/index.ts` — Fastify bootstrap (register plugins там)
- `frog_evolution_code/server/src/routes/` — existing route modules

### Prisma models
- `User` — id, email, telegramId, createdAt
- `GameState` — currentLocation, gold (BigInt), discoveredLevels, locationFrogs, cosmic (JSON blob)

### Workspace rules
- `/Users/shar/Documents/frog_evolution/CLAUDE.md` — orchestrator delegation

### Project conventions
- BigInt fields в Prisma → serialize as string в API responses
- i18n уже есть в client/ (RU/EN/ES) — admin NOT нужен i18n в MVP
- Тech debt fixes уже сделаны (server cosmic blob sync audit Phase 27)

</canonical_refs>

<specifics>
## Specific Ideas

- **shadcn/ui setup:** use `npx shadcn-ui@latest init` в admin/ для proper config (components.json, lib/utils.ts).
- **Theme:** dark mode default (admin = serious tool). Tailwind dark: prefix.
- **No i18n MVP:** English UI hardcoded. RU translation = future.
- **User search:** by email substring (case-insensitive). Future: by id, telegramId.
- **lastSeen:** computed из GameState.updatedAt или User.updatedAt — whichever exists.
- **Cosmic blob preview:** show as syntax-highlighted JSON (use `react-json-view` или simple `<pre>{JSON.stringify(..., null, 2)}</pre>`).
- **Logout flow:** delete JWT from sessionStorage + redirect to /login.

</specifics>

<deferred>
## Deferred (NOT в Phase 29)

- **Multi-admin support** — Admin Prisma table, roles (super/support/readonly) — Phase 30+
- **Analytics dashboard charts** — Recharts placeholder only в MVP; full impl = Phase 30+
- **i18n RU/EN** — admin UI English only MVP
- **Quest stats** — quest analytics tab = Phase 30+
- **Cosmic shop analytics** — Phase 30+
- **Audit log** (who granted what to whom) — Phase 30+
- **Server cosmic blob editor** (edit raw JSON) — risky, deferred
- **Export users CSV** — Phase 30+
- **Search via Telegram ID** — Phase 30+
- **2FA / TOTP** — Phase 30+

</deferred>

---

*Phase: 29-admin-panel*
*Context gathered: 2026-05-19 via inline brainstorm (orchestrator + user)*
