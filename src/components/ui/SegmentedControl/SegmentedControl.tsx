'use client'

interface SegmentedControlOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  ariaLabel: string
  value: T
  options: Array<SegmentedControlOption<T>>
  onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        padding: 3,
        borderRadius: 10,
        background: 'var(--grey-100)',
        width: '100%',
      }}
    >
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            style={{
              flex: 1,
              height: 34,
              borderRadius: 8,
              border: 'none',
              background: active ? 'var(--white)' : 'transparent',
              color: active ? 'var(--text-1)' : 'var(--text-2)',
              fontSize: 'var(--text-sm)',
              fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-medium)',
              cursor: 'pointer',
              boxShadow: active ? '0 1px 2px rgba(16, 24, 40, 0.08)' : 'none',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
