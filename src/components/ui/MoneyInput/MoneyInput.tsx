'use client'

import { Input } from '@/components/ui/Input/Input'

interface Props extends Omit<React.ComponentProps<typeof Input>, 'type' | 'prefix'> {
  currency: string
}

export function MoneyInput({ currency, placeholder = 'e.g. 5,000', ...props }: Props) {
  return (
    <Input
      {...props}
      type="number"
      prefix={currency}
      placeholder={placeholder}
    />
  )
}
