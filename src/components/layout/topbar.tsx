'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Plus, ChevronRight } from 'lucide-react'
import type { UserRole } from '@prisma/client'
import { GlobalSearch } from './GlobalSearch'

interface TopBarProps {
  user: { name?: string | null; tokenBalance: number; role: UserRole; plan: string }
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
}

function getBreadcrumb(pathname: string): { label: string; parent?: string } {
  if (breadcrumbs[pathname]) return { label: breadcrumbs[pathname] }
  if (pathname.startsWith('/patients/') && pathname.includes('/medications')) return { label: 'Medicamentos', parent: 'Pacientes' }
  if (pathname.startsWith('/patients/')) return { label: 'Detalhes do Paciente', parent: 'Pacientes' }
  if (pathname.startsWith('/analysis/')) return { label: 'Resultado da Análise', parent: 'Nova Análise' }
  if (pathname.startsWith('/reports/new')) return { label: 'Gerar Relatório', parent: 'Relatórios' }
  return { label: 'PRM Care' }
}

export function TopBar({ user }: TopBarProps) {
  const pathname = usePathname()
  const { label, parent } = getBreadcrumb(pathname)

  return (
    <header className="flex h-14 items-center gap-4 border-b border-gray-200 bg-white px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm min-w-0 shrink-0">
        {parent ? (
          <>
            <span className="text-gray-400">{parent}</span>
            <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
            <span className="font-semibold text-gray-800">{label}</span>
          </>
        ) : (
          <span className="font-semibold text-gray-800">{label}</span>
        )}
      </div>

      {/* Global search — center */}
      <div className="flex-1 flex justify-center">
        <GlobalSearch />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {user.tokenBalance <= 3 && user.plan !== 'INSTITUTIONAL' && (
          <Link href="/tokens"
            className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            {user.tokenBalance} token(s) restante(s)
          </Link>
        )}

        <Link href="/analysis/new"
          className="flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#162d4a] transition-colors shadow-sm">
          <Plus className="h-3.5 w-3.5" />
          Nova análise
        </Link>

        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
          <Bell className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
