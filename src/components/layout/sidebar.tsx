'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Pill, LayoutDashboard, Users, FlaskConical, FileText,
  Coins, Settings, BookOpen, BarChart3, LogOut, ChevronRight,
  Calculator, X, Menu, UserCircle, Globe, TrendingUp,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@prisma/client'

interface SidebarProps {
  user: { name?: string | null; email: string; role: UserRole; tokenBalance: number; plan: string; image?: string | null }
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
  { href: '/analyses', label: 'Histórico', icon: BarChart3 },
  { href: '/knowledge', label: 'Base Clínica', icon: BookOpen },
  { href: '/resources', label: 'Bases de Dados', icon: Globe },
  { href: '/calculators', label: 'Calculadoras', icon: Calculator },
  { href: '/tokens', label: 'Tokens', icon: Coins },
  { href: '/settings', label: 'Configurações', icon: Settings },
]

const adminItems = [
  { href: '/admin', label: 'Painel Admin', icon: BarChart3 },
  { href: '/admin/financeiro', label: 'Financeiro', icon: TrendingUp },
  { href: '/admin/users', label: 'Usuários', icon: Users },
  { href: '/admin/knowledge', label: 'Base Clínica', icon: BookOpen },
  { href: '/admin/tokens', label: 'Pacotes', icon: Coins },
]

// ── Shared nav content ────────────────────────────────────────────────────────

function SidebarContent({
  user,
  onNavClick,
}: {
  user: SidebarProps['user']
  onNavClick?: () => void
}) {
  const pathname = usePathname()
  const isAdmin = user.role === 'ADMIN'
  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)
  const tokenPct = Math.min((user.tokenBalance / 50) * 100, 100)
  const tokenColor =
    user.tokenBalance <= 3 ? 'bg-red-400' :
    user.tokenBalance <= 10 ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-white/20"
             style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))' }}>
          <Pill className="h-5 w-5 text-white drop-shadow" />
        </div>
        <div>
          <span className="text-base font-bold tracking-tight text-white">PRM Care</span>
          <p className="text-[10px] text-white/35 leading-none mt-0.5 font-medium tracking-wider uppercase">Método Dáder</p>
        </div>
      </div>

      {/* Token balance */}
      {user.plan !== 'INSTITUTIONAL' ? (
        <div className="mx-3 mt-3 mb-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-medium text-white/50 uppercase tracking-wider">Tokens</p>
            <Link href="/tokens" onClick={onNavClick} className="text-[10px] text-blue-300 hover:text-blue-200 transition-colors">
              + Comprar
            </Link>
          </div>
          <p className="text-2xl font-bold tabular-nums">{user.tokenBalance}</p>
          <div className="mt-2 h-1 w-full rounded-full bg-white/10 overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', tokenColor)} style={{ width: `${tokenPct}%` }} />
          </div>
        </div>
      ) : (
        <div className="mx-3 mt-3 mb-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
          <p className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-1">Acesso</p>
          <p className="text-sm font-semibold text-emerald-400">Institucional — Ilimitado</p>
          <p className="text-[10px] text-white/30 mt-0.5">Todas as funções liberadas</p>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {navItems
          .filter((item) => !(item.href === '/tokens' && user.plan === 'INSTITUTIONAL'))
          .map(({ href, label, icon: Icon, highlight }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavClick}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-white/[0.12] text-white shadow-sm ring-1 ring-white/10'
                    : highlight
                    ? 'text-sky-300 hover:bg-white/[0.07] hover:text-white'
                    : 'text-white/55 hover:bg-white/[0.07] hover:text-white/90',
                )}
              >
                <span className={cn(
                  'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-150',
                  active
                    ? 'bg-white/15 text-white'
                    : 'text-white/40 group-hover:text-white/80',
                )}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 tracking-[-0.01em]">{label}</span>
                {active && (
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400 flex-shrink-0" />
                )}
              </Link>
            )
          })}

        {isAdmin && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              Administração
            </p>
            {adminItems.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavClick}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    active
                      ? 'bg-white/[0.12] text-white ring-1 ring-white/10'
                      : 'text-white/45 hover:bg-white/[0.07] hover:text-white/80',
                  )}
                >
                  <span className={cn(
                    'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg',
                    active ? 'bg-white/15 text-white' : 'text-white/35 group-hover:text-white/70',
                  )}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {label}
                </Link>
              )
            })}
          </div>
        )}
      </nav>

      {/* User + logout */}
      <div className="border-t border-white/10 p-3 space-y-1">
        <Link
          href="/profile"
          onClick={onNavClick}
          className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/10 transition-colors group"
          title="Meu perfil"
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-xs font-bold text-white shadow-sm overflow-hidden">
            {user.image ? (
              <img src={user.image} alt={user.name ?? 'avatar'} className="h-full w-full object-cover" />
            ) : (
              (user.name || user.email)[0].toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white/90 group-hover:text-white transition-colors">{user.name || 'Usuário'}</p>
            <p className="truncate text-[11px] text-white/40">{ROLE_LABELS[user.role]}</p>
          </div>
          <UserCircle className="h-3.5 w-3.5 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" />
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-white/30 hover:bg-white/10 hover:text-white/70 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    </div>
  )
}

// ── Desktop sidebar (always visible ≥ lg) ────────────────────────────────────

export function Sidebar({ user }: SidebarProps) {
  return (
    <aside
      className="hidden lg:flex h-full w-60 flex-shrink-0 flex-col text-white"
      style={{
        background: 'linear-gradient(180deg, #0f2744 0%, #0d2340 60%, #0b1f39 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <SidebarContent user={user} />
    </aside>
  )
}

// ── Mobile hamburger + drawer ─────────────────────────────────────────────────

export function MobileNav({ user }: SidebarProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close drawer on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Hamburger button (only on mobile) */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        aria-label="Menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-[#0f2744] text-white shadow-2xl transition-transform duration-300 ease-in-out lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Close button */}
        <button
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent user={user} onNavClick={() => setOpen(false)} />
      </div>
    </>
  )
}
