import Link from 'next/link'
import { IconBack } from '@/components/ui/Icons'
import styles from './AppSubpageHeader.module.css'

type AppSubpageHeaderProps = {
  title: string
  backHref: string
  ariaLabel?: string
}

/**
 * Shared header for first-level pages opened from the More/Menu surface.
 *
 * Use for deterministic More child destination pages, such as Recap, Debts,
 * Goals, and Settings. Do not use for root tab pages, multi-step flows, or
 * contextual drill-down screens.
 *
 * Navigation must be explicit through backHref. Do not use router.back() here:
 * More child pages should always return to the known parent route.
 */
export function AppSubpageHeader({
  title,
  backHref,
  ariaLabel = 'Back',
}: AppSubpageHeaderProps) {
  if (!backHref?.trim()) {
    throw new Error('AppSubpageHeader requires a deterministic backHref. Do not use router.back() for More child pages.')
  }

  return (
    <header className={styles.header}>
      <Link href={backHref} aria-label={ariaLabel} className={styles.backLink}>
        <IconBack size={20} />
      </Link>
      <h1 className={styles.title}>{title}</h1>
    </header>
  )
}
