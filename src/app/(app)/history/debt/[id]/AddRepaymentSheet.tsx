'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sheet } from '@/components/layout/Sheet/Sheet'
import { PrimaryBtn, SecondaryBtn, TertiaryBtn } from '@/components/ui/Button/Button'
import { MoneyInput } from '@/components/ui/MoneyInput/MoneyInput'
import { SingleSelectChip } from '@/components/ui/SingleSelectChip/SingleSelectChip'
import { formatDate } from '@/lib/finance'
import { parsePaymentImportText } from '@/lib/sms-import/parser'
import { addRepayment } from './actions'
import styles from './AddRepaymentSheet.module.css'

interface Props {
  debtId: string
  debtName: string
  direction: 'owed_by_me' | 'owed_to_me'
  currency: string
  currentBalance: number
  emphasized?: boolean
  initialOpen?: boolean
}

function paymentDirectionLabel(direction: Props['direction']) {
  return direction === 'owed_by_me' ? 'You owe' : 'Owes you'
}

type PaymentEntryMode = 'manual' | 'import'

export function AddRepaymentSheet({
  debtId,
  debtName,
  direction,
  currency,
  currentBalance,
  emphasized = false,
  initialOpen = false,
}: Props) {
  const router = useRouter()
  const importTextRef = useRef<HTMLTextAreaElement>(null)
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(initialOpen)
  const [mode, setMode] = useState<PaymentEntryMode>('manual')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [importText, setImportText] = useState('')
  const [detectedDate, setDetectedDate] = useState<string | null>(null)
  const [importFeedback, setImportFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setMode('manual')
    setAmount('')
    setNote('')
    setImportText('')
    setDetectedDate(null)
    setImportFeedback(null)
    setError(null)
  }, [open])

  useEffect(() => {
    if (mode !== 'import') return
    const timeout = window.setTimeout(() => importTextRef.current?.focus(), 60)
    return () => window.clearTimeout(timeout)
  }, [mode])

  useEffect(() => {
    if (!importFeedback) return
    const timeout = window.setTimeout(() => setImportFeedback(null), 3200)
    return () => window.clearTimeout(timeout)
  }, [importFeedback])

  const amountValue = Number(amount)
  const showPayFull = currentBalance > 0 && amountValue !== currentBalance

  const validate = (): string | null => {
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return 'Amount must be greater than zero'
    }
    if (amountValue > currentBalance) {
      return 'Repayment cannot be more than the current balance'
    }
    return null
  }

  const handleImportText = (rawText = importText) => {
    const parsed = parsePaymentImportText(rawText, { defaultCurrency: currency })

    if (!parsed) {
      setImportFeedback('We couldn’t read the payment details. You can enter them manually.')
      return
    }

    if (parsed.amount != null) {
      setAmount(String(parsed.amount))
    }
    if (parsed.note) {
      setNote(parsed.note)
    }
    setDetectedDate(parsed.date ?? null)
    setMode('manual')
    setImportFeedback('Payment details filled.')
    setError(null)
  }

  const handleSubmit = () => {
    const nextError = validate()
    if (nextError) {
      setError(nextError)
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        await addRepayment({
          debtId,
          amount: amountValue,
          date: detectedDate ?? undefined,
          note,
        })
        setOpen(false)
        router.refresh()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Failed to add repayment')
      }
    })
  }

  return (
    <>
      {emphasized ? (
        <PrimaryBtn
          size="sm"
          onClick={() => setOpen(true)}
          className={styles.triggerButton}
        >
          Record payment
        </PrimaryBtn>
      ) : (
        <SecondaryBtn
          size="sm"
          onClick={() => setOpen(true)}
          className={styles.triggerButton}
        >
          Record payment
        </SecondaryBtn>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Record payment">
        <div className={styles.sheetRoot}>
          <div className={styles.headerBlock}>
            <p className={styles.title}>{debtName}</p>
            <div className={styles.metaRow}>
              <p className={styles.direction}>{paymentDirectionLabel(direction)}</p>
              <span className={styles.metaDot} aria-hidden="true">·</span>
              <p className={styles.balance}>
              {new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency,
                maximumFractionDigits: 2,
              }).format(currentBalance)}
              </p>
            </div>
          </div>

          <div className={styles.tabRow}>
            <SingleSelectChip
              label="Manual"
              selected={mode === 'manual'}
              fill
              onClick={() => setMode('manual')}
            />
            <SingleSelectChip
              label="Import"
              selected={mode === 'import'}
              fill
              onClick={() => setMode('import')}
            />
          </div>

          {mode === 'manual' ? (
            <div className={styles.primaryGroup}>
              <MoneyInput
                label="Amount"
                currency={currency}
                value={amount}
                onChange={setAmount}
                autoFocus
                placeholder="0"
                labelAction={
                  showPayFull ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAmount(String(currentBalance))
                        setError(null)
                      }}
                      className={styles.payFullAction}
                    >
                      Pay full
                    </button>
                  ) : null
                }
              />

              <div className={styles.secondaryGroup}>
                <label className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>Note</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Add a note (optional)"
                    rows={3}
                    className={styles.noteArea}
                  />
                </label>

                {importFeedback ? (
                  <p className={styles.feedback}>{importFeedback}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className={styles.importTab}>
              <textarea
                ref={importTextRef}
                value={importText}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setImportText(nextValue)
                  if (importFeedback) setImportFeedback(null)
                }}
                onPaste={(event) => {
                  const pastedText = event.clipboardData.getData('text')
                  const nextValue = importText
                    ? `${importText}${pastedText}`
                    : pastedText
                  window.setTimeout(() => {
                    setImportText(nextValue)
                    handleImportText(nextValue)
                  }, 0)
                }}
                placeholder="Paste SMS or bank receipt text"
                rows={4}
                className={styles.importArea}
              />

              <div className={styles.importActionRow}>
                <TertiaryBtn
                  size="sm"
                  onClick={() => handleImportText()}
                  disabled={!importText.trim() || isPending}
                  className={styles.readButton}
                >
                  Read payment details
                </TertiaryBtn>
              </div>

              {importFeedback ? (
                <p className={styles.feedback}>{importFeedback}</p>
              ) : null}
            </div>
          )}

          {error ? (
            <p className={styles.error}>{error}</p>
          ) : null}

          <div className={styles.actions}>
            <PrimaryBtn size="lg" onClick={handleSubmit} disabled={isPending} className={styles.actionButton}>
              {isPending ? 'Saving…' : 'Save'}
            </PrimaryBtn>
            <SecondaryBtn size="lg" onClick={() => setOpen(false)} disabled={isPending} className={styles.actionButton}>
              Cancel
            </SecondaryBtn>
          </div>
        </div>
      </Sheet>
    </>
  )
}
