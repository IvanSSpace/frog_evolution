# SMOKE_TEST_29: Phase 29 Admin Panel — Manual QA Checklist

**Phase:** 29-admin-panel
**Scope:** Full admin panel MVP — login, dashboard, users list, user detail, grant actions, ban toggle
**Updated:** 2026-05-19
**Status:** Ready for manual QA post-shipping

---

## Setup

### Backend environment

Ensure the following env vars are set in `server/.env`:

```bash
# Generate a bcrypt hash for your chosen password (10 rounds):
node -e "const b=require('bcryptjs');b.hash('yourpassword',10).then(console.log)"

# Add to server/.env:
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=<hash from above>
JWT_SECRET=<existing value or generate: openssl rand -hex 32>
ADMIN_ORIGIN=http://localhost:5174
```

### Start servers

```bash
# Terminal 1 — Backend
cd server && npm run dev
# Server starts on http://localhost:3000

# Terminal 2 — Admin frontend
cd admin && npm run dev
# Vite dev server starts on http://localhost:5174
```

### Admin frontend env

Ensure `admin/.env` (or `admin/.env.local`) contains:

```env
VITE_API_URL=http://localhost:3000
```

---

## Scenario A — Auth gate (ProtectedRoute)

Prerequisites: admin dev server running, no active session.

- [ ] Open `http://localhost:5174/` in browser
- [ ] Expect: immediately redirected to `/login` (ProtectedRoute detects no JWT in sessionStorage)
- [ ] Open `http://localhost:5174/users` directly
- [ ] Expect: immediately redirected to `/login`
- [ ] Open `http://localhost:5174/users/123` directly
- [ ] Expect: immediately redirected to `/login`
- [ ] Confirm: browser address bar shows `/login` after each redirect

## Scenario B — Login screen

Prerequisites: both servers running, on `/login` page.

- [ ] Page renders: email input, password input, "Sign In" button — AppShell NOT visible (no sidebar, no top nav)
- [ ] Enter wrong email or wrong password → click "Sign In"
- [ ] Expect: error toast appears with "Login failed" or similar message; user stays on `/login`
- [ ] Clear fields; enter correct ADMIN_EMAIL + matching password → click "Sign In"
- [ ] Expect: redirected to `/` (dashboard); full AppShell visible (top nav + sidebar)
- [ ] Top nav shows: "Frog Evolution Admin" logo on left; email/logout on right
- [ ] Sidebar shows: "Dashboard" and "Users" links
- [ ] Reload page (`F5`) → user stays logged in (JWT persisted in sessionStorage)

## Scenario C — Dashboard page

Prerequisites: logged in, on `/` route.

- [ ] Page title "Dashboard" visible in content area
- [ ] Three stat cards visible: "Total Users" / "DAU" / "Banned Users" — each showing "—" (placeholder, no live data)
- [ ] "Signups / Day (mock data)" card visible
- [ ] Recharts LineChart renders inside the card — visible line graph with 7 data points (May 13–19)
- [ ] Chart axes and tooltip are present (hover over line → tooltip shows date + signups value)
- [ ] Small note: "Real analytics — Phase 30" visible below card title
- [ ] No console errors

## Scenario D — Users list

Prerequisites: logged in, navigate to `/users` via sidebar "Users" link.

- [ ] TanStack Table renders with columns: Telegram ID, Username, Location, Max Level, Gold, Essence, Last Seen, Status, View
- [ ] At least one row visible if users exist in DB (or zero-state message if DB is empty)
- [ ] Status column shows "Active" badge (green) for non-banned users, "Banned" badge (red) for banned users
- [ ] Search: type a partial email or username into search input → click "Search" button
- [ ] Expect: table filters to matching users, page resets to 1
- [ ] Clear search: click "Clear" button → all users return
- [ ] Pagination: if total users > 20 — "Next" button active; click → loads page 2
- [ ] Click "Previous" on page 2 → returns to page 1; "Previous" disabled on page 1
- [ ] Click "View" on any row → navigates to `/users/:id` for that user

## Scenario E — User detail view

