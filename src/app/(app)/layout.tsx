import { redirect } from 'next/navigation'
import { UserProvider } from '@/lib/context/UserContext'
import { ToastProvider } from '@/lib/context/ToastContext'
import { SessionTimeout } from '@/components/auth/SessionTimeout'
import { getAppSession } from '@/lib/auth/app-session'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getAppSession()

  if (!user) {
    redirect('/')
  }

  if (
    !profile ||
    !profile.onboarding_complete ||
    !profile.name?.trim() ||
    !profile.currency?.trim()
  ) {
    redirect('/onboarding')
  }

  return (
    <UserProvider initialUser={user} initialProfile={profile}>
      <ToastProvider>
        <SessionTimeout />
        {children}
      </ToastProvider>
    </UserProvider>
  )
}
