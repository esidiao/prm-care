'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Pill, LayoutDashboard, Users, FlaskConical, FileText,
  Coins, Settings, BookOpen, BarChart3, LogOut, ChevronRight
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@prisma/client'

interface SidebarProps {
  user: { name?: string | null; email: string; role: UserRole; tokenBalance: number; plan: string }
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  PROFESSIONAL: 'Profissional',
  STUDENT: 'Estudante',
  INSTITUTIONAL_MANAGER: 'Gestor',
}

const navItems = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { href: '/patients', label: 'Pacientes', icon: Users },
  { href: '/analysis/new', label: 'Nova Análise', icon: FlaskConical, highlight: true },
  { href: '/reports', label: 'Relatórios', icon: FileText },
  { href: '/tokens', label: 'Tokens', icon: Coins },
  { href: '/settings', label: 'Configurações', icon: Settings },
]

const adminItems = [
  { href: '/admin', label: 'Painel Admin', icon: BarChart3 },
  { href: '/admin/users', label: 'Usuários', icon: Users },
  { href: '/admin/knowledge', label: 'Base Clínica', icon: BookOpen },
  { href: '/admin/tokens', label: 'Pacotes', icon: Coins },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const isAdmin = user.role === 'ADMIN'

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  const tokenPct = Math.min((user.tokenBalance / 50) * 100, 100)
  const tokenColor =
    user.tokenBalance <= 3 ? 'bg-red-400' :
    user.tokenBalance <= 10 ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <aside className="flex h-full w-60 flex-col bg-[#0f2744] text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
          <Pill className="h-5 w-5 text-white" />
        </div>
        <div>
          <span className="text-base font-bold tracking-tight">PRM Care</span>
          <p className="text-[10px] text-white/40 leading-none mt-0.5">Método Dáder</p>
        </div>
      </div>

      {/* Token balance — oculto para plano institucional */}
      {user.plan !== 'INSTITUTIONAL' && (
        <div className="mx-3 mt-3 mb-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-medium text-white/50 uppercase tracking-wider">Tokens</p>
            <Link href="/tokens" className="text-[10px] text-blue-300 hover:text-blue-200 transition-colors">
              + Comprar
            </Link>
          </div>
          <p className="text-2xl font-bold tabular-nums">{user.tokenBalance}</p>
          <div className="mt-2 h-1 w-full rounded-full bg-white/10 overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', tokenColor)} style={{ width: `${tokenPct}%` }} />
          </div>
        </div>
      )}
      {user.plan === 'INSTITUTIONAL' && (
        <div className="mx-3 mt-3 mb-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
          <p className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1">Acesso</p>
          <p className="text-sm font-semibold text-emerald-400">Institucional — Ilimitado</p>
          <p className="text-[10px] text-white/30 mt-0.5">Todas as funções liberadas</p>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-3 overflow-y-auto">
        {navItems.filter(item => !(item.href === '/tokens' && user.plan === 'INSTITUTIONAL')).map(({ href, label, icon: Icon, highlight }) => {
          const active = isActive(href)
          return (
            <Link key={href} href={href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-white/15 text-white shadow-sm'
                  : highlight
                  ? 'text-blue-300 hover:bg-white/10 hover:text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              )}>
              <Icon className={cn(
                'h-4 w-4 flex-shrink-0 transition-transform duration-150 group-hover:scale-110',
                active ? 'text-white' : highlight ? 'text-blue-300' : 'text-white/50'
              )} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="h-3 w-3 text-white/40" />}
            </Link>
          )
        })}

        {isAdmin && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              Administração
            </p>
            {adminItems.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href)
              return (
                <Link key={href} href={href}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    active ? 'bg-white/15 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'
                  )}>
                  <Icon className={cn(
                    'h-4 w-4 flex-shrink-0 transition-transform duration-150 group-hover:scale-110',
                    active ? 'text-white' : 'text-white/40'
                  )} />
                  {label}
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      {/* User + logout */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-xs font-bold text-white shadow-sm">
            {(user.name || user.email)[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white/90">{user.name || 'Usuário'}</p>
            <p className="truncate text-[11px] text-white/40">{ROLE_LABELS[user.role]}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            title="Sair"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:bg-white/10 hover:text-white/80 transition-colors">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
