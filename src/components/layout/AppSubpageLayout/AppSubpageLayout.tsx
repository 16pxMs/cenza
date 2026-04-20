import styles from './AppSubpageLayout.module.css'

type AppSubpageLayoutProps = React.HTMLAttributes<HTMLDivElement> & {
  maxWidth?: number | string
}

/**
 * Layout wrapper for Level 1 More/Menu child pages.
 *
 * Navigation depth rule:
 * - Level 1 More child pages use AppSubpageHeader with backHref="/menu".
 * - Level 2+ pages should use contextual back links to their parent route.
 */
export function AppSubpageLayout({
  children,
  className,
  maxWidth,
  style,
  ...props
}: AppSubpageLayoutProps) {
  return (
    <div
      className={`${styles.layout} ${className ?? ''}`}
      style={style}
      {...props}
    >
      <div
        className={styles.inner}
        style={{ maxWidth: maxWidth ?? 720 }}
      >
        {children}
      </div>
    </div>
  )
}
