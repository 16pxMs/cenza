Project: Cenza

Stack
- Next.js (App Router)
- TypeScript
- Supabase Postgres
- Supabase Auth

Architecture
- UI components inside src/components
- Pages inside src/app
- Supabase logic inside src/lib/supabase
- Types generated in src/types/database.ts

Rules
- Use server components by default
- Use server actions for writes
- Avoid unnecessary client state
- Keep code simple and readable

See also: [.claude/rules.md](.claude/rules.md)