'use client'
import styles from './Input.module.css'

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string
  prefix?: string
  hint?: string
  error?: string
  value?: string
  onChange?: (val: string) => void
}

function addCommas(raw: string): string {
  if (!raw) return raw
  const parts = raw.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.join('.')
}

export function Input({ label, prefix, hint, error, onChange, className, id, type, value, ...props }: Props) {
  const inputId = id ?? label.replace(/\s+/g, '-').toLowerCase()
  const isNumeric = type === 'number'

  const displayValue = isNumeric ? addCommas(value ?? '') : (value ?? '')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onChange) return
    if (isNumeric) {
      const raw = e.target.value.replace(/,/g, '')
      if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return
      onChange(raw)
    } else {
      onChange(e.target.value)
    }
  }

  return (
    <div className={styles.inputWrap}>
      <label className={styles.inputLabel} htmlFor={inputId}>
        {label}
      </label>

      <div className={styles.inputField}>
        {prefix && <span className={styles.inputPrefix}>{prefix}</span>}

        <input
          id={inputId}
          className={`${styles.input} ${className ?? ''}`}
          type={isNumeric ? 'text' : type}
          inputMode={isNumeric ? 'decimal' : undefined}
          pattern={isNumeric ? '[0-9]*' : undefined}
          enterKeyHint={isNumeric ? 'done' : undefined}
          autoComplete="off"
          value={displayValue}
          onChange={handleChange}
          {...props}
        />
      </div>

      {error && <p className={styles.inputError}>{error}</p>}
      {!error && hint && <p className={styles.inputHint}>{hint}</p>}
    </div>
  )
}
