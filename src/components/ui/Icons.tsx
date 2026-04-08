// ─────────────────────────────────────────────────────────────
// Icons.tsx — All app icons sourced from lucide-react
// Import icons from here, never directly from lucide-react,
// so we have one place to swap or remap icons if needed.
//
// IconBadge — wraps any icon in a pill container
//   size: container size in px (default 36)
//   bg: background color (default soft grey using --border token)
//   radius: border radius in px (default 999 = full pill)
// ─────────────────────────────────────────────────────────────

export {
  LayoutDashboard  as IconOverview,
  CreditCard       as IconSpend,
  Target           as IconGoals,
  TrendingUp       as IconFinance,
  Plus             as IconPlus,
  Minus            as IconMinus,
  Trash2           as IconTrash,
  ChevronDown      as IconChevronDown,
  ChevronRight     as IconChevronRight,
  X                as IconChevronX,
  Coins            as IconCurrency,
  Calendar         as IconCalendar,
  CircleDotDashed  as IconTarget,
  ArrowLeft        as IconBack,
  Check            as IconCheck,
  Settings         as IconSettings,
  User             as IconUser,
  Shield           as IconGoalEmergency,
  Car              as IconGoalCar,
  Home             as IconGoalHome,
  Plane            as IconGoalTravel,
  GraduationCap    as IconGoalEducation,
  Briefcase        as IconGoalBusiness,
  Users            as IconGoalFamily,
  Star             as IconGoalOther,
} from 'lucide-react'

// ── IconBadge ────────────────────────────────────────────────
// Wraps any Lucide icon in a rounded container.
// bg accepts any CSS color string or CSS variable.
// Example usage:
//   <IconBadge><IconPlus size={16} color="var(--brand-deep)" /></IconBadge>
//   <IconBadge size={44} bg="var(--brand)" radius={12}><IconGoals size={20} /></IconBadge>

interface IconBadgeProps {
  children: React.ReactNode
  size?: number
  bg?: string
  radius?: number
}

export function IconBadge({
  children,
  size = 36,
  bg = 'color-mix(in srgb, var(--border) 60%, transparent)',
  radius = 999,
}: IconBadgeProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  )
}
