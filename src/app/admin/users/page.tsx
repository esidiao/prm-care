'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, Search, Filter, MoreVertical, Shield, GraduationCap,
  Building2, UserCheck, UserX, Coins, RefreshCw, ChevronLeft,
  ChevronRight, Crown, Loader2, AlertTriangle, Check, X
} from 'lucide-react'

interface User {
  id: string
  name: string
  email: string
  role: string
  plan: string
  tokenBalance: number
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
  crfNumber: string | null
  institution: string | null
  _count: { patients: number; analyses: number }
}

const roleLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  ADMIN: { label: 'Admin', icon: Shield, color: 'text-red-600 bg-red-50' },
  PROFESSIONAL: { label: 'Profissional', icon: UserCheck, color: 'text-blue-600 bg-blue-50' },
  STUDENT: { label: 'Estudante', icon: GraduationCap, color: 'text-purple-600 bg-purple-50' },
  INSTITUTIONAL: { label: 'Institucional', icon: Building2, color: 'text-teal-600 bg-teal-50' },
}

const planLabels: Record<string, { label: string; color: string }> = {
  FREE: { label: 'Gratuito', color: 'text-muted-foreground bg-muted' },
  BASIC: { label: 'Básico', color: 'text-blue-600 bg-blue-100' },
  PROFESSIONAL: { label: 'Profissional', color: 'text-purple-600 bg-purple-100' },
  ENTERPRISE: { label: 'Enterprise', color: 'text-amber-600 bg-amber-100' },
}

interface ActionModal {
  userId: string
  userName: string
  action: 'change_plan' | 'change_role' | 'add_tokens'
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [modal, setModal] = useState<ActionModal | null>(null)
  const [modalValue, setModalValue] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
        ...(planFilter && { plan: planFilter }),
      })
      const res = await fetch(`/api/admin/users?${params}`)
      const json = await res.json()
      if (json.success) {
        setUsers(json.data)
        setTotalPages(json.pages)
        setTotal(json.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter, planFilter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleAction = async (userId: string, action: string, value?: any) => {
    setActionLoading(userId)
    setFeedback(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, value }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro')
      setFeedback({ type: 'success', message: 'Ação realizada com sucesso.' })
      fetchUsers()
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message })
    } finally {
      setActionLoading(null)
      setModal(null)
      setOpenMenuId(null)
    }
  }

  const handleModalConfirm = () => {
    if (!modal || !modalValue) return
    const value = modal.action === 'add_tokens' ? parseInt(modalValue) : modalValue
    handleAction(modal.userId, modal.action, value)
  }

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Gestão de Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} usuário{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={fetchUsers}
          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {feedback.message}
          <button onClick={() => setFeedback(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nome ou e-mail..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-card"
        >
          <option value="">Todos os perfis</option>
          {Object.entries(roleLabels).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
        <select
          value={planFilter}
          onChange={e => { setPlanFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-card"
        >
          <option value="">Todos os planos</option>
          {Object.entries(planLabels).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Usuário</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Perfil</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plano</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Tokens</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Pacientes</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Análises</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Último acesso</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map(user => {
                  const role = roleLabels[user.role] || roleLabels.PROFESSIONAL
                  const plan = planLabels[user.plan] || planLabels.FREE
                  const RoleIcon = role.icon
                  const isLoading = actionLoading === user.id

                  return (
                    <tr key={user.id} className={`hover:bg-muted transition-colors ${!user.isActive ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                          {user.crfNumber && <p className="text-xs text-muted-foreground">CRF: {user.crfNumber}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${role.color}`}>
                          <RoleIcon className="w-3 h-3" />
                          {role.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${plan.color}`}>
                          {user.plan === 'ENTERPRISE' || user.plan === 'PROFESSIONAL' ? <Crown className="w-3 h-3" /> : null}
                          {plan.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-amber-700">{user.tokenBalance}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{user._count.patients}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{user._count.analyses}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(user.lastLoginAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleAction(user.id, 'toggle_active')}
                          disabled={isLoading}
                          title={user.isActive ? 'Desativar' : 'Ativar'}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                            user.isActive
                              ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700'
                              : 'bg-red-100 text-red-700 hover:bg-green-100 hover:text-green-700'
                          }`}
                        >
                          {isLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : user.isActive ? (
                            <><UserCheck className="w-3 h-3" /> Ativo</>
                          ) : (
                            <><UserX className="w-3 h-3" /> Inativo</>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                          className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openMenuId === user.id && (
                          <div className="absolute right-4 top-10 z-10 bg-card border border-border rounded-lg shadow-lg w-44 py-1">
                            <button
                              onClick={() => { setModal({ userId: user.id, userName: user.name, action: 'change_plan' }); setModalValue(user.plan) }}
                              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2"
                            >
                              <Crown className="w-4 h-4 text-amber-500" />
                              Alterar plano
                            </button>
                            <button
                              onClick={() => { setModal({ userId: user.id, userName: user.name, action: 'change_role' }); setModalValue(user.role) }}
                              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2"
                            >
                              <Shield className="w-4 h-4 text-blue-500" />
                              Alterar perfil
                            </button>
                            <button
                              onClick={() => { setModal({ userId: user.id, userName: user.name, action: 'add_tokens' }); setModalValue('') }}
                              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2"
                            >
                              <Coins className="w-4 h-4 text-amber-500" />
                              Adicionar tokens
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 text-muted-foreground disabled:opacity-30 hover:bg-muted rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 text-muted-foreground disabled:opacity-30 hover:bg-muted rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-foreground mb-1">
              {modal.action === 'change_plan' && 'Alterar plano'}
              {modal.action === 'change_role' && 'Alterar perfil'}
              {modal.action === 'add_tokens' && 'Adicionar tokens'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{modal.userName}</p>

            {modal.action === 'change_plan' && (
              <select
                value={modalValue}
                onChange={e => setModalValue(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(planLabels).map(([v, { label }]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            )}

            {modal.action === 'change_role' && (
              <select
                value={modalValue}
                onChange={e => setModalValue(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(roleLabels).map(([v, { label }]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            )}

            {modal.action === 'add_tokens' && (
              <div>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={modalValue}
                  onChange={e => setModalValue(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Quantidade de tokens (ex: 50)"
                />
                <p className="text-xs text-muted-foreground mt-1">Os tokens serão creditados como bônus administrativo.</p>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setModal(null); setOpenMenuId(null) }}
                className="flex-1 px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleModalConfirm}
                disabled={!modalValue || !!actionLoading}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close menu on outside click */}
      {openMenuId && (
        <div className="fixed inset-0 z-[9]" onClick={() => setOpenMenuId(null)} />
      )}
    </div>
  )
}
