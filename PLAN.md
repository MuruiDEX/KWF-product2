# Plan: DRF + Next.js Integration — Кабинет и Сетка

## Context

Backend (KWF-backend/backend) and frontend (Coach-site-main) are currently disconnected. The backend already has JWT auth, Profile model, CRUD endpoints with permissions, and a Cabinet view. The frontend is a single-page landing with no API integration, no routing beyond `/`, and no auth. This plan connects them.

**Backend status: COMPLETE** — CORS, JWT, permissions, Profile, accounts app, requirements.txt, admin registrations are all already in place.

**Frontend status: Needs full API integration** — No fetch calls, no auth, no multi-page routing.

---

## Step 1: Environment & API Client

**Files to create/modify:**
- `Coach-site-main/.env.local` — `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`
- `Coach-site-main/src/lib/api.ts` — typed fetch wrapper

**api.ts will:**
- Export `api<T>(path, options?)` function
- Auto-prepend `NEXT_PUBLIC_API_URL`
- Set `Content-Type: application/json`
- Attach `Authorization: Bearer <access>` from localStorage
- On 401: attempt refresh via `/api/auth/token/refresh/`, retry once
- Return parsed JSON or throw

---

## Step 2: Auth Context

**Files to create:**
- `Coach-site-main/src/lib/auth.tsx` — React context + provider

**AuthContext will provide:**
- `user: MeUser | null` (id, username, email, first_name, last_name, is_staff, profile)
- `login(username, password)` → POST `/api/auth/token/` → store tokens → fetch `/api/auth/me/`
- `register(data)` → POST `/api/auth/register/` → store tokens → fetch `/api/auth/me/`
- `logout()` → clear tokens + user
- `updateUser(data)` → PATCH `/api/auth/me/`
- `loading: boolean` — true during initial token check
- On mount: check localStorage for access token, if present → fetch `/api/auth/me/`

---

## Step 3: Shared Layout Component

**Files to create:**
- `Coach-site-main/src/components/AppLayout.tsx` — wraps Navbar + children + Footer for internal pages

**Modify:**
- `Coach-site-main/src/components/Navbar.tsx` — add auth-aware links: "Новости", "Турниры", and "Войти"/"Кабинет" based on auth state. Keep existing anchor links on landing page only.

---

## Step 4: Landing Page Update

**Modify:**
- `Coach-site-main/src/app/page.tsx` — add a News block section that fetches latest 3 news from API and renders them. Keep all existing landing sections.

---

## Step 5: News Pages

**Files to create:**
- `Coach-site-main/src/app/news/page.tsx` — list all news (GET `/api/news/`), cards with title, description snippet, date, image
- `Coach-site-main/src/app/news/[id]/page.tsx` — single news detail (GET `/api/news/{id}/`)

Both are server components that fetch data, with client interactive parts as needed.

---

## Step 6: Tournament Pages

**Files to create:**
- `Coach-site-main/src/app/tournaments/page.tsx` — list all tournaments (GET `/api/tournament/tournaments/`), cards with name, description, date, participant count
- `Coach-site-main/src/app/tournaments/[id]/page.tsx` — tournament bracket view

**Bracket page details:**
- Fetches `TournamentSerializer` payload (includes nested participants + stages.matches)
- Renders columns by stage order, each column shows match cards
- Match cards show: participant1 vs participant2, score, status, winner
- If participant is null (bye): show "TBD" or "BYE"
- Staff users see score inputs + "Завершить матч" button (PATCH `/api/tournament/matches/{id}/`)

---

## Step 7: Auth Pages

**Files to create:**
- `Coach-site-main/src/app/login/page.tsx` — login form (username + password), calls `auth.login()`, redirects to `/cabinet`
- `Coach-site-main/src/app/register/page.tsx` — register form (username, email, password, first_name, last_name), calls `auth.register()`, redirects to `/cabinet`

---

## Step 8: Cabinet Page

**Files to create:**
- `Coach-site-main/src/app/cabinet/page.tsx` — protected page:
  - Profile section (editable: first_name, last_name, email, phone, club, belt, birth_date)
  - "Мои турниры" — list of tournaments user participates in
  - "Мои матчи" — list of matches involving the user
  - Redirect to `/login` if not authenticated (client-side check using auth context)

---

## Step 9: Proxy (Auth Redirect Middleware)

**Files to create:**
- `Coach-site-main/src/proxy.ts` — Next.js 16 proxy (NOT middleware.ts)

**Proxy will:**
- Match `/cabinet` route
- Check for access token in cookies/localStorage
- Redirect to `/login` if no token
- NOTE: Since proxy runs server-side and localStorage isn't available, we'll handle the redirect client-side in the cabinet page instead (simpler, avoids complexity of passing tokens through cookies)

**Decision: Skip proxy.ts, handle auth redirect client-side in cabinet page.** This is simpler and avoids token cookie complexity.

---

## Step 10: Root Layout Update

**Modify:**
- `Coach-site-main/src/app/layout.tsx` — wrap children with `AuthProvider`

---

## Step 11: Types

**Files to create:**
- `Coach-site-main/src/lib/types.ts` — shared TypeScript interfaces:
  - `MeUser`, `Profile`, `News`, `Tournament`, `Participant`, `Stage`, `Match`

---

## Files Summary

### New files (11):
| File | Purpose |
|------|---------|
| `.env.local` | API URL env var |
| `src/lib/api.ts` | Fetch wrapper with JWT |
| `src/lib/auth.tsx` | Auth context + provider |
| `src/lib/types.ts` | TypeScript interfaces |
| `src/components/AppLayout.tsx` | Shared Navbar+Footer layout |
| `src/app/news/page.tsx` | News list |
| `src/app/news/[id]/page.tsx` | News detail |
| `src/app/tournaments/page.tsx` | Tournament list |
| `src/app/tournaments/[id]/page.tsx` | Tournament bracket |
| `src/app/login/page.tsx` | Login form |
| `src/app/register/page.tsx` | Register form |
| `src/app/cabinet/page.tsx` | User cabinet |

### Modified files (3):
| File | Change |
|------|--------|
| `src/app/layout.tsx` | Wrap with AuthProvider |
| `src/app/page.tsx` | Add news section |
| `src/components/Navbar.tsx` | Auth-aware navigation |

---

## Verification

1. Start Django: `cd KWF-backend/backend && python manage.py runserver`
2. Start Next.js: `cd Coach-site-main && npm run dev`
3. Test CORS: open http://localhost:3000, check browser console for CORS errors
4. Test news: `/news` page loads data from API
5. Test tournaments: `/tournaments` page loads list, `/tournaments/[id]` shows bracket
6. Test auth: register → redirect to cabinet → edit profile
7. Test staff: login as staff user → tournament bracket shows score inputs
8. Test anonymous: bracket page is read-only, cabinet redirects to login
