'use client'

import { useFormStatus } from 'react-dom'
import { PrimaryBtn } from '@/components/ui/Button/Button'

export function SubmitButton({
  idleLabel,
  pendingLabel,
  disabled = false,
}: {
  idleLabel: string
  pendingLabel: string
  disabled?: boolean
}) {
  const { pending } = useFormStatus()
  const isDisabled = pending || disabled

  return (
    <PrimaryBtn type="submit" size="lg" disabled={isDisabled}>
      {pending ? pendingLabel : idleLabel}
    </PrimaryBtn>
  )
}
