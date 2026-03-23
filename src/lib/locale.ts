// ─────────────────────────────────────────────────────────────
// src/lib/locale.ts — Locale detection + currency catalogue
//
// Single source of truth for:
//   - Detecting currency from device locale (navigator.language)
//   - The curated and full currency lists used across the app
//
// detectCurrency() returns null when the locale is unmapped —
// callers should fall back to the manual flag picker.
//
// No side-effects. Safe to call server-side with a fallback.
// ─────────────────────────────────────────────────────────────

export interface CurrencyOption {
  code: string
  name: string
  flag: string
}

// ── Curated — shown by default in the picker ──────────────────
export const CURATED_CURRENCIES: CurrencyOption[] = [
  { code: 'KES', name: 'Kenyan Shilling',    flag: '🇰🇪' },
  { code: 'NGN', name: 'Nigerian Naira',     flag: '🇳🇬' },
  { code: 'ZAR', name: 'South African Rand', flag: '🇿🇦' },
  { code: 'UGX', name: 'Ugandan Shilling',   flag: '🇺🇬' },
  { code: 'GHS', name: 'Ghanaian Cedi',      flag: '🇬🇭' },
  { code: 'TZS', name: 'Tanzanian Shilling', flag: '🇹🇿' },
  { code: 'USD', name: 'US Dollar',          flag: '🇺🇸' },
  { code: 'GBP', name: 'British Pound',      flag: '🇬🇧' },
  { code: 'EUR', name: 'Euro',               flag: '🇪🇺' },
  { code: 'AED', name: 'UAE Dirham',         flag: '🇦🇪' },
]

