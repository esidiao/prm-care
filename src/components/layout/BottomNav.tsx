'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, FlaskConical, FileText, Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { href: '/patients', label: 'Pacientes', icon: Users },
  { href: '/analysis/new', label: 'Análise', icon: FlaskConical, highlight: true },
  { href: '/reports', label: 'Relatórios', icon: FileText },
  { href: '/settings', label: 'Config.', icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 safe-bottom">
      <div className="flex h-16 items-stretch">
        {tabs.map(({ href, label, icon: Icon, highlight }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                active
                  ? highlight
                    ? 'text-white'
                    : 'text-[#1e3a5f] dark:text-blue-400'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300',
              )}
            >
              {/* Highlight button (Nova Análise) gets pill background */}
              {highlight ? (
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                  active ? 'bg-[#1e3a5f]' : 'bg-[#1e3a5f]/10',
                )}>
                  <Icon className={cn('h-5 w-5', active ? 'text-white' : 'text-[#1e3a5f] dark:text-blue-400')} />
                </div>
              ) : (
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                  active ? 'bg-[#1e3a5f]/10 dark:bg-blue-500/20' : '',
                )}>
                  <Icon className="h-5 w-5" />
                </div>
              )}
              <span className={highlight ? '-mt-1' : ''}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
