import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/topbar'
import { ClinicalDisclaimer } from '@/components/layout/clinical-disclaimer'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar user={session.user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar user={session.user} />
        <main className="flex-1 overflow-y-auto p-6">
          <ClinicalDisclaimer />
          {children}
        </main>
      </div>
    </div>
  )
}
