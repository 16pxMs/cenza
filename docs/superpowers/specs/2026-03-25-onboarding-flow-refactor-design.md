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

Single condition in `app/page.tsx` (where `FirstTimeWelcome` is currently rendered):

```ts
const skipCount = typeof window !== 'undefined'
  ? parseInt(localStorage.getItem('cenza_skip_count') ?? '0', 10)
  : 0

// If has transactions → OverviewWithData (existing)
// If skip_count >= 1  → OverviewLocked   (new)
// Otherwise           → FirstTimeWelcome (unchanged)
```

`FirstTimeWelcome` is unchanged — it remains the one-time first-visit screen.

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
| `src/app/(app)/log/first/page.tsx` | **Modify** — remove skip interstitial (`step === 'skip'`) when `skip_count >= 1`; `dismiss()` on skip always routes to `/app` |

No other files touched. `FirstTimeWelcome` and `OverviewWithData` are untouched.

---

## What Is Not Changing

- `FirstTimeWelcome` — unchanged
- `OverviewWithData` — unchanged
- `/log/first` logging flow (pick → frequency → amount → done) — unchanged
- No new routes, no database columns, no API calls
- No modal, no full-screen takeover, no repeated prompts after first skip
