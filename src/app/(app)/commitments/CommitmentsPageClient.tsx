'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppSubpageHeader } from '@/components/layout/AppSubpageHeader/AppSubpageHeader'
import { AppSubpageLayout } from '@/components/layout/AppSubpageLayout/AppSubpageLayout'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { GlobalAddButton } from '@/components/layout/GlobalAddButton'
import { SideNav } from '@/components/layout/SideNav/SideNav'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { Input } from '@/components/ui/Input/Input'
import { MoneyInput } from '@/components/ui/MoneyInput/MoneyInput'
import { PrimaryBtn } from '@/components/ui/Button/Button'
import { useBreakpoint } from '@/hooks/useBreakpoint'
import { useToast } from '@/lib/context/ToastContext'
import { formatAmount } from '@/lib/formatting/amount'
import { removeMonthlyReminder, updateMonthlyReminder } from '@/app/(app)/log/actions'
import type { CommitmentsPageData, CommitmentReminderItem } from '@/lib/loaders/commitments'

interface Props {
  data: CommitmentsPageData
}

const T = {
  white: 'var(--white)',
  text1: 'var(--text-1)',
  text2: 'var(--text-2)',
  text3: 'var(--text-3)',
  brandDark: 'var(--brand-dark)',
}

function commitmentStatus(item: { status: string; daysUntilDue: number }) {
  if (item.status === 'overdue') return 'Overdue'
  if (item.status === 'today') return 'Due today'
  if (item.daysUntilDue === 1) return 'Due tomorrow'
  return `Due in ${item.daysUntilDue} days`
}

