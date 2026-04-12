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

## UX copy rules
- Do not mechanically replace words like "month" with "cycle"
- Only change user-facing copy when the wording is off-spec for the product model
- Use natural language a normal user would understand quickly
- Prefer neutral phrasing over awkward product terminology
- Preserve existing tone and brevity
- If the underlying logic is still month-based, do not hide that with copy-only rewrites

## Tone of voice

Cenza voice is:
- clear
- calm
- human
- helpful
- direct

Guidelines:
- write like a person, not a system
- prefer simple spoken language
- avoid jargon and forced product terminology
- do not use “cycle” if it makes a sentence sound unnatural
- avoid metaphors that reduce clarity
- keep sentences short and direct
- do not repeat the same idea across title and message
- title = state
- message = context or next step

If a line sounds robotic, rewrite it instead of replacing words.

## Punctuation rules
- Do not use hyphens or em dashes in user-facing copy
- Avoid compound words that require hyphenation (e.g. "day-to-day")
- Rewrite the sentence instead of using punctuation as a shortcut
- Use commas or simple sentence structure instead
- Prefer shorter sentences over complex punctuation

See also: [.claude/rules.md](.claude/rules.md)