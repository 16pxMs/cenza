export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAppSession } from '@/lib/auth/app-session'
import { getDebts } from '@/lib/supabase/debt-db'
import CreateDebtClient from './CreateDebtClient'

interface NewDebtPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function cleanPrefillText(value: string | string[] | undefined) {
  return (firstValue(value) ?? '').trim().slice(0, 80)
}

function cleanPrefillAmount(value: string | string[] | undefined) {
  const cleaned = (firstValue(value) ?? '').replace(/,/g, '').replace(/[^0-9.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length > 2) return ''
  if (parts[1] && parts[1].length > 2) return `${parts[0]}.${parts[1].slice(0, 2)}`
  return cleaned
}

export default async function NewDebtPage({ searchParams }: NewDebtPageProps) {
  const { user, profile } = await getAppSession()

  if (!user || !profile) {
    redirect('/')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const returnTo = firstValue(resolvedSearchParams.returnTo) ?? '/app'
  const initialName = cleanPrefillText(resolvedSearchParams.name)
  const initialAmount = cleanPrefillAmount(resolvedSearchParams.amount)
  const debts = await getDebts(user.id)
  const activeDebtNames = debts
    .filter((debt) => debt.status === 'active')
    .map((debt) => debt.normalized_name)
    .filter(Boolean)

  return (
    <CreateDebtClient
      currency={profile.currency}
      returnTo={returnTo}
      activeDebtNames={activeDebtNames}
      initialName={initialName}
      initialAmount={initialAmount}
    />
  )
}
