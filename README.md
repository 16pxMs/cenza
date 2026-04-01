# Cenza

Personal finance tracker. Built with Next.js, Supabase, and inline styles.

---

## Tech stack

- **Next.js 15** — App Router, Server Components, Server Actions
- **TypeScript** — strict mode
- **Supabase** — Auth (Google OAuth), Postgres DB, RLS
- **Vercel** — deployment
- **Inline styles** — design tokens in `src/constants/tokens.ts`

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/your-org/cenza.git
cd cenza
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the Supabase dashboard go to **SQL Editor**
3. Run the migration files in order from `supabase/migrations/`
4. If your database was created earlier from only `0001_initial_schema.sql`, also run the later reconciliation migrations before using the app

### 3. Configure Google OAuth in Supabase

1. Supabase Dashboard → Authentication → Providers → Google
2. Enable Google provider
3. Add your Google OAuth credentials (from [console.cloud.google.com](https://console.cloud.google.com))
4. Add your callback URL: `https://your-project.supabase.co/auth/v1/callback`

### 4. Set environment variables

```bash
cp .env.local.example .env.local
```

Fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase → Project Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from the same page
- `NEXT_PUBLIC_SITE_URL` — `http://localhost:3000` for local dev

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project structure

```
src/
├── app/
│   ├── auth/           # OAuth callback + server actions
│   ├── login/          # Login page
│   ├── onboarding/     # 6-screen onboarding flow
│   ├── app/            # Main app (4-tab shell)
│   └── layout.tsx      # Root layout with fonts
├── components/
│   ├── ui/             # AmountInput, Card, Btn, etc.
│   ├── layout/         # TopBar, BottomNav
│   └── flows/          # Onboarding, GoalSetup, ExpenseEntry, etc.
├── constants/
│   ├── tokens.ts       # Design system tokens (T object)
│   ├── goals.ts        # GOAL_META
│   └── categories.ts   # Expense, spending, subscription categories
├── hooks/              # useUser, useMonthData, etc.
├── lib/
│   ├── supabase/       # client.ts, server.ts, middleware.ts
│   └── utils.ts        # fmt, toMonthKey, greeting, etc.
└── types/
    └── database.ts     # Full TypeScript types for all tables
supabase/
└── migrations/
    ├── 0001_initial_schema.sql
    └── 0008_schema_reconciliation.sql
```

---

## Deploy to Vercel

1. Push to GitHub
2. Import repo on [vercel.com](https://vercel.com)
3. Add environment variables in Vercel project settings
4. Add your Vercel domain to Supabase → Authentication → URL Configuration → Redirect URLs

---

## Design system

All tokens live in `src/constants/tokens.ts`. Never hardcode colours or fonts — always reference `T.brandDark` etc.

Brand colour: `#EADFF4`  
Heading font: Lora (serif)  
UI font: DM Sans
