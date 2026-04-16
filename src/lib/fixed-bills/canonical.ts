// Canonical key mapping for fixed bills.
//
// Users name bills naturally ("Home WiFi", "Office Internet", "Safaricom fibre").
// deriveBillsLeftToPay matches by exact category_key, so same-concept bills
// must resolve to the same key. This map is deterministic: only recognised
// synonyms are rewritten. Anything else passes through unchanged.
//
// Scope: fixed bills only. Apply at write sites where a fixed-bill
// category_key is persisted. Never apply to everyday/debt/goal/subscription.

// Exported so the one-off SQL backfill can generate its mapping from the
// exact same source — no divergence between write-time canonicalization
// and the historical backfill.
export const FIXED_BILL_SYNONYMS: Record<string, string> = {
  // Internet / home broadband
  wifi: 'internet',
  home_wifi: 'internet',
  office_wifi: 'internet',
  home_internet: 'internet',
  office_internet: 'internet',
  fibre: 'internet',
  fiber: 'internet',
  home_fibre: 'internet',
  home_fiber: 'internet',
  safaricom_fibre: 'internet',
  safaricom_fiber: 'internet',
  zuku: 'internet',
  faiba: 'internet',
  jtl: 'internet',

  // Rent
  house_rent: 'rent',
  home_rent: 'rent',
  monthly_rent: 'rent',

  // Water
  water_bill: 'water',
  water_tokens: 'water',

  // Electricity
  power: 'electricity',
  kplc: 'electricity',
  electricity_tokens: 'electricity',
  electricity_token: 'electricity',
  power_tokens: 'electricity',
  power_bill: 'electricity',

  // Cooking fuel (maps to preset `gas`)
  cooking_gas: 'gas',
  lpg: 'gas',

  // Housekeeping (matches editor preset `houseKeeping`)
  house_keeper: 'houseKeeping',
  housekeeper: 'houseKeeping',
  house_help: 'houseKeeping',
  housekeeping: 'houseKeeping',
}

export function slugifyBillLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function canonicalizeFixedBillKey(rawKey: string): string {
  const cleaned = slugifyBillLabel(rawKey)
  if (!cleaned) return rawKey
  return FIXED_BILL_SYNONYMS[cleaned] ?? cleaned
}

export function isKnownFixedBillKey(rawKey: string): boolean {
  const cleaned = slugifyBillLabel(rawKey)
  if (!cleaned) return false
  const canonical = FIXED_BILL_SYNONYMS[cleaned] ?? cleaned
  return KNOWN_CANONICAL_KEYS.has(canonical)
}

export const KNOWN_CANONICAL_KEYS = new Set([
  'rent',
  'electricity',
  'water',
  'gas',
  'internet',
  'phone',
  'houseKeeping',
  'blackTax',
  'schoolFees',
  'childcare',
])
