'use client'

import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { IconCalendar, IconChevronRight, IconRecap } from '@/components/ui/Icons'
import styles from './AddExpenseChoiceSheet.module.css'

interface AddExpenseChoiceSheetProps {
  open: boolean
  onClose: () => void
  returnTo: string
}

export function buildExpenseImportHref(returnTo: string, mode: 'current' | 'past' = 'current') {
  const encodedReturnTo = encodeURIComponent(returnTo)
  if (mode === 'past') return `/log/import?mode=past&returnTo=${encodedReturnTo}`
  return `/log/import?returnTo=${encodedReturnTo}`
}

export function AddExpenseChoiceSheet({ open, onClose, returnTo }: AddExpenseChoiceSheetProps) {
  const router = useRouter()

  const goToImport = (mode: 'current' | 'past') => {
    router.push(buildExpenseImportHref(returnTo, mode))
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add expense">
      <div className={styles.choices}>
        <button
          type="button"
          className={styles.optionCard}
          onClick={() => goToImport('current')}
        >
          <span className={styles.optionIcon} aria-hidden="true">
            <IconCalendar size={19} strokeWidth={2.2} />
          </span>
          <span>
            <span className={styles.optionTitle}>Add a recent expense</span>
            <span className={styles.optionSubtext}>Track something you spent today or this month.</span>
          </span>
          <IconChevronRight className={styles.optionChevron} size={17} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.optionCard}
          onClick={() => goToImport('past')}
        >
          <span className={styles.optionIcon} aria-hidden="true">
            <IconRecap size={19} strokeWidth={2.2} />
          </span>
          <span>
            <span className={styles.optionTitle}>Add older expenses</span>
            <span className={styles.optionSubtext}>Bring in expenses from previous months or another app.</span>
          </span>
          <IconChevronRight className={styles.optionChevron} size={17} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
    </Sheet>
  )
}
