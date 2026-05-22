'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, ChevronRight } from 'lucide-react'
import type { UserRole } from '@prisma/client'
import { GlobalSearch } from './GlobalSearch'
import { ThemeToggle } from './ThemeToggle'
import { MobileNav } from './sidebar'
import { AlertBadge } from './AlertBadge'

interface TopBarProps {
  user: { name?: string | null; email: string; tokenBalance: number; role: UserRole; plan: string; image?: string | null }
}

const breadcrumbs: Record<string, string> = {
  '/dashboard': 'Painel',
  '/patients': 'Pacientes',
  '/analysis/new': 'Nova Análise',
  '/reports': 'Relatórios',
  '/tokens': 'Tokens',
  '/settings': 'Configurações',
  '/admin': 'Admin',
  '/admin/users': 'Usuários',
  '/admin/knowledge': 'Base Clínica',
  '/admin/tokens': 'Pacotes',
  '/admin/logs': 'Logs de Auditoria',
  '/profile': 'Meu Perfil',
  '/knowledge': 'Base Clínica',
  '/resources': 'Bases de Dados',
  '/analyses': 'Histórico de Análises',
  '/settings/my-data': 'Meus Dados (LGPD)',
}

function getBreadcrumb(pathname: string): { label: string; parent?: string } {
  if (breadcrumbs[pathname]) return { label: breadcrumbs[pathname] }
  if (pathname.startsWith('/patients/') && pathname.includes('/medications')) return { label: 'Medicamentos', parent: 'Pacientes' }
  if (pathname.startsWith('/patients/') && pathname.includes('/scales')) return { label: 'Escalas', parent: 'Pacientes' }
  if (pathname.startsWith('/patients/')) return { label: 'Paciente', parent: 'Pacientes' }
  if (pathname.startsWith('/analysis/')) return { label: 'Análise PRM', parent: 'Nova Análise' }
  if (pathname.startsWith('/reports/')) return { label: 'Relatório', parent: 'Relatórios' }
  return { label: 'PRM Care' }
}

export function TopBar({ user }: TopBarProps) {
  const pathname = usePathname()
  const { label, parent } = getBreadcrumb(pathname)

  return (
    <header className="flex h-14 items-center gap-2 sm:gap-4 border-b border-gray-200 bg-white px-3 sm:px-6 dark:border-gray-700 dark:bg-gray-900 shrink-0">
      {/* Mobile hamburger */}
      <MobileNav user={user} />

      {/* Breadcrumb — hidden on xs, visible sm+ */}
      <div className="hidden sm:flex items-center gap-2 text-sm shrink-0">
        {parent ? (
          <>
            <span className="text-gray-400 dark:text-gray-500 hidden md:inline">{parent}</span>
            <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 hidden md:inline" />
            <span className="font-semibold text-gray-800 dark:text-gray-100">{label}</span>
          </>
        ) : (
          <span className="font-semibold text-gray-800 dark:text-gray-100">{label}</span>
        )}
      </div>

      {/* Mobile title (xs only) */}
      <span className="sm:hidden font-semibold text-gray-800 dark:text-gray-100 text-sm truncate flex-1">
        {label}
      </span>

      {/* Global search — centered, hidden on xs */}
      <div className="hidden sm:flex flex-1 justify-center">
        <GlobalSearch />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Low token warning — compact on mobile */}
        {user.tokenBalance <= 3 && user.plan !== 'INSTITUTIONAL' && (
          <Link
            href="/tokens"
            className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 sm:px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="hidden sm:inline">{user.tokenBalance} token(s) restante(s)</span>
            <span className="sm:hidden">{user.tokenBalance}</span>
          </Link>
        )}

        {/* Nova análise — icon-only on mobile */}
        <Link
          href="/analysis/new"
          className="flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-2.5 sm:px-3.5 py-2 text-sm font-medium text-white hover:bg-[#162d4a] transition-colors shadow-sm"
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Nova análise</span>
        </Link>

        {/* Search icon on mobile */}
        <div className="sm:hidden">
          <GlobalSearch mobileIconOnly />
        </div>

        <ThemeToggle />
        <AlertBadge />
      </div>
    </header>
  )
}
