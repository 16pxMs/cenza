# Onboarding Flow Refactor — Design Spec

## Goal

Remove the repeated-nudge loop after a user declines to log. Replace it with a calm, locked overview that demonstrates value passively and respects user intent.

## Architecture

The refactor touches two things:
1. **Flow routing** — after the second decline, route to a new locked overview instead of back to `FirstTimeWelcome`
2. **New component** — `OverviewLocked`, a static preview of `OverviewWithData` with frosted-glass overlays on every card

No database changes. No new routes. One new component, one routing condition change.

## Tech Stack

Next.js App Router, TypeScript, existing CSS design tokens (`var(--text-1)`, `var(--brand-dark)`, etc.), existing `OverviewWithData.css` card chrome.

---

## Revised Flow

```
First visit (skip_count = 0)
  └── /app → FirstTimeWelcome
        ├── "Log my first expense" → /log/first → normal logging path
        └── "Nothing to log right now" → skip interstitial (in /log/first)
              ├── "Let me log something" → back to category pick
              └── "Got it, I'll log later"
                    → localStorage: cenza_skip_count = 1
                    → /app → OverviewLocked  ← NEW

Subsequent visits (skip_count ≥ 1, no transactions yet)
  └── /app → OverviewLocked (directly, no nudge)
        └── "+ Log expense" → /log/first (no skip interstitial shown again)

User logs first expense
  └── /app → OverviewWithData (existing, unchanged)
```

## State Logic

`app/page.tsx` already derives `isFirstTimeUser = !incomeData && totalSpent === 0` after the async `load()` effect completes. The `skipCount` read is added inside `load()`, after `totalSpent` is resolved — not at the top of the component body (which would cause a flash on the first render).

The existing three-way branch (lines 526–557) becomes four-way:

```ts
// New state in AppPage component body (alongside totalSpent, incomeData, etc.):
const [skipCount, setSkipCount] = useState(0)

// Inside load(), after totalSpent is resolved:
setSkipCount(parseInt(localStorage.getItem('cenza_skip_count') ?? '0', 10))

// Rendering (overviewContent):
// 1. incomeData exists            → OverviewWithData  (unchanged)
// 2. !incomeData && totalSpent > 0 → OverviewEmpty    (unchanged)
// 3. !incomeData && totalSpent === 0 && skipCount >= 1 → OverviewLocked (new)
// 4. !incomeData && totalSpent === 0 && skipCount === 0 → FirstTimeWelcome (unchanged)
```

**BottomNav suppression:** `isFirstTimeUser = !incomeData && totalSpent === 0` already covers both `FirstTimeWelcome` and `OverviewLocked` (both satisfy the same condition). No change needed — `BottomNav` is suppressed for the locked state automatically. The sticky "+ Log expense" CTA inside `OverviewLocked` sits at the bottom with standard page padding, no collision.

**`FirstTimeWelcome` simplification:** The existing `NUDGES` array has 3 escalating messages for skip counts 0, 1, and 2. With `OverviewLocked` taking over from skip count ≥ 1, `NUDGES[1]` and `NUDGES[2]` become unreachable dead code. Remove them — simplify `FirstTimeWelcome` to a single static message (current `NUDGES[0]`). Remove the `skipCount` state and `useEffect` from that component entirely.

---

## OverviewLocked Component

**File:** `src/components/flows/overview/OverviewLocked.tsx`

**Props:**
```ts
interface Props {
  name:     string
  currency: string
  onStart:  () => void   // routes to /log/first
}
```

**Layout** (mobile-first, matches `OverviewWithData` card spacing):

```
Greeting: "Hey, {name}."    ← var(--brand-dark), same as OverviewWithData

[Locked card] Spending summary
[Locked card] Budget categories
[Locked card] Goals

Sticky bottom CTA: "+ Log expense"
```

### Locked Card Pattern

Every card is a wrapper with `position: relative` + `overflow: hidden`. Inside: placeholder skeleton shapes (grey bars, lines using `var(--grey-100)` or `#F2F4F7`). On top: a frosted overlay div.

**Overlay CSS:**
```css
.locked-overlay {
  position: absolute;
  inset: 0;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  background: rgba(255, 255, 255, 0.6);
  border-radius: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
```

**Overlay content per card:**

| Card | Lock icon | Hint text |
|------|-----------|-----------|
| Spending summary | 🔒 | "Log an expense to see your spending" |
| Budget categories | 🔒 | "Your categories will appear here" |
| Goals | 🔒 | "Track savings goals once you start logging" |

Hint text: `font-size: var(--text-sm)`, `color: var(--text-muted)`, `font-weight: var(--weight-medium)`.

### CTA

Sticky at page bottom, same style as primary buttons elsewhere:
- Height: 56px, full width with `var(--page-padding-mobile)` margin
- Background: `var(--brand-dark)`
- Label: `+ Log expense`
- `onClick`: calls `props.onStart`

### Placeholder shapes inside each card

Kept minimal — just enough to show the card has structure:

**Spending summary card:**
- 3 stat boxes side by side (grey rectangles, `height: 48px`)

**Budget categories card:**
- 3 rows, each: grey circle (category icon placeholder) + two grey lines (label + amount)

**Goals card:**
- 2 rows, each: progress-bar shape (full-width grey bar, `height: 8px`, `border-radius: 4px`)

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/flows/overview/OverviewLocked.tsx` | **Create** — new component |
| `src/app/(app)/app/page.tsx` | **Modify** — add `skipCount` check; render `OverviewLocked` when `skip_count >= 1` and no transactions |
| `src/app/(app)/log/first/page.tsx` | **Modify** — `dismiss()` is currently defined inside the `step === 'skip'` early-return block; hoist it to component scope so `stepPick` can call it. In `stepPick`, the "Nothing to log right now" button currently transitions to `step === 'skip'`. Change it so that when `skip_count >= 1`, clicking that button calls `dismiss()` directly (skipping the interstitial). When `skip_count === 0`, behaviour is unchanged (show interstitial). `dismiss()` itself is unchanged — it already always increments `cenza_skip_count` and calls `router.replace('/app')`. |
| `src/components/flows/overview/FirstTimeWelcome.tsx` | **Modify** — remove `NUDGES[1]` and `NUDGES[2]`, remove `skipCount` state and `useEffect`. Component becomes stateless with a single fixed message. |

No other files touched. `FirstTimeWelcome` and `OverviewWithData` are untouched.

---

## What Is Not Changing

- `OverviewWithData` — unchanged
- `/log/first` logging flow (pick → frequency → amount → done) — unchanged
- No new routes, no database columns, no API calls
- No modal, no full-screen takeover, no repeated prompts after first skip