export default function CommitmentsPageClient({ data }: Props) {
  const router = useRouter()
  const { isDesktop } = useBreakpoint()
  const { toast } = useToast()
  const [editingReminder, setEditingReminder] = useState<CommitmentReminderItem | null>(null)
  const [selectedReminder, setSelectedReminder] = useState<CommitmentReminderItem | null>(null)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const cardStyle: React.CSSProperties = {
    background: T.white,
    border: 'var(--border-width) solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-card-sm)',
    marginBottom: 'var(--space-card-md)',
  }
  const titleStyle: React.CSSProperties = {
    margin: '0 0 var(--space-xs)',
    fontSize: 'var(--text-base)',
    fontWeight: 'var(--weight-medium)',
    color: T.text1,
  }
  const openReminderEditor = (item: CommitmentReminderItem) => {
    setSelectedReminder(null)
    setEditingReminder(item)
    setLabel(item.label)
    setAmount(String(item.amount))
  }

  const saveReminder = async () => {
    if (!editingReminder) return
    const nextLabel = label.trim()
    const nextAmount = Number.parseFloat(amount)
    if (!nextLabel || !(nextAmount > 0)) {
      toast('Add a name and amount')
      return
    }

    setSaving(true)
    try {
      await updateMonthlyReminder({
        categoryKey: editingReminder.key,
        label: nextLabel,
        monthlyAmount: nextAmount,
      })
      await Promise.all(editingReminder.keys.slice(1).map((key) => removeMonthlyReminder({ categoryKey: key })))
      toast('Reminder updated')
      setEditingReminder(null)
      router.refresh()
    } catch {
      toast('Could not update reminder')
    } finally {
      setSaving(false)
    }
  }

  const content = (
    <AppSubpageLayout>
      <AppSubpageHeader title="Commitments" backHref="/app" ariaLabel="Back to Overview" />
      <div style={{ marginTop: '-var(--space-xs)', paddingBottom: 'var(--space-card-md)' }}>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.45 }}>
          Recurring expenses and reminders you track each month.
        </p>
      </div>

      <section style={cardStyle}>
        <p style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          This cycle
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
          <p style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: T.text1, lineHeight: 1.12 }}>
            {data.summary.activeCount} {data.summary.activeCount === 1 ? 'commitment' : 'commitments'}
          </p>
          {data.summary.activeCount > 0 && (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: T.text2, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {formatAmount(data.summary.remainingAmount, { currency: data.currency, context: 'summary' })}
            </p>
          )}
        </div>
        <p style={{ margin: 'var(--space-xs) 0 0', fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.4 }}>
          {data.summary.activeCount > 0
            ? 'Tracked or remaining this cycle.'
            : 'Turn reminders on for recurring expenses to track what comes back every month.'}
        </p>
      </section>

      {data.dueSoon.length > 0 && (
        <section style={cardStyle}>
          <p style={titleStyle}>Due soon</p>
          <div style={{ marginTop: 'var(--space-xs)' }}>
          {data.dueSoon.map((item, index) => (
            <button
              key={`${item.source}-${item.id}`}
              type="button"
              onClick={() => router.push(item.actionHref)}
              style={{
                width: '100%',
                border: 'none',
                borderTop: index === 0 ? 'none' : 'var(--border-width) solid var(--border-subtle)',
                background: 'transparent',
                padding: 'var(--space-md) 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: item.status === 'overdue' ? 'var(--red-dark)' : T.text1 }}>
                  {item.name}
                </span>
                <span style={{ display: 'block', marginTop: 2, fontSize: 'var(--text-xs)', color: T.text3 }}>
                  {commitmentStatus(item)}
                </span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)', flexShrink: 0, color: T.text1 }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatAmount(item.amount, { currency: item.currency, context: 'row' })}
                </span>
              </span>
            </button>
          ))}
          </div>
        </section>
      )}

      {data.activeRecurring.length > 0 && (
        <section style={cardStyle}>
          <p style={titleStyle}>Active recurring</p>
          <div style={{ marginTop: 'var(--space-xs)' }}>
            {data.activeRecurring.map((item, index) => (
              <button
                key={item.key}
                type="button"
                onClick={() => router.push('/income/fixed?returnTo=/commitments')}
                style={{
                  width: '100%',
                  border: 'none',
                  borderTop: index === 0 ? 'none' : 'var(--border-width) solid var(--border-subtle)',
                  background: 'transparent',
                  padding: 'var(--space-md) 0',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: T.text1 }}>{item.label}</span>
                    <span style={{ display: 'block', marginTop: 2, fontSize: 'var(--text-xs)', color: T.text3 }}>
                      {formatAmount(item.remaining, { currency: data.currency, context: 'row' })} left this cycle
                    </span>
                  </span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: T.text1, fontVariantNumeric: 'tabular-nums' }}>
                    {formatAmount(item.amount, { currency: data.currency, context: 'row' })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {data.reminderOnly.length > 0 && (
        <section style={cardStyle}>
          <p style={titleStyle}>Reminder-only</p>
          <div style={{ marginTop: 'var(--space-xs)' }}>
            {data.reminderOnly.map((item, index) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedReminder(item)}
                style={{
                  width: '100%',
                  border: 'none',
                  borderTop: index === 0 ? 'none' : 'var(--border-width) solid var(--border-subtle)',
                  background: 'transparent',
                  padding: 'var(--space-md) 0',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: T.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                  </span>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: T.text1, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {formatAmount(item.amount, { currency: data.currency, context: 'row' })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {data.summary.activeCount === 0 && (
        <section style={cardStyle}>
          <p style={titleStyle}>Nothing to track yet</p>
          <p style={{ margin: '0 0 var(--space-md)', fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5 }}>
            Add recurring expenses or turn on reminders from an expense when you want it tracked each month.
          </p>
          <PrimaryBtn size="lg" onClick={() => router.push('/income/fixed?returnTo=/commitments')}>
            Add recurring expenses
          </PrimaryBtn>
        </section>
      )}

      {data.completedThisCycle.length > 0 && (
        <section style={cardStyle}>
          <p style={titleStyle}>Completed this cycle</p>
          {data.completedThisCycle.map((item) => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: T.text1 }}>{item.label}</span>
              <span style={{ fontSize: 'var(--text-sm)', color: T.text3 }}>Paid</span>
            </div>
          ))}
        </section>
      )}

      {editingReminder && (
        <Sheet open={true} onClose={() => setEditingReminder(null)} title={editingReminder.label}>
          <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
            <Input label="Name" value={label} onChange={setLabel} />
            <MoneyInput label="Monthly amount" value={amount} onChange={setAmount} currency={data.currency} />
            <PrimaryBtn size="lg" onClick={saveReminder} disabled={saving}>
              {saving ? 'Saving...' : 'Save reminder'}
            </PrimaryBtn>
          </div>
        </Sheet>
      )}

      {selectedReminder && (
        <Sheet open={true} onClose={() => setSelectedReminder(null)} title={selectedReminder.label}>
          <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: T.text3 }}>Monthly amount</span>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: T.text1, fontVariantNumeric: 'tabular-nums' }}>
                {formatAmount(selectedReminder.amount, { currency: data.currency, context: 'detail' })}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: T.text3, lineHeight: 1.5 }}>
              This is a reminder-only item. It helps you track something monthly without adding it as a recurring expense.
            </p>
            <PrimaryBtn size="lg" onClick={() => openReminderEditor(selectedReminder)}>
              Edit reminder
            </PrimaryBtn>
            <button
              type="button"
              onClick={async () => {
                await Promise.all(selectedReminder.keys.map((key) => removeMonthlyReminder({ categoryKey: key })))
                toast('Reminder deleted')
                setSelectedReminder(null)
                router.refresh()
              }}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                padding: 'var(--space-sm) 0',
                color: 'var(--red-dark)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                cursor: 'pointer',
              }}
            >
              Delete reminder
            </button>
          </div>
        </Sheet>
      )}
    </AppSubpageLayout>
  )

  if (isDesktop) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <SideNav />
        <main style={{ flex: 1, maxWidth: 720, margin: '0 auto' }}>{content}</main>
        <GlobalAddButton returnTo="/commitments" />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', paddingBottom: 'calc(var(--bottom-nav-height) + var(--space-lg))' }}>
      <main>{content}</main>
      <GlobalAddButton returnTo="/commitments" />
      <BottomNav />
    </div>
  )
}
