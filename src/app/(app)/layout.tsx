import { SideNav } from '@/components/layout/SideNav/SideNav'
import { BottomNav } from '@/components/layout/BottomNav/BottomNav'
import { PageContainer } from '@/components/layout/PageContainer/PageContainer'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SideNav />

      <main>
        <PageContainer>
          {children}
        </PageContainer>
      </main>

      <BottomNav />
    </>
  )
}
