'use client'
import { useState } from 'react'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { Input } from '@/components/ui/Input/Input'
import { PrimaryBtn } from '@/components/ui/Button/Button'

const GOAL_META: Record<string, { label: string; icon: string }> = {
  emergency: { label: 'Emergency Fund', icon: '🛡️' },
  car:        { label: 'Car',            icon: '🚗' },
  travel:     { label: 'Travel',         icon: '✈️' },
  home:       { label: 'Home',           icon: '🏠' },
  education:  { label: 'Education',      icon: '📚' },
  business:   { label: 'Business',       icon: '💼' },
  family:     { label: 'Family',         icon: '👨‍👩‍👧' },
  other:      { label: 'Other Goal',     icon: '⭐' },
}

interface Props {
  open: boolean
  onClose: () => void
  goals: string[]
  currency: string
}

export function AddGoalTargetsSheet({ open, onClose, goals = [], currency }: Props) {
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  const update = (id: string, val: string) =>
    setAmounts(a => ({ ...a, [id]: val }))

  const handleSave = () => {
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Set targets for your goals">
      <p style={{
        fontSize: 13,
        color: 'var(--text-3)',
        margin: '0 0 20px',
        lineHeight: 1.5,
      }}>
        How much do you want to save for each goal? You can update these any time.
      </p>

      {goals.map(id => {
        const meta = GOAL_META[id]
        if (!meta) return null
        return (
          <Input
            key={id}
            label={`${meta.icon}  ${meta.label}`}
            value={amounts[id] ?? ''}
            onChange={val => update(id, val)}
            prefix={currency}
            placeholder="e.g. 100,000"
            type="number"
          />
        )
      })}

      <PrimaryBtn onClick={handleSave}>Save targets</PrimaryBtn>
    </Sheet>
  )
}
