# Auth & Session Security

## Authentication Flow

```
User clicks "Accedi con Google" on /login
  → Browser navigates to /auth/google (backend)
  → Backend redirects to Google consent screen
  → User grants permission
  → Google redirects to /auth/google/callback (backend)
  → Backend exchanges code for access token
  → Backend fetches Google userinfo (profile, email)
  → authService.findOrCreateUser():
      - Lookup by googleId
      - If not found, lookup by email (link existing account)
      - If new, create User record
      - Always update profile (name, picture) on login
  → Backend signs JWT (7-day expiry) with { id, email, name }
  → Redirects to frontend: /auth/callback?token=JWT_TOKEN
  → AuthCallback.tsx extracts token, verifies via GET /auth/me
  → On success: setAuth(user, token) → navigate to /dashboard
```

## JWT Details

- **Library**: `@fastify/jwt`
- **Secret**: `process.env.JWT_SECRET`
- **Expiry**: 7 days
- **Payload**: `{ id: string, email: string, name: string | null }`
- **Refresh**: `POST /auth/refresh` (requires valid JWT) → new token with same payload

## Token Storage (Frontend)

- **Mechanism**: Zustand `persist` middleware → localStorage
- **Key**: `"auth-storage"`
- **Persisted fields**: `token` (JWT string) and `user` (AuthUser object)
- **Read pattern**: `useAuthStore.getState().token` (non-reactive, called at fetch time)

## Authenticated API Calls

- Every `fetchApi()` call reads token from Zustand store
- Sets `Authorization: Bearer {token}` header
- Sets `credentials: 'include'`
- On 401 response: calls `logout()` → clears store → user sees login page

## Backend Auth Middleware

**File**: `apps/backend/src/auth/auth.middleware.ts`

- Registered as `onRequest` hook for all `/api/*` routes
- Skips: `/auth/*`, `/health`, `/docs`
- Extracts JWT from `Authorization: Bearer` header
- Verifies via `request.jwtVerify()`
- Sets `request.authUser = { id, email, name }`
- On failure: 401 UNAUTHORIZED

## Session Resilience

- `checkAuth()` in auth store calls `GET /auth/me`
- On 401: logs out (token expired or invalid)
- On network error or non-401 failure: keeps session alive (defensive — avoids logout on transient errors)
- `ProtectedRoute` calls `checkAuth()` on mount

## Logout

1. Frontend calls `useAuthStore.getState().logout()`
2. Store clears `token` and `user` (localStorage also cleared)
3. `POST /auth/logout` fired (fire-and-forget, errors ignored)
4. Backend endpoint is a no-op acknowledgment (JWT is stateless — no server-side session to destroy)

## Security Boundaries — Do Not Weaken

- **User scoping**: every Prisma query MUST include `userId` filter. Never expose cross-user data.
- **JWT verification**: must happen on every `/api/*` request. Do not add exceptions.
- **Bearer-only auth**: API uses Bearer tokens, not cookies. This avoids CSRF but requires secure token storage.
- **CORS whitelist**: production restricts origins to `FRONTEND_URL`. Do not set `origin: true` in production.
- **No token in URL**: API calls use Authorization header. Only the OAuth callback passes token as URL param (one-time use).
- **Environment secrets**: `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` must never be committed. They live in `.env` (gitignored) locally and Railway variables in production.
