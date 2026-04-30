export interface GoalContributionItem {
  id: string
  amount: number
  date: string
  note: string | null
  createdAt: string
}

export interface GoalContributionGroup {
  monthKey: string
  monthLabel: string
  items: GoalContributionItem[]
}

function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function groupContributionsByMonth(items: GoalContributionItem[]): GoalContributionGroup[] {
  const buckets = new Map<string, GoalContributionItem[]>()

  for (const item of items) {
    const monthKey = item.date.slice(0, 7)
    const bucket = buckets.get(monthKey)
    if (bucket) bucket.push(item)
    else buckets.set(monthKey, [item])
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([monthKey, bucket]) => ({
      monthKey,
      monthLabel: formatMonthLabel(monthKey),
      items: bucket,
    }))
}

export function totalContributions(items: GoalContributionItem[]): number {
  return items.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0)
}
