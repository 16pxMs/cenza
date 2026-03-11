// ─────────────────────────────────────────────────────────────────────────────
// Design System Tokens
// Brand: #EADFF4 (soft lavender)
// ─────────────────────────────────────────────────────────────────────────────

export const T = {
  // Brand
  brand:       '#EADFF4',
  brandMid:    '#C9AEE8',
  brandDeep:   '#9B6FCC',
  brandDark:   '#5C3489',
  brandDarker: '#3B1F60',

  // Dark surfaces (onboarding, summary cards)
  darkBg:      '#120D1E',
  darkSurface: '#1E1530',
  darkBorder:  '#2E2248',

  // Page
  pageBg:      '#FAFAF8',
  white:       '#FFFFFF',
  border:      '#EDE8F5',
  borderStrong:'#D5CDED',

  // Text
  text1:       '#1A1025',
  text2:       '#4A3B66',
  text3:       '#8B7BA8',
  textMuted:   '#B8AECE',

  // Semantic: green
  green:       '#22C55E',
  greenLight:  '#F0FDF4',
  greenBorder: '#BBF7D0',
  greenDark:   '#15803D',

  // Semantic: amber
  amber:       '#F59E0B',
  amberLight:  '#FFFBEB',
  amberBorder: '#FDE68A',
  amberDark:   '#92400E',

  // Semantic: red
  red:         '#EF4444',
  redLight:    '#FFF1F2',
  redBorder:   '#FECACA',
  redDark:     '#991B1B',
} as const

// ─── Typography ───────────────────────────────────────────────────────────────

export const FONTS = {
  serif: "'Lora', Georgia, serif",
  sans:  "'DM Sans', system-ui, sans-serif",
} as const

// ─── Spacing scale ────────────────────────────────────────────────────────────

export const SPACE = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const

// ─── Radii ────────────────────────────────────────────────────────────────────

export const RADIUS = {
  sm:   10,
  md:   14,
  lg:   16,
  xl:   20,
  full: 999,
} as const

// ─── Reusable style objects ───────────────────────────────────────────────────

export const CARD_STYLE: React.CSSProperties = {
  background:   T.white,
  border:       `1.5px solid ${T.border}`,
  borderRadius: RADIUS.lg,
}

export const BTN_PRIMARY: React.CSSProperties = {
  height:       52,
  borderRadius: RADIUS.md,
  background:   T.brandDark,
  border:       'none',
  color:        '#fff',
  fontSize:     15,
  fontWeight:   600,
  fontFamily:   FONTS.sans,
  cursor:       'pointer',
  width:        '100%',
}

export const BTN_GHOST: React.CSSProperties = {
  background: 'none',
  border:     'none',
  cursor:     'pointer',
  fontFamily: FONTS.sans,
}
