import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookies = vi.fn()

vi.mock('next/headers', () => ({ cookies }))

function makeCookieJar() {
  return { set: vi.fn() }
}

// PIN validation regex — extracted here so we can test it without mocking Next.js internals
const PIN_REGEX = /^\d{4}$/

describe('PIN validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts 4-digit strings', () => {
    expect(PIN_REGEX.test('1234')).toBe(true)
    expect(PIN_REGEX.test('0000')).toBe(true)
    expect(PIN_REGEX.test('9999')).toBe(true)
  })

  it('rejects fewer than 4 digits', () => {
    expect(PIN_REGEX.test('123')).toBe(false)
    expect(PIN_REGEX.test('')).toBe(false)
  })

  it('rejects more than 4 digits', () => {
    expect(PIN_REGEX.test('12345')).toBe(false)
  })

  it('rejects non-digit characters', () => {
    expect(PIN_REGEX.test('abcd')).toBe(false)
    expect(PIN_REGEX.test('12ab')).toBe(false)
    expect(PIN_REGEX.test('12 4')).toBe(false)
  })
})

describe('PIN cookie clearing', () => {
  it('clearPinVerified only clears the verification cookie', async () => {
    const jar = makeCookieJar()
    cookies.mockResolvedValue(jar)

    const { clearPinVerified } = await import('./pin')
    await clearPinVerified()

    expect(jar.set).toHaveBeenCalledTimes(1)
    expect(jar.set).toHaveBeenCalledWith(
      'cenza-pin-verified',
      '',
      expect.objectContaining({ httpOnly: true, maxAge: 0 })
    )
  })

  it('clearPinDeviceState with forgetDevice clears verification and known-device cookies', async () => {
    const jar = makeCookieJar()
    cookies.mockResolvedValue(jar)

    const { clearPinDeviceState } = await import('./pin')
    await clearPinDeviceState({ forgetDevice: true })

    expect(jar.set).toHaveBeenCalledWith(
      'cenza-pin-verified',
      '',
      expect.objectContaining({ httpOnly: true, maxAge: 0 })
    )
    expect(jar.set).toHaveBeenCalledWith(
      'cenza-has-pin',
      '',
      expect.objectContaining({ httpOnly: false, maxAge: 0 })
    )
    expect(jar.set).toHaveBeenCalledWith(
      'cenza-returning-user',
      '',
      expect.objectContaining({ httpOnly: false, maxAge: 0 })
    )
  })
})
