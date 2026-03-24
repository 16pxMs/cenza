# PIN Authentication Design

**Date:** 2026-03-24
**Status:** Approved

## Goal

Add a mandatory 4-digit PIN that gates app access on every new browser session. PIN is set during onboarding (required, not optional). The gate is enforced server-side via middleware — not a client-side overlay — so it cannot be bypassed from the browser.

## Architecture

### Security model

The PIN gate sits on top of the existing Supabase session. Supabase handles identity (who you are); the PIN handles access (whether you're allowed in right now). Both must pass before any app page loads.

PIN hashes are stored with bcrypt and compared server-side only. The raw hash is never sent to the browser.

### Cookies

Three cookies govern access:

| Cookie | httpOnly | Purpose |
|--------|----------|---------|
| Supabase session | yes | Identity — already exists |
| `cenza-has-pin` | no | Flag: this user has a PIN set. Readable by middleware without a DB query. |
| `cenza-pin-verified` | yes | Flag: PIN has been verified in this browser session. Set by server action only. |

`cenza-pin-verified` is a **session cookie** (no `maxAge`). It clears when the browser closes. Combined with the existing session timeout (15 min idle → sign-out), this means:

- Browser closed → PIN required on next open
- Session timeout fires → Supabase sign-out ends the browser session → PIN required on next open
- Active tab reload → no PIN (session cookie survives)

### Middleware logic

The middleware operates on actual URL paths (route groups like `(app)` do not appear in URLs). The existing `publicRoutes` array in `middleware.ts` lists paths that are excluded from auth checks. The PIN gate is added to the same middleware function.

For every authenticated request (Supabase session valid, not a public route):

1. Path is `/pin` or `/pin/reset` → **pass through for the PIN check only** (these are the PIN pages themselves; gating them would cause an infinite redirect loop). **Do not add `/pin` or `/pin/reset` to `publicRoutes`** — they remain auth-gated so unauthenticated users are still redirected to `/`. Only the PIN cookie redirect is skipped.
2. `cenza-has-pin` cookie present + `cenza-pin-verified` cookie absent → redirect to `/pin`
3. All other authenticated requests → pass through

No database queries added to middleware. The `cenza-has-pin` cookie is the only signal needed.

### Sign-out behaviour

When signing out (Settings, session timeout, forgot-PIN flow), `cenza-pin-verified` must be cleared. `cenza-has-pin` can remain — it is not sensitive. Sign-out calls `clearPinVerified()` before `supabase.auth.signOut()`.

---

## Database

One new column on `user_profiles`:

```sql
pin_hash TEXT NULL
```

Null = PIN not set (existing users before this feature). Non-null = bcrypt hash of the user's 4-digit PIN.

Existing users with `pin_hash = NULL` are not gated — middleware only redirects to `/pin` when `cenza-has-pin` cookie is present. Since existing users never went through PIN setup, they have no `has_pin` cookie and are never redirected.

---

## Server Actions

All PIN operations happen server-side in `src/lib/actions/pin.ts`. Three actions:

### `setupPin(pin: string): Promise<void>`
- Validates pin is exactly 4 digits
- `bcrypt.hash(pin, 10)`
- Updates `user_profiles.pin_hash` via server-side Supabase client
- Sets `cenza-has-pin=1` cookie (non-httpOnly, path `/`, no maxAge)
- Sets `cenza-pin-verified=1` cookie (httpOnly, path `/`, no maxAge — session cookie)

### `verifyPin(pin: string): Promise<boolean>`
- Fetches `pin_hash` from `user_profiles` for the current user (server-side Supabase client — hash never sent to browser)
- `bcrypt.compare(pin, pin_hash)`
- If match: sets `cenza-pin-verified=1` cookie (httpOnly, session cookie), returns `true`
- If no match: returns `false`

### `clearPinVerified(): Promise<void>`
- Clears `cenza-pin-verified` cookie (sets it with `maxAge=0`)
- Called on all sign-out paths

---

## Onboarding Flow

**Before:** Name (`/onboarding`) → Currency (`/onboarding/currency`) → `onboarding_complete = true` → `/`

**After:** Name (`/onboarding`) → Currency (`/onboarding/currency`) → **PIN setup (`/onboarding/pin`)** → `onboarding_complete = true` → `/`

The currency page currently sets `onboarding_complete: true` before redirecting. This is removed from the currency page and moved to the PIN setup step.

The currency page eyebrow label changes from "Step 2 of 2" to "Step 2 of 3".

### Drop-off resume behaviour

If a user completes currency but abandons before completing PIN setup, they have `currency` set but `onboarding_complete = false` and no `pin_hash`. On next login, middleware redirects them to `/onboarding` (public route, not gated). The onboarding name page checks: if `profile.currency` is already set, skip forward to `/onboarding/pin` (step 3). This ensures they resume at the step they left off rather than restarting from the beginning.

### `/onboarding/pin` page

- Eyebrow: "Step 3 of 3"
- Heading: "Secure your account"
- Body: "Set a 4-digit PIN. You'll enter it each time you open Cenza."
- UI: 4-dot display + 10-key number pad (0–9) + delete key
- Flow:
  1. User enters 4 digits → display fills → moves to confirm step
  2. "Confirm your PIN" — enter 4 digits again
  3. If match → call `setupPin()` → set `onboarding_complete = true` → `router.push('/')`
  4. If mismatch → shake animation on dots → clear both → back to step 1 with "PINs didn't match" message

No skip option.

---

## PIN Entry Page `/pin`

Full-screen page inside `/(app)/` route group but **explicitly excluded from the PIN gate** in middleware (see Middleware logic, step 1 above). `/(app)/layout.tsx` provides `UserContext`, so the user's name is available.

- Heading: "Enter your PIN"
- Subheading: "Welcome back, {name}" — name from `UserContext`
- UI: 4-dot display + number pad
- On 4th digit entered → auto-submits (no confirm button needed)
- Calls `verifyPin(pin)`
- Success → `router.replace('/app')`
- Failure → shake animation, dots clear, "Incorrect PIN" message below dots. After 5 wrong attempts → lock for 30 seconds (countdown shown), then allow retry.

### Forgot PIN

"Forgot your PIN?" text button at the bottom of the page.

Flow:
1. Call `clearPinVerified()` + `supabase.auth.signOut()`
2. Redirect to `/login`
3. User re-authenticates with Google
4. After OAuth callback, middleware redirects to `/pin` (because `cenza-has-pin` is still set, `cenza-pin-verified` is absent)
5. On `/pin`, detect fresh session: if Supabase session `created_at` is within the last 2 minutes, show **"Just signed in? Reset your PIN"** link above the number pad

### `/pin/reset` page

Same UI as `/onboarding/pin` (enter + confirm). Also excluded from the PIN gate in middleware.

**Server-side freshness guard (enforced in the page's server component, not just UI):**
- Fetch the current Supabase session server-side
- If `session.created_at` is older than 2 minutes → redirect to `/pin` (do not render the reset form)
- If `cenza-pin-verified` cookie is present → redirect to `/app` (already verified, no need to reset)
- Only render the reset form if session is fresh AND PIN is not currently verified

On successful PIN reset:
- Calls `setupPin()` (updates `pin_hash`, sets both cookies)
- `router.replace('/app')`

---

## Settings: Change PIN

New "Security" section in Settings page, above "Account".

Row: "PIN" → "Change"

Tapping "Change" opens a bottom sheet with three steps:
1. Enter current PIN (verified via `verifyPin()` — if fails, show error and stay on step 1)
2. Enter new PIN
3. Confirm new PIN
4. On match → `setupPin()` → toast "PIN updated" → close sheet

---

## File Structure

| Path | Action | Purpose |
|------|--------|---------|
| `src/app/(public)/onboarding/pin/page.tsx` | Create | PIN setup onboarding step (server wrapper) |
| `src/app/(public)/onboarding/pin/PinSetupClient.tsx` | Create | Client component — enter + confirm PIN flow |
| `src/app/(public)/onboarding/page.tsx` | Modify | Add resume check: if `profile.currency` set, redirect to `/onboarding/pin` |
| `src/app/(public)/onboarding/currency/page.tsx` | Modify | **Breaking prerequisite — must ship in the same task as PIN setup page creation.** Remove `onboarding_complete: true` and `router.push('/')` (moved to PIN step); change eyebrow from "Step 2 of 2" to "Step 2 of 3"; change `router.push('/')` to `router.push('/onboarding/pin')`. If this page is not updated before `/onboarding/pin` is deployed, users who set currency will be marked complete and skip PIN setup entirely. |
| `src/app/(app)/pin/page.tsx` | Create | PIN entry gate (server wrapper) |
| `src/app/(app)/pin/PinEntryClient.tsx` | Create | Client component — enter PIN, forgot flow |
| `src/app/(app)/pin/reset/page.tsx` | Create | PIN reset page — server component with freshness guard, renders PinSetupClient |
| `src/lib/actions/pin.ts` | Create | Server actions: `setupPin`, `verifyPin`, `clearPinVerified` |
| `src/components/ui/PinPad.tsx` | Create | Reusable 4-dot display + number pad component |
| `src/lib/supabase/middleware.ts` | Modify | Add PIN cookie check; exclude `/pin` and `/pin/reset` from PIN gate |
| `src/app/(app)/settings/page.tsx` | Modify | Add "Security" section with Change PIN sheet |
| `src/types/database.ts` | Modify | Add `pin_hash: string \| null` to `UserProfile` interface |

---

## Out of Scope

- Biometrics
- PIN for existing users (users without `pin_hash` are never gated — no `cenza-has-pin` cookie is set for them)
- Admin PIN reset
- Multiple device management
