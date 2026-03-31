# Codebase Rules — PublicFinance

## 1. Database Writes (MANDATORY)

All Supabase writes MUST go through `dbWrite`.

Never write:

supabase.from(...).insert(...)
supabase.from(...).update(...)
supabase.from(...).upsert(...)

Always write:

const { error } = await dbWrite(
  supabase.from(...).insert(...)
)

if (error) return

Reason:
- Centralised error handling
- Prevent silent failures
- Consistent pattern across app

---

## 2. No Inline Business Logic Duplication

Do not repeat logic for:
- totals
- category aggregation
- recap calculations

If logic is reused, extract it.

---

## 3. State Scope Rules

Do NOT declare variables inside a block if used outside.

❌ Bad:
if (...) {
  const data = {}
}
use(data)

✅ Good:
let data = {}
if (...) {
  data = {}
}

---

## 4. Date Format (MANDATORY)

Never use:

new Date().toLocaleDateString()

Always use:

const d = new Date()
const pad = (n) => String(n).padStart(2, '0')
const date = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`

Reason:
- Consistent DB format
- Avoid locale bugs

---

## 5. Styling Rules

- Layout + reusable styles → CSS modules
- Dynamic styles → inline

Do NOT move everything to CSS blindly.

---

## 6. Do Not Rewrite Whole Files

When editing:
- Make minimal changes
- Do not remove unrelated code
- Preserve structure

---

## 7. Error Handling

Every write must follow:

const { error } = await dbWrite(...)
if (error) return

Never ignore errors.

---

## 8. Editing Existing Files

- Do not refactor unrelated parts
- Do not remove working UI or layout
- Do not simplify existing logic unless asked
- Only change what is explicitly requested

---

## 9. Rule Enforcement

If any rule is violated:
- Stop and explain why
- Do not proceed silently

---

## 10. Supabase Reads

- Always destructure { data, error }
- Always check error before using data
- Do not assume queries succeed

Example:

const { data, error } = await supabase.from(...).select(...)

if (error) {
  console.error(error)
  return
}