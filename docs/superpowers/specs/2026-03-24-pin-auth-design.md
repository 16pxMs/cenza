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

For every request to `/(app)/*`:

1. No Supabase session → redirect `/login` *(already exists)*
2. Supabase session + `cenza-has-pin` present + no `cenza-pin-verified` → redirect `/pin`
3. All other authenticated requests → pass through

No database queries added to middleware. The `cenza-has-pin` cookie is the only signal needed.

### Sign-out behaviour

When signing out (Settings, session timeout, forgot-PIN flow), the server action must clear `cenza-pin-verified`. `cenza-has-pin` can remain — it is not sensitive.

---

## Database

One new column on `user_profiles`:

```sql
pin_hash TEXT NULL
```

Null = PIN not set (existing users before this feature). Non-null = bcrypt hash of the user's 4-digit PIN.

No migration needed for existing users — they are not affected until they go through a PIN setup flow (existing users are out of scope for this spec; PIN is only set during new-user onboarding for now).

---

## Server Actions

All PIN operations happen server-side. Three actions:

### `setupPin(pin: string): Promise<void>`
- Validates pin is exactly 4 digits
- `bcrypt.hash(pin, 10)`
- Updates `user_profiles.pin_hash`
- Sets `cenza-has-pin=1` cookie (non-httpOnly, path `/`, no maxAge)
- Sets `cenza-pin-verified=1` cookie (httpOnly, path `/`, no maxAge — session cookie)

### `verifyPin(pin: string): Promise<boolean>`
- Fetches `pin_hash` from `user_profiles` for the current user (server-side Supabase client)
- `bcrypt.compare(pin, pin_hash)`
- If match: sets `cenza-pin-verified=1` cookie (httpOnly, session cookie), returns `true`
- If no match: returns `false`

### `clearPinVerified(): Promise<void>`
- Clears `cenza-pin-verified` cookie (sets it with `maxAge=0`)
- Used on sign-out

---

## Onboarding Flow

**Before:** Name (`/onboarding`) → Currency (`/onboarding/currency`) → `onboarding_complete = true` → `/`

**After:** Name (`/onboarding`) → Currency (`/onboarding/currency`) → **PIN setup (`/onboarding/pin`)** → `onboarding_complete = true` → `/`

The currency page currently sets `onboarding_complete: true` before redirecting. This is moved to the PIN setup step.

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

Full-screen page (not an overlay). Shown by middleware redirect when PIN not verified.

- Heading: "Enter your PIN"
- Body: user's name pulled from `UserContext` — "Welcome back, {name}"
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
6. Tapping it redirects to `/pin/reset`

### `/pin/reset` page

Same UI as `/onboarding/pin` (enter + confirm). On success:
- Calls `setupPin()` (updates `pin_hash`, sets cookies)
- `router.replace('/app')`

The fresh-session check (2-minute window) guards this route — direct navigation without a fresh auth session should not show the reset option. The `/pin/reset` page itself also checks: if `cenza-pin-verified` is already set, redirect to `/app` (no need to reset).

---

## Settings: Change PIN

New "Security" section in Settings page, above "Account".

Row: "PIN" → "Change"

Tapping "Change" opens a bottom sheet with three steps:
1. Enter current PIN (verified via `verifyPin()`)
2. Enter new PIN
3. Confirm new PIN
4. On match → `setupPin()` → toast "PIN updated" → close sheet

---

## File Structure

| Path | Action | Purpose |
|------|--------|---------|
| `src/app/(public)/onboarding/pin/page.tsx` | Create | PIN setup onboarding step (server wrapper) |
| `src/app/(public)/onboarding/pin/PinSetupClient.tsx` | Create | Client component — enter + confirm PIN flow |
| `src/app/(public)/onboarding/currency/page.tsx` | Modify | Remove `onboarding_complete: true` (moved to PIN step) |
| `src/app/(app)/pin/page.tsx` | Create | PIN entry gate (server wrapper) |
| `src/app/(app)/pin/PinEntryClient.tsx` | Create | Client component — enter PIN, forgot flow |
| `src/app/(app)/pin/reset/page.tsx` | Create | PIN reset page (server wrapper, reuses PinSetupClient) |
| `src/lib/actions/pin.ts` | Create | Server actions: `setupPin`, `verifyPin`, `clearPinVerified` |
| `src/components/ui/PinPad.tsx` | Create | Reusable 4-dot display + number pad component |
| `src/lib/supabase/middleware.ts` | Modify | Add PIN cookie check |
| `src/app/(app)/settings/page.tsx` | Modify | Add "Security" section with Change PIN sheet |
| `src/types/database.ts` | Modify | Add `pin_hash` to `UserProfile` interface |

---

## Out of Scope

- Biometrics
- PIN for existing users (existing users without a `pin_hash` are not gated)
- Admin PIN reset
- Multiple device management
