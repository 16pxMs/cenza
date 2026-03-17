import styles from './PageContainer.module.css'

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function PageContainer({ children, className, ...props }: Props) {
  return (
    <div className={`${styles.container} ${className ?? ''}`} {...props}>
      {children}
    </div>
  )
}
