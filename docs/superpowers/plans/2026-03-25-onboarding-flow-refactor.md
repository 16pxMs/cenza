# Onboarding Flow Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the repeated-nudge loop by replacing `FirstTimeWelcome` (after the first skip) with a calm locked-overview screen that shows frosted-glass placeholder cards and one passive CTA.

**Architecture:** Four small, independent changes — simplify `FirstTimeWelcome` to remove dead nudge variants, hoist `dismiss()` in the first-log flow so the repeat-skip path skips the interstitial, create the new `OverviewLocked` component, then wire it into the app shell's four-way branch. No database changes, no new routes.

**Tech Stack:** Next.js 15 App Router, TypeScript, React, inline styles with CSS design tokens (`var(--brand-dark)`, `var(--text-muted)`, etc.), `localStorage` for `cenza_skip_count`.

---

## File Map

| File | Action | What it does |
|------|--------|-------------|
| `src/components/flows/overview/FirstTimeWelcome.tsx` | Modify | Remove escalating nudges — component becomes stateless with single fixed copy |
| `src/app/(app)/log/first/page.tsx` | Modify | Hoist `dismiss()` to component scope; skip interstitial when `cenza_skip_count >= 1` |
| `src/components/flows/overview/OverviewLocked.tsx` | Create | New component — locked placeholder cards with frosted-glass overlays |
| `src/app/(app)/app/page.tsx` | Modify | Add `skipCount` state, set it in `load()`, insert `OverviewLocked` into the four-way branch |

---

## Task 1: Simplify FirstTimeWelcome

**Files:**
- Modify: `src/components/flows/overview/FirstTimeWelcome.tsx`

`FirstTimeWelcome` currently has a `NUDGES[0..2]` array and reads `cenza_skip_count` from `localStorage` to pick which message to show. With `OverviewLocked` now handling skip counts ≥ 1, `NUDGES[1]` and `NUDGES[2]` are dead code. Remove them and the state machinery.

This task has no automated tests (no component tests in this codebase). Verify manually.

- [ ] **Step 1: Open the file and confirm the before-state**

Read `src/components/flows/overview/FirstTimeWelcome.tsx`. Confirm it imports `useState` and `useEffect`, has a `NUDGES` array with 3 entries, and has a `skipCount` state that drives `nudge` selection.

- [ ] **Step 2: Replace the file content**

Replace the entire file with:

```tsx
'use client'

// ─────────────────────────────────────────────────────────────────────────────
// FirstTimeWelcome — shown on first visit before the user logs anything.
// Shown only when cenza_skip_count === 0. After the first skip, OverviewLocked
// takes over — so there is only one nudge variant.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  name:    string
  onStart: () => void
}

function greeting(name: string) {
  const h = new Date().getHours()
  if (h < 12) return `Morning, ${name}.`
  if (h < 18) return `Hey, ${name}.`
  return `Evening, ${name}.`
}

export function FirstTimeWelcome({ name, onStart }: Props) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '0 var(--page-padding-mobile, 16px)',
      background: 'var(--page-bg)',
    }}>

      <div style={{ maxWidth: 480, width: '100%' }}>

        <p style={{
          margin: '0 0 var(--space-sm)',
          fontSize: 'var(--text-base)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--brand-dark)',
          letterSpacing: '0.01em',
        }}>
          {greeting(name)}
        </p>

        <h1 style={{
          margin: '0 0 var(--space-md)',
          fontSize: 'var(--text-3xl)',
          color: 'var(--text-1)',
        }}>
          Let's see where your<br />money goes.
        </h1>

        <p style={{
          margin: '0 0 var(--space-xxl)',
          fontSize: 'var(--text-base)',
          color: 'var(--text-2)',
          lineHeight: 1.65,
        }}>
          Start by logging something you spent today. We'll build your overview from there.
        </p>

        <button
          onClick={onStart}
          style={{
            width: '100%',
            height: 56,
            borderRadius: 'var(--radius-lg)',
            background: 'var(--brand-dark)',
            border: 'none',
            color: 'var(--text-inverse)',
            fontSize: 'var(--text-base)',
            fontWeight: 'var(--weight-semibold)',
            cursor: 'pointer',
            letterSpacing: '-0.1px',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Log my first expense
        </button>

      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript is clean**

```bash
cd /Users/mshumaker/Documents/codeFile/publicFinance && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/flows/overview/FirstTimeWelcome.tsx
git commit -m "refactor: simplify FirstTimeWelcome to single static nudge"
```

---

## Task 2: Hoist dismiss() and skip interstitial on repeat visits

**Files:**
- Modify: `src/app/(app)/log/first/page.tsx:46-68` (Step type), `200-257` (stepPick), `416-485` (step === 'skip' block)

`dismiss()` is currently defined inside the `if (step === 'skip') { return ... }` early-return block (around line 418), making it inaccessible to `stepPick`. The fix: hoist `dismiss()` to component scope and add a `skipCount` read so `stepPick`'s "Nothing to log right now" button can call `dismiss()` directly when the user has already seen the interstitial once.

- [ ] **Step 1: Open the file and locate the three areas to change**

Read `src/app/(app)/log/first/page.tsx`. Find:
1. The `dismiss` function inside `if (step === 'skip') { ... }` (around line 418–422)
2. The "Nothing to log right now" button in `stepPick` (around line 241–255)
3. The entire `if (step === 'skip') { return (...) }` block (around line 416–485)

- [ ] **Step 2: Add skipCount state and hoist dismiss() to component scope**

After the existing state declarations (after `const [isSubscription, setIsSubscription] = useState(false)`, around line 65), add:

```tsx
  const [skipCount, setSkipCount] = useState(0)

  useEffect(() => {
    setSkipCount(parseInt(localStorage.getItem('cenza_skip_count') ?? '0', 10))
  }, [])

  const dismiss = () => {
    const current = parseInt(localStorage.getItem('cenza_skip_count') ?? '0', 10)
    localStorage.setItem('cenza_skip_count', String(current + 1))
    router.replace('/app')
  }