Prerequisites: logged in, on `/users/:id` for an existing user.

- [ ] 2-column layout renders (on mobile: single column stack)
- [ ] **Left column — Game State card** shows:
  - Telegram ID
  - Username
  - Display name
  - Location
  - Max Level
  - Gold (formatted BigInt)
  - Essence
  - Box Open Count
  - Income/sec
  - Magnet
  - Last Seen timestamp
  - Created At timestamp
- [ ] **Cosmic Blob section**: "Cosmic Blob" card with collapsed state by default
- [ ] Click "Expand" button → collapsible pre block shows raw JSON of cosmic blob
- [ ] Click "Collapse" → pre block hides
- [ ] **Right column** shows three grant cards + account status card

## Scenario F — Grant gold

Prerequisites: on `/users/:id` for an existing user.

- [ ] "Grant Gold" card visible with amount input + "Grant" button
- [ ] Leave amount empty → click "Grant" → form validation error (amount required)
- [ ] Enter negative number (e.g. -100) → click "Grant" → form validation error (must be positive)
- [ ] Enter valid amount (e.g. 1000) → click "Grant"
- [ ] Expect: success toast "Granted gold successfully" (or similar)
- [ ] Form resets to empty after success
- [ ] Game State card updates: Gold value increases by 1000 after React Query refetch (staleTime 30s — may need manual page refresh or wait)

## Scenario G — Grant serum

Prerequisites: on `/users/:id` for an existing user.

- [ ] "Grant Serum" card visible with element dropdown (16 elements) + amount input + "Grant Serum" button
- [ ] Dropdown lists all 16 elements (fire, water, crystal, shadow, gas, plasma, forest, void, binary, mechanical, etc.)
- [ ] Select an element (e.g. "fire"); enter amount 5 → click "Grant Serum"
- [ ] Expect: success toast
- [ ] Form resets after success

## Scenario H — Ban toggle

Prerequisites: on `/users/:id` for a user with `banned: false` (Status: Active).

- [ ] Account Status card shows: "Status: Active" badge (green) + "Ban" button (red/destructive styling)
- [ ] Click "Ban"
- [ ] Expect: success toast "User banned" (or similar)
- [ ] Badge changes to "Banned" (red); button label changes to "Unban"
- [ ] Navigate to Users list (`/users`) → user row Status column now shows "Banned" badge
- [ ] Return to user detail → click "Unban"
- [ ] Expect: success toast "User unbanned" (or similar)
- [ ] Badge returns to "Active"; button returns to "Ban"

## Scenario I — Logout

Prerequisites: logged in (JWT active in sessionStorage).

- [ ] Click "Logout" in top nav bar
- [ ] Expect: redirected to `/login`
- [ ] Open browser DevTools → Application → Session Storage → confirm JWT key cleared
- [ ] Attempt to navigate directly to `http://localhost:5174/users` → expect: redirect to `/login` (ProtectedRoute confirms session cleared)
- [ ] Close and reopen browser tab → confirm still on `/login` (sessionStorage cleared = no persistence across tab close)

---

## Build Chain

```bash
# TypeScript compile check (admin)
cd admin && npx tsc --noEmit
# Expect: 0 errors

# Production build (admin)
cd admin && npm run build
# Expect: exits 0; admin/dist/index.html exists; chunk sizes reported

# TypeScript compile check (server)
cd server && npx tsc --noEmit
# Expect: 0 errors

# Verify dist output
ls admin/dist/index.html
# Expect: file exists
```

---

## Regression Sanity

Verify these Phase 29 backend routes via curl (server running):

```bash
# Confirm login route exists and rejects bad credentials
curl -s -X POST http://localhost:3000/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"wrong@example.com","password":"wrong"}' | jq .
# Expect: {"statusCode":401,"error":"Unauthorized","message":"..."}

# Confirm requireAdmin middleware blocks unauthenticated access
curl -s http://localhost:3000/admin/users | jq .
# Expect: {"statusCode":401,...} (no token provided)
```

---

*Plan 29-06 / SMOKE_TEST_29 / Phase 29-admin-panel*
*Updated: 2026-05-19*
