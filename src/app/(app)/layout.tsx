import { UserProvider } from '@/lib/context/UserContext'
import { ToastProvider } from '@/lib/context/ToastContext'
import { SessionTimeout } from '@/components/auth/SessionTimeout'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <ToastProvider>
        <SessionTimeout />
        {children}
      </ToastProvider>
    </UserProvider>
  )
}