```

This matches the existing codebase pattern (same `useState` + `useEffect` approach that `FirstTimeWelcome` used) and avoids SSR hydration mismatches. `useState` and `useEffect` are already imported at the top of the file.

- [ ] **Step 3: Update the "Nothing to log right now" button click handler**

In `stepPick`, find the button with `onClick={() => setStep('skip')}`. Replace the `onClick` with:

```tsx
onClick={() => skipCount >= 1 ? dismiss() : setStep('skip')}
```

The full button after the change:

```tsx
      <button
        onClick={() => skipCount >= 1 ? dismiss() : setStep('skip')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '24px 0 0',
          fontSize: 14,
          color: T.textMuted,
          fontFamily: 'inherit',
          display: 'block',
          width: '100%',
          textAlign: 'center',
        }}
      >
        Nothing to log right now
      </button>
```

- [ ] **Step 4: Remove the inline dismiss() from the skip block**

In the `if (step === 'skip')` early-return block, find and delete the local `const dismiss = () => { ... }` definition (the one that was there before hoisting). The rest of the block — the JSX with "Let me log something" / "Got it, I'll log later" — stays exactly as is. It still calls `dismiss()` and `setStep('pick')`, which now resolve to the hoisted function.

- [ ] **Step 5: Verify TypeScript is clean**

```bash
cd /Users/mshumaker/Documents/codeFile/publicFinance && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/log/first/page.tsx
git commit -m "refactor: skip interstitial on repeat visits in first-log flow"
```

---

## Task 3: Create OverviewLocked component

**Files:**
- Create: `src/components/flows/overview/OverviewLocked.tsx`

New component. Shows the same card layout as `OverviewWithData` but with placeholder skeleton shapes inside each card and a frosted-glass overlay on top. One sticky primary CTA at the bottom. No state, no data fetching — purely presentational.

- [ ] **Step 1: Create the file**

```bash
touch /Users/mshumaker/Documents/codeFile/publicFinance/src/components/flows/overview/OverviewLocked.tsx
```

- [ ] **Step 2: Write the component**

```tsx
'use client'

// ─────────────────────────────────────────────────────────────────────────────
// OverviewLocked — shown when the user has declined to log at least once.
//
// Displays the same card layout as OverviewWithData but with skeleton placeholders
// and a frosted-glass overlay on each card. No data, no state — purely presentational.
// The single CTA routes to /log/first.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  name:    string
  onStart: () => void
}

function greeting(name: string) {
  const h = new Date().getHours()
  if (h < 12) return `Morning, ${name}.`
  if (h < 18) return `Hey, ${name}.`
  return `Evening, ${name}.`
}

