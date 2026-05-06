export const CATEGORY_CONFIG = {
  rent: { key: 'rent', label: 'Rent', type: 'fixed' },
  electricity: { key: 'electricity', label: 'Electricity', type: 'fixed' },
  water: { key: 'water', label: 'Water', type: 'fixed' },
  gas: { key: 'gas', label: 'Gas / Cooking fuel', type: 'fixed' },
  internet: { key: 'internet', label: 'Internet', type: 'fixed' },
  phone: { key: 'phone', label: 'Phone', type: 'fixed' },
  housekeeping: { key: 'housekeeping', label: 'House help', type: 'fixed' },
  schoolFees: { key: 'schoolFees', label: 'School fees', type: 'fixed' },
  childcare: { key: 'childcare', label: 'Childcare', type: 'fixed' },
  subscriptions: { key: 'subscriptions', label: 'Subscriptions', type: 'fixed' },

  groceries: { key: 'groceries', label: 'Groceries', type: 'everyday' },
  eatingOut: { key: 'eatingOut', label: 'Eating out', type: 'everyday' },
  coffee: { key: 'coffee', label: 'Coffee / Drinks', type: 'everyday' },
  transport: { key: 'transport', label: 'Transport', type: 'everyday' },
  fuel: { key: 'fuel', label: 'Fuel', type: 'everyday' },
  parking: { key: 'parking', label: 'Parking', type: 'everyday' },
  clothing: { key: 'clothing', label: 'Clothing', type: 'everyday' },
  personal: { key: 'personal', label: 'Personal care', type: 'everyday' },
  entertainment: { key: 'entertainment', label: 'Entertainment', type: 'everyday' },
  electronics: { key: 'electronics', label: 'Electronics', type: 'everyday' },
  homeGoods: { key: 'homeGoods', label: 'Home goods', type: 'everyday' },
  health: { key: 'health', label: 'Health / Medical', type: 'everyday' },
  fitness: { key: 'fitness', label: 'Fitness', type: 'everyday' },
  education: { key: 'education', label: 'Learning', type: 'everyday' },
  gifts: { key: 'gifts', label: 'Gifts', type: 'everyday' },
  travel: { key: 'travel', label: 'Travel', type: 'everyday' },
  charity: { key: 'charity', label: 'Giving / Tithe', type: 'everyday' },
  kids: { key: 'kids', label: 'Kids', type: 'everyday' },
  pets: { key: 'pets', label: 'Pets', type: 'everyday' },
  misc: { key: 'misc', label: 'Miscellaneous', type: 'everyday' },
  beauty: { key: 'beauty', label: 'Beauty & personal care', type: 'everyday' },
  alcohol: { key: 'alcohol', label: 'Alcohol', type: 'everyday' },
  sports: { key: 'sports', label: 'Sports', type: 'everyday' },
  shopping: { key: 'shopping', label: 'Shopping', type: 'everyday' },
  family_support: { key: 'family_support', label: 'Family support', type: 'everyday' },
  tools: { key: 'tools', label: 'Tools & hardware', type: 'everyday' },
  medicine: { key: 'medicine', label: 'Medicine', type: 'everyday' },

  emergency: { key: 'emergency', label: 'Emergency fund', type: 'goal' },
  family: { key: 'family', label: 'Family', type: 'goal' },

  debt_repayment: { key: 'debt_repayment', label: 'Debt repayment', type: 'debt' },
  debt_opening_balance: { key: 'debt_opening_balance', label: 'Debt opening balance', type: 'debt' },
}

export const CATEGORY_ALIASES = {
  wifi: 'internet',
  home_wifi: 'internet',
  fibre: 'internet',
  fiber: 'internet',
  eating_out: 'eatingOut',
  black_tax: 'family_support',
  houseKeeping: 'housekeeping',
  house_rent: 'rent',
  power: 'electricity',
  house_help: 'housekeeping',
}

export const LEGACY_CATEGORY_KEY_MAP = {
  blackTax: 'family_support',
  black_tax: 'family_support',
  groceries_eggs: 'groceries',
  spent_on_groceries: 'groceries',

  uber: 'transport',
  boda: 'transport',
  uber_boda: 'transport',
  uber_for_ciiku: 'transport',
  uber_for_ciiky: 'transport',
  uber_from_gideon: 'transport',
  uber_to_staff_hangout: 'transport',

  eating_out: 'eatingOut',
  eating_out_at_pedros: 'eatingOut',
  dumplings_0110732768: 'eatingOut',
  beers_at_geko: 'eatingOut',

  chat_gpt: 'subscriptions',
  claude: 'subscriptions',
  claude_subscription: 'subscriptions',
  you_tube: 'subscriptions',
  google_1_storage: 'subscriptions',

  ali_express: 'shopping',
  soap_dish_from_miniso: 'shopping',
  pot_plants_part_payment: 'shopping',

  skin_care: 'beauty',
  skin_care_laroshe_face_wash: 'beauty',
  skin_care_cosryx_cleanser: 'beauty',
  spent_on_hair: 'beauty',

  tennis: 'sports',
  tennis_training: 'sports',
  tennis_court: 'sports',
  tennis_shorts: 'sports',
  tennis_overgrip: 'sports',

  mom: 'family_support',
  ciiku: 'family_support',
  philippa: 'family_support',
  wanjiku_wanjohi: 'family_support',
  miscellaneous_to_cikku: 'family_support',
  miscellaneous_to_ciiku: 'family_support',
  delivery_of_ciikus_umbrella: 'family_support',

  plier_tool: 'tools',
  screw_for_socket: 'tools',
  '45v_switch_and_electrical_tape': 'tools',

  rent_water_electricity: 'rent',
  spent_on_electricity: 'electricity',
  spent_on_tuition_fee: 'schoolFees',
  school_trip: 'schoolFees',
  school_fee: 'schoolFees',
  school_fees: 'schoolFees',
  tuition_fee: 'schoolFees',
  tuition_fees: 'schoolFees',

  credit_card: 'debt_repayment',
  debt: 'debt_repayment',

  miscellaneous: 'misc',
  i_dont_remember_what_this_expense_is_dor: 'misc',

  accessories: 'shopping',
  hardware: 'tools',
}

function normalizeLookupKey(key) {
  return key?.trim() ?? ''
}

export function resolveCategoryKey(key) {
  const normalized = normalizeLookupKey(key)
  if (!normalized) return null
  return CATEGORY_CONFIG[normalized]
    ? normalized
    : (CATEGORY_ALIASES[normalized] ?? LEGACY_CATEGORY_KEY_MAP[normalized] ?? null)
}

export function getCategoryConfig(key) {
  const resolved = resolveCategoryKey(key)
  return resolved ? CATEGORY_CONFIG[resolved] ?? null : null
}

export function getCategoryLabel(key, fallback) {
  return getCategoryConfig(key)?.label ?? fallback ?? normalizeLookupKey(key)
}

export function getCategoryTypeFromKey(key, fallback) {
  return getCategoryConfig(key)?.type ?? fallback ?? null
}

export function isKnownCategoryKey(key) {
  return resolveCategoryKey(key) != null
}

export function getCategoriesByType(type) {
  return Object.values(CATEGORY_CONFIG).filter((category) => category.type === type)
}
