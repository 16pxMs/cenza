export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

type RawSearchParams = Record<string, string | string[] | undefined>

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const sp = (await searchParams) ?? {}
  const returnTo = firstValue(sp.returnTo) || '/log'
  redirect(`/log/import?returnTo=${encodeURIComponent(returnTo)}`)
}