function LockedCard({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <div style={{
      position: 'relative',
      background: 'var(--white, #fff)',
      border: '1px solid var(--border, #E4E7EC)',
      borderRadius: 'var(--radius-lg, 16px)',
      overflow: 'hidden',
      marginBottom: 'var(--space-md, 12px)',
    }}>
      {children}
      {/* Frosted glass overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        background: 'rgba(255, 255, 255, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '0 24px',
      } as React.CSSProperties}>
        <span style={{ fontSize: 20 }}>🔒</span>
        <span style={{
          fontSize: 'var(--text-sm, 13px)',
          color: 'var(--text-muted, #98A2B3)',
          fontWeight: 'var(--weight-medium, 500)',
          textAlign: 'center',
          lineHeight: 1.4,
        }}>
          {hint}
        </span>
      </div>
    </div>
  )
}

export function OverviewLocked({ name, onStart }: Props) {
  // currency prop intentionally omitted — locked state shows no real data
  return (
    <div style={{
      padding: '0 var(--page-padding-mobile, 16px)',
      paddingBottom: 96,
      paddingTop: 'var(--space-xl, 24px)',
      maxWidth: 600,
      margin: '0 auto',
    }}>

      {/* Greeting */}
      <p style={{
        margin: '0 0 var(--space-xl, 24px)',
        fontSize: 'var(--text-base, 15px)',
        fontWeight: 'var(--weight-semibold, 600)',
        color: 'var(--brand-dark, #5C3489)',
        letterSpacing: '0.01em',
      }}>
        {greeting(name)}
      </p>

      {/* Spending summary card */}
      <LockedCard hint="Log an expense to see your spending">
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 48, background: '#F2F4F7', borderRadius: 8 }} />
          ))}
        </div>
      </LockedCard>

      {/* Budget categories card */}
      <LockedCard hint="Your categories will appear here">
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F2F4F7', flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ height: 8, background: '#F2F4F7', borderRadius: 4, width: '60%' }} />
                <div style={{ height: 8, background: '#F2F4F7', borderRadius: 4, width: '40%' }} />
              </div>
            </div>
          ))}
        </div>
      </LockedCard>

      {/* Goals card */}
      <LockedCard hint="Track savings goals once you start logging">
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ height: 8, background: '#F2F4F7', borderRadius: 4, width: '100%' }} />
          ))}
        </div>
      </LockedCard>

      {/* Sticky CTA */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px var(--page-padding-mobile, 16px)',
        background: 'var(--page-bg, #F8F9FA)',
        borderTop: '1px solid var(--border, #E4E7EC)',
      }}>
        <button
          onClick={onStart}
          style={{
            width: '100%',
            height: 56,
            borderRadius: 'var(--radius-lg, 16px)',
            background: 'var(--brand-dark, #5C3489)',
            border: 'none',
            color: 'var(--text-inverse, #fff)',
            fontSize: 'var(--text-base, 15px)',
            fontWeight: 'var(--weight-semibold, 600)',
            cursor: 'pointer',
            letterSpacing: '-0.1px',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          + Log expense
        </button>
      </div>

    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript is clean**

```bash
cd /Users/mshumaker/Documents/codeFile/publicFinance && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/flows/overview/OverviewLocked.tsx
git commit -m "feat: add OverviewLocked component with frosted-glass locked cards"
```

---

## Task 4: Wire OverviewLocked into app/page.tsx

**Files:**
- Modify: `src/app/(app)/app/page.tsx`

Three changes:
1. Import `OverviewLocked`
2. Add `skipCount` state; set it inside `load()` right after `setCycleId`
3. Update the `overviewContent` ternary to insert the `OverviewLocked` case

`isFirstTimeUser = !incomeData && totalSpent === 0` already covers `OverviewLocked` (same condition), so `BottomNav` suppression requires no change.

- [ ] **Step 1: Add the import**

Find the existing imports block at the top of `src/app/(app)/app/page.tsx`. After the line:

```tsx
import { FirstTimeWelcome } from '@/components/flows/overview/FirstTimeWelcome'
```

Add:

```tsx
import { OverviewLocked } from '@/components/flows/overview/OverviewLocked'
```

- [ ] **Step 2: Add skipCount state**

In the state declarations block (around line 58–74, alongside `totalSpent`, `cycleId`, etc.), add:

```tsx
  const [skipCount, setSkipCount] = useState(0)
```

- [ ] **Step 3: Set skipCount inside loadOverviewData**

`skipCount` must be set in the same React batch as `totalSpent` so the four-way branch renders with both values correct simultaneously. The right place is at the end of `loadOverviewData`, just before the `setLoading(false)` call (line 280).

Find this line in `loadOverviewData` (around line 280):

```tsx
    setLoading(false)
  }, [supabase])
```

Change it to:

```tsx
    setSkipCount(parseInt(localStorage.getItem('cenza_skip_count') ?? '0', 10))
    setLoading(false)
  }, [supabase])
```

This ensures `totalSpent`, `skipCount`, and `loading` flip together in one React render, preventing any transient flash of the wrong overview screen.

- [ ] **Step 4: Update the overviewContent branch**

Find the current three-way ternary (around line 522–563):

```tsx
  // 3-way overview state:
  //  1. No income + no transactions → first-time user, log expense first
  //  2. No income + has transactions → needs to add income (OverviewEmpty)
  //  3. Has income → full overview
  const overviewContent = incomeData ? (
    <OverviewWithData ... />
  ) : totalSpent === 0 ? (
    <FirstTimeWelcome
      name={firstName}
      onStart={() => router.push('/log/first')}
    />
  ) : (
    <OverviewEmpty ... />
  )
```

Replace the comment and the ternary with:

```tsx
  // 4-way overview state:
  //  1. Has income                             → OverviewWithData
  //  2. No income + has transactions           → OverviewEmpty (enter income)
  //  3. No income + no transactions + skip ≥ 1 → OverviewLocked (passive empty state)
  //  4. No income + no transactions + skip = 0 → FirstTimeWelcome (first-ever visit)
  const overviewContent = incomeData ? (
    <OverviewWithData
      name={firstName}
      currency={profile?.currency || 'KES'}
      goals={freshGoals.length > 0 ? freshGoals : (profile?.goals || [])}
      incomeData={incomeData}
      goalTargets={goalTargets}
      goalSaved={goalSaved}
      goalLabels={goalLabels}
      onLogExpense={() => {
        const incomeConfirmed = incomeData?.received != null && (incomeData as any).received > 0
        if (totalSpent > 0 && !incomeConfirmed) {
          setPendingLogNavigation(true)
          setIncomeCheckOpen(true)
        } else {
          router.push(totalSpent === 0 ? '/log/first' : '/log?open=true')
        }
      }}
      onConfirmIncome={() => setIncomeCheckOpen(true)}
      onContribGoal={handleContribGoal}
      totalSpent={totalSpent}
      fixedTotal={fixedTotal}
      spendingBudget={spendingBudget}
      categorySpend={categorySpend}
      isDesktop={isDesktop}
    />
  ) : totalSpent === 0 && skipCount >= 1 ? (
    <OverviewLocked
      name={firstName}
      onStart={() => router.push('/log/first')}
    />
  ) : totalSpent === 0 ? (
    <FirstTimeWelcome
      name={firstName}
      onStart={() => router.push('/log/first')}
    />
  ) : (
    <OverviewEmpty
      name={firstName}
      currency={profile?.currency || 'KES'}
      onSave={async (data) => { await saveIncome(data); setIncomeSheetOpen(false) }}
    />
  )
```

- [ ] **Step 5: Verify TypeScript is clean**

```bash
cd /Users/mshumaker/Documents/codeFile/publicFinance && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run tests to confirm nothing is broken**

```bash
cd /Users/mshumaker/Documents/codeFile/publicFinance && npx vitest run
```

Expected: all 127 tests passing.

- [ ] **Step 7: Manual smoke test**

1. Open the app in a browser
2. Open DevTools → Application → Local Storage → clear `cenza_skip_count` (or set it to `0`)
3. Navigate to `/app` — should see `FirstTimeWelcome` with "Log my first expense" CTA
4. Tap "Log my first expense" → `/log/first` → tap "Nothing to log right now" → should see the skip interstitial ("One expense unlocks all of this") — this is correct for first skip
5. Tap "Got it, I'll log later" → should land on `/app` showing `OverviewLocked` (three locked cards, frosted overlays, sticky "+ Log expense" button)
6. Refresh the page — should still show `OverviewLocked` (not `FirstTimeWelcome`)
7. Tap "Nothing to log right now" again on `/log/first` — should go **directly** to `/app` (no interstitial shown again)
8. Tap "+ Log expense" on `OverviewLocked` → routes to `/log/first`
9. Log an expense successfully → redirected to `/app` → should show `OverviewWithData` (not `OverviewLocked`)

- [ ] **Step 8: Commit**

```bash
git add src/app/(app)/app/page.tsx
git commit -m "feat: wire OverviewLocked into app shell — respects skip_count for empty state routing"
```
