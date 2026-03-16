// ─────────────────────────────────────────────────────────────────────────────
// Design System Tokens
// Brand: #EADFF4 (soft lavender)
// ─────────────────────────────────────────────────────────────────────────────

export const T = {
  brand:        'var(--brand)',
  brandMid:     'var(--brand-mid)',
  brandDeep:    'var(--brand-deep)',
  brandDark:    'var(--brand-dark)',
  brandDarker:  'var(--brand-darker)',
  darkBg:       'var(--dark-bg)',
  darkSurface:  'var(--dark-surface)',
  darkBorder:   'var(--dark-dark-border)',
  pageBg:       'var(--page-bg)',
  white:        'var(--white)',
  border:       'var(--border)',
  borderStrong: 'var(--border-strong)',
  text1:        'var(--text-1)',
  text2:        'var(--text-2)',
  text3:        'var(--text-3)',
  textMuted:    'var(--text-muted)',
  green:        'var(--green)',
  greenLight:   'var(--green-light)',
  greenBorder:  'var(--green-border)',
  greenDark:    'var(--green-dark)',
  amber:        'var(--amber)',
  amberLight:   'var(--amber-light)',
  amberBorder:  'var(--amber-border)',
  amberDark:    'var(--amber-dark)',
  red:          'var(--red)',
  redLight:     'var(--red-light)',
  redBorder:    'var(--red-border)',
  redDark:      'var(--red-dark)',
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