// ── Full list — shown when user searches ─────────────────────
export const ALL_CURRENCIES: CurrencyOption[] = [
  ...CURATED_CURRENCIES,
  { code: 'AUD', name: 'Australian Dollar',      flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar',        flag: '🇨🇦' },
  { code: 'CHF', name: 'Swiss Franc',            flag: '🇨🇭' },
  { code: 'CNY', name: 'Chinese Yuan',           flag: '🇨🇳' },
  { code: 'INR', name: 'Indian Rupee',           flag: '🇮🇳' },
  { code: 'JPY', name: 'Japanese Yen',           flag: '🇯🇵' },
  { code: 'BRL', name: 'Brazilian Real',         flag: '🇧🇷' },
  { code: 'MXN', name: 'Mexican Peso',           flag: '🇲🇽' },
  { code: 'SGD', name: 'Singapore Dollar',       flag: '🇸🇬' },
  { code: 'HKD', name: 'Hong Kong Dollar',       flag: '🇭🇰' },
  { code: 'SEK', name: 'Swedish Krona',          flag: '🇸🇪' },
  { code: 'NOK', name: 'Norwegian Krone',        flag: '🇳🇴' },
  { code: 'ZMW', name: 'Zambian Kwacha',         flag: '🇿🇲' },
  { code: 'BWP', name: 'Botswana Pula',          flag: '🇧🇼' },
  { code: 'RWF', name: 'Rwandan Franc',          flag: '🇷🇼' },
  { code: 'ETB', name: 'Ethiopian Birr',         flag: '🇪🇹' },
  { code: 'XOF', name: 'West African CFA Franc', flag: '🌍' },
  { code: 'XAF', name: 'Central African CFA',    flag: '🌍' },
  { code: 'MAD', name: 'Moroccan Dirham',        flag: '🇲🇦' },
  { code: 'EGP', name: 'Egyptian Pound',         flag: '🇪🇬' },
  { code: 'PKR', name: 'Pakistani Rupee',        flag: '🇵🇰' },
  { code: 'PHP', name: 'Philippine Peso',        flag: '🇵🇭' },
  { code: 'IDR', name: 'Indonesian Rupiah',      flag: '🇮🇩' },
  { code: 'MYR', name: 'Malaysian Ringgit',      flag: '🇲🇾' },
  { code: 'THB', name: 'Thai Baht',              flag: '🇹🇭' },
  { code: 'KRW', name: 'South Korean Won',       flag: '🇰🇷' },
  { code: 'TRY', name: 'Turkish Lira',           flag: '🇹🇷' },
  { code: 'SAR', name: 'Saudi Riyal',            flag: '🇸🇦' },
  { code: 'QAR', name: 'Qatari Riyal',           flag: '🇶🇦' },
  { code: 'KWD', name: 'Kuwaiti Dinar',          flag: '🇰🇼' },
  { code: 'NZD', name: 'New Zealand Dollar',     flag: '🇳🇿' },
  { code: 'PLN', name: 'Polish Zloty',           flag: '🇵🇱' },
  { code: 'ILS', name: 'Israeli Shekel',         flag: '🇮🇱' },
]

// ── Locale → currency map ─────────────────────────────────────
// Full locale (e.g. 'en-KE') takes priority over language-only
// fallback (e.g. 'sw'). Returns null when unmapped — callers
// must show the manual picker.

const LOCALE_MAP: Record<string, string> = {
  // East Africa
  'en-KE': 'KES', 'sw-KE': 'KES', 'ki-KE': 'KES',
  'en-UG': 'UGX', 'sw-UG': 'UGX',
  'en-TZ': 'TZS', 'sw-TZ': 'TZS',
  'en-RW': 'RWF', 'rw-RW': 'RWF',
  'en-ET': 'ETB', 'am-ET': 'ETB',

  // West Africa
  'en-NG': 'NGN', 'ha-NG': 'NGN', 'yo-NG': 'NGN', 'ig-NG': 'NGN',
  'en-GH': 'GHS', 'ak-GH': 'GHS',

  // Southern Africa
  'en-ZA': 'ZAR', 'af-ZA': 'ZAR', 'zu-ZA': 'ZAR', 'xh-ZA': 'ZAR',
  'en-ZM': 'ZMW', 'bem-ZM': 'ZMW',
  'en-BW': 'BWP',

  // North Africa
  'ar-MA': 'MAD', 'fr-MA': 'MAD',
  'ar-EG': 'EGP',

  // Middle East
  'ar-AE': 'AED', 'en-AE': 'AED',
  'ar-SA': 'SAR',
  'ar-QA': 'QAR',
  'ar-KW': 'KWD',

  // Europe
  'en-GB': 'GBP',
  'de-DE': 'EUR', 'fr-FR': 'EUR', 'it-IT': 'EUR',
  'es-ES': 'EUR', 'nl-NL': 'EUR', 'pt-PT': 'EUR',
  'pl-PL': 'PLN',
  'sv-SE': 'SEK',
  'nb-NO': 'NOK', 'nn-NO': 'NOK',
  'tr-TR': 'TRY',
  'he-IL': 'ILS',

  // Americas
  'en-US': 'USD', 'es-US': 'USD',
  'en-CA': 'CAD', 'fr-CA': 'CAD',
  'pt-BR': 'BRL',
  'es-MX': 'MXN',

  // Asia-Pacific
  'zh-CN': 'CNY',
  'hi-IN': 'INR', 'en-IN': 'INR',
  'ja-JP': 'JPY',
  'ko-KR': 'KRW',
  'en-SG': 'SGD', 'zh-SG': 'SGD',
  'zh-HK': 'HKD', 'en-HK': 'HKD',
  'en-AU': 'AUD',
  'en-NZ': 'NZD',
  'id-ID': 'IDR',
  'ms-MY': 'MYR', 'en-MY': 'MYR',
  'th-TH': 'THB',
  'fil-PH': 'PHP', 'en-PH': 'PHP',
  'ur-PK': 'PKR', 'en-PK': 'PKR',
}

/**
 * Detect the user's likely currency from their device locale.
 *
 * Tries the full locale tag first (e.g. 'en-KE'), then the
 * region-only tag (e.g. 'KE' → scans for any '-KE' entry),
 * then the first entry from navigator.languages.
 *
 * Returns null when no match is found — callers should show
 * the manual currency picker in that case.
 *
 * Safe to call only in browser environments (guard with typeof window).
 */
export function detectCurrency(): string | null {
  if (typeof navigator === 'undefined') return null

  const locales = navigator.languages?.length
    ? [...navigator.languages]
    : [navigator.language]

  for (const locale of locales) {
    // 1. Exact match: 'en-KE'
    if (LOCALE_MAP[locale]) return LOCALE_MAP[locale]

    // 2. Region scan: extract '-KE' and find any matching entry
    const region = locale.split('-')[1]
    if (region) {
      const key = Object.keys(LOCALE_MAP).find(k => k.endsWith(`-${region}`))
      if (key) return LOCALE_MAP[key]
    }
  }

  return null
}

/**
 * Look up a currency option by its code.
 * Returns undefined if the code is not in the full list.
 */
export function getCurrencyByCode(code: string): CurrencyOption | undefined {
  return ALL_CURRENCIES.find(c => c.code === code)
}

/**
 * Filter ALL_CURRENCIES by a search query (code or name).
 * Returns CURATED_CURRENCIES when query is empty.
 */
export function searchCurrencies(query: string): CurrencyOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return CURATED_CURRENCIES
  return ALL_CURRENCIES.filter(
    c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q)
  )
}
