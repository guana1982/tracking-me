# Routing & Navigation

## Router Setup

- **Entry**: `apps/frontend/src/main.tsx` wraps `<App />` in `<BrowserRouter>`
- **Routes**: defined in `apps/frontend/src/App.tsx` using React Router v6 `<Routes>` / `<Route>`

## Route Hierarchy

```
<BrowserRouter>
  <Routes>
    /login              → <Login />                    (public)
    /auth/callback      → <AuthCallback />             (public)
    /                   → <ProtectedRoute> → <Layout>  (protected shell)
      /                 → redirect → /dashboard
      /dashboard        → <Dashboard />
      /expenses         → <Expenses />
      /cash-flow        → <CashFlow />
      /portfolio        → <Portfolio />
      /settings         → <Settings />
  </Routes>
</BrowserRouter>
```

## ProtectedRoute Behavior

**File**: `apps/frontend/src/components/ProtectedRoute.tsx`

1. On mount: calls `checkAuth()` from auth store
2. While `isLoading`: renders `<Loader2>` spinner (full-screen centered)
3. If `!isAuthenticated`: redirects to `/login`
4. If authenticated: renders `{children}` (which is `<Layout />`)

## Layout Component

**File**: `apps/frontend/src/components/Layout.tsx`

- Desktop: left sidebar with nav links + user avatar/logout
- Mobile: bottom tab bar navigation
- Contains `<Outlet />` for nested route rendering
- Floating Action Button (FAB) triggers `<QuickAddModal>` for adding expenses
- Period selector in header (dropdown using `usePeriodStore`)

## Auth Callback Flow

**File**: `apps/frontend/src/pages/AuthCallback.tsx`

```
Google OAuth redirect → /auth/callback?token=JWT_TOKEN
  → Extract token from URL searchParams
  → If error param present → show Italian error message
  → If no token → show error
  → Call GET /auth/me with Bearer token
  → On success → setAuth(user, token) in Zustand store
  → Navigate to /dashboard (replace history)
  → On failure → show error, link back to /login
```

## Period Navigation

- **Not URL-based**: the current month is stored in `usePeriodStore` (Zustand with localStorage persistence), not in the URL path or query params.
- All data-fetching hooks receive `periodKey` as parameter from this store.
- Period selector UI is in the Layout header — changing it updates all visible data via query key invalidation.
- Default: current month in `YYYY-MM` format.

## Navigation Caveats

- **No deep linking by month**: since periodKey is in Zustand, not URL, sharing a URL does not share the selected month.
- **Auth redirect**: `ProtectedRoute` redirects to `/login` but does not preserve the return URL. After login, user always lands on `/dashboard`.
- **Callback fragility**: see [known-pitfalls.md](known-pitfalls.md) — token timing between callback and store hydration is a known sensitivity area.
