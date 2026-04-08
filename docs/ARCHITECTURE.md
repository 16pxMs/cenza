# Architecture Guide

This repo is organized around a server-first App Router structure.

The goal is simple:
- load authenticated app data on the server
- keep browser components focused on interaction
- centralize DB reads and writes behind loaders and server actions
- keep finance rules out of route components

## Core Principles

### 1. Routes are server entrypoints

Files like `src/app/(app)/**/page.tsx` should usually:
- resolve auth/session
- read route params or search params
- call a loader
- render a client component with prepared props

They should not grow into large client-bootstrap files with `useEffect` fetching and business logic.

### 2. Loaders own read orchestration

Files in `src/lib/loaders/*.ts` assemble view models for pages.

A loader is the right place for:
- multi-table reads
- current-cycle lookups
- aggregation and formatting for a screen
- mapping raw DB rows into UI-friendly shapes

A loader is not the right place for:
- browser state
- event handlers
- mutation logic

### 3. Server actions own writes

Feature mutations live next to routes in `src/app/(app)/**/actions.ts`.

Actions should:
- validate input
- resolve auth/session
- call shared DB helpers when appropriate
- revalidate affected routes

Client components should call actions, not write directly to Supabase for app data.

### 4. Shared DB helpers enforce contracts

Use `src/lib/supabase/*.ts` for shared persistence rules that multiple features depend on.

Current examples:
- `transactions-db.ts`
- `cycles-db.ts`

These helpers are the right place for:
- transaction write contracts
- cycle-aware inserts
- cycle-scoped deletes
- reusable table access rules

### 5. Client components are interactive shells

Client files such as `*PageClient.tsx` should mostly handle:
- local UI state
- sheets/modals
- input state
- toasts
- navigation
- calling server actions

They should receive already-prepared data from the server whenever possible.

### 6. Setup flows are page-first

If a flow is multi-step, edits a major part of the month's setup, or needs room for explanation and backtracking, it should be a dedicated page.

Current page-first setup flows include:
- `src/app/(app)/income/new/page.tsx`
- `src/app/(app)/income/fixed/page.tsx`
- `src/app/(app)/income/budget/page.tsx`
- `src/app/(app)/goals/new/page.tsx`
- `src/app/(app)/log/new/page.tsx`

Sheets are still appropriate for quick, contextual actions such as:
- goal contributions
- quick confirms
- delete/refund prompts
- small settings actions like changing a PIN

Avoid reintroducing setup-heavy sheets for:
- income setup
- fixed-expense setup
- spending-budget setup
- any other flow that feels route-worthy

## Current Boundary Map

### App shell

- `src/app/(app)/layout.tsx`
- `src/lib/auth/app-session.ts`
- `src/lib/context/UserContext.tsx`

The app shell hydrates from server auth/profile data. `UserContext` exists for browser-side session updates and profile refreshes, not as the primary source of first-render app data.

### Server loaders

Key loaders currently live in `src/lib/loaders/`:
- `overview.ts`
- `log.ts`
- `history.ts`
- `history-ledger.ts`
- `goals.ts`
- `new-goal.ts`
- `plan.ts`
- `income.ts`
- `settings.ts`
- `targets.ts`

Each loader returns a page-specific view model rather than leaking raw table structure directly into UI code.

### Server actions

Feature actions live with their route:
- `src/app/(app)/app/actions.ts`
- `src/app/(app)/income/actions.ts`
- `src/app/(app)/settings/actions.ts`
- `src/app/(app)/goals/actions.ts`
- `src/app/(app)/goals/new/actions.ts`
- `src/app/(app)/log/actions.ts`
- `src/app/(app)/log/first/actions.ts`
- `src/app/(app)/log/new/actions.ts`
- `src/app/(app)/targets/actions.ts`
- `src/app/(app)/history/[key]/actions.ts`

### Shared domain and DB helpers

- `src/lib/supabase/transactions-db.ts`
- `src/lib/supabase/cycles-db.ts`
- `src/lib/finance.ts`
- `src/lib/cycles.ts`
- `src/lib/math/finance.ts`

Keep cross-feature logic here instead of duplicating it in route code.

## Data Model Expectations

The app now assumes a cycle-based finance model.

Important invariants:
- `income_entries.cycle_id` is required
- `fixed_expenses.cycle_id` is required
- `spending_budgets.cycle_id` is required
- `transactions.cycle_id` is required

For transaction writes, the expected contract is:
- `user_id`
- local `date`
- `cycle_id`
- `category_type`
- `category_key`
- `category_label`
- `amount`

If a new feature writes transactions, it should go through the shared transaction helper unless there is a strong reason not to.

## File Placement Rules

When adding a new feature:

1. Put page data assembly in a loader under `src/lib/loaders`.
2. Put mutations in `actions.ts` beside the route.
3. Put reusable persistence logic in `src/lib/supabase` if more than one feature needs it.
4. Keep the route `page.tsx` thin.
5. Create a `*PageClient.tsx` only if the screen needs browser interactivity.

## What To Avoid

Avoid reintroducing these patterns:
- fetching page data in `useEffect` when the page can render from the server
- direct client-side Supabase writes for finance data
- duplicating cycle lookup logic in multiple features
- rebuilding transaction payloads ad hoc in route files
- querying legacy schema fields like `month` instead of current cycle/date fields
- leaving unused UI flows in the codebase after structural changes
- putting multi-step setup flows back into sheets just because a wrapper component already exists

## Testing Guidance

The repo already has strong coverage for pure helpers and improving coverage for orchestration.

Prefer tests in these places:
- loader tests for complex page view-model assembly
- server action tests for mutation orchestration and validation
- helper tests for cycle math and transaction contracts

High-value flows to keep covered:
- cycle-aware transaction writes
- goal target save/archive/remove
- refund and delete orchestration
- auth/profile refresh behavior

## Supabase Alignment

Schema changes must be recorded in `supabase/migrations/`.

If you make a manual SQL change in Supabase:
- capture it immediately in a migration file
- verify `src/types/database.ts` still matches the live schema
- update docs if setup assumptions changed

## Practical Review Checklist

Before merging feature work, check:
- Is the page server-loaded?
- Is the client component only handling UI concerns?
- Are reads centralized in a loader?
- Are writes going through server actions?
- Are shared persistence rules reused instead of duplicated?
- Does the code match the cycle-based schema?
- Did any Supabase change get mirrored in migrations and types?
- If this is a setup flow, should it be its own page instead of a sheet?

If the answer is yes across that list, the feature is probably aligned with the current architecture.
