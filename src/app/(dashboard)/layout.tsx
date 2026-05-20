import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/topbar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ClinicalDisclaimer } from '@/components/layout/clinical-disclaimer'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <Sidebar user={session.user} />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar user={session.user} />
        {/* pb-16 on mobile for bottom nav clearance */}
        <main className="flex-1 overflow-y-auto p-3 pb-20 sm:p-4 sm:pb-4 lg:p-6">
          <ClinicalDisclaimer />
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  )
}
