'use client'
import styles from './Input.module.css'

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string
  prefix?: string
  hint?: string
  error?: string
  onChange?: (val: string) => void
}

export function Input({ label, prefix, hint, error, onChange, className, id, ...props }: Props) {
  const inputId = id ?? label.replace(/\s+/g, '-').toLowerCase()

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
          onChange={onChange ? e => onChange(e.target.value) : undefined}
          {...props}
        />
      </div>

      {error && <p className={styles.inputError}>{error}</p>}
      {!error && hint && <p className={styles.inputHint}>{hint}</p>}
    </div>
  )
}
