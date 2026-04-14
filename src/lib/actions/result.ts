// Shared action-result contract. Server actions at the boundary return
// ActionResult so the client never sees raw framework / DB error strings.
// Low-level helpers (supabase, cycles, transactions) keep throwing; actions
// translate unexpected throws into a generic "unavailable" result.

export type ActionError =
  | { kind: 'validation';   message: string }
  | { kind: 'duplicate';    message: string }
  | { kind: 'conflict';     message: string }
  | { kind: 'unauthorized'; message: string }
  | { kind: 'unavailable';  message: string }
  | { kind: 'unknown';      message: string }

export type ActionResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: ActionError }

const GENERIC_UNAVAILABLE = "We couldn't complete that right now. Please try again in a moment."
const GENERIC_UNAUTHORIZED = "Your session expired. Sign in again."

export function unauthorized(message = GENERIC_UNAUTHORIZED): ActionResult<never> {
  return { ok: false, error: { kind: 'unauthorized', message } }
}

export function unavailable(message = GENERIC_UNAVAILABLE): ActionResult<never> {
  return { ok: false, error: { kind: 'unavailable', message } }
}

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

// Wrap the body of a server action. Any thrown error is logged server-side
// with its original detail and returned to the client as a generic message.
export async function runAction<T>(
  fn: () => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
  try {
    return await fn()
  } catch (e) {
    console.error('[action] unhandled', e)
    return unavailable()
  }
}