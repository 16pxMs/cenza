'use client'

import { useState } from 'react'
import { IconPlus } from '@/components/ui/Icons'
import { AddExpenseChoiceSheet } from '@/components/flows/log/AddExpenseChoiceSheet'

interface Props {
  returnTo: string
}

export function GlobalAddButton({ returnTo }: Props) {
  const [choiceOpen, setChoiceOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-label="Add expense"
        onClick={() => setChoiceOpen(true)}
        style={{
          position: 'fixed',
          right: 'var(--space-lg)',
          bottom: 'calc(var(--bottom-nav-height, 0px) + var(--space-lg))',
          minWidth: 0,
          height: 56,
          borderRadius: 'var(--radius-full)',
          border: 'none',
          background: 'var(--brand-dark)',
          color: 'var(--text-inverse)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-xs)',
          padding: '0 var(--space-md)',
          boxShadow: '0 10px 24px rgba(0,0,0,0.16)',
          cursor: 'pointer',
          zIndex: 45,
          fontSize: 'var(--text-base)',
          fontWeight: 'var(--weight-semibold)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <IconPlus size={18} color="currentColor" />
        <span>Add expense</span>
      </button>
      <AddExpenseChoiceSheet
        open={choiceOpen}
        onClose={() => setChoiceOpen(false)}
        returnTo={returnTo}
      />
    </>
  )
}
