'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Activity, Search, Filter, ChevronLeft, ChevronRight,
  RefreshCw, User, Shield, FlaskConical, FileText,
  Coins, BookOpen, Trash2, Settings, Download
} from 'lucide-react'
import { IntegridadeAuditoria } from '@/components/admin/IntegridadeAuditoria'

interface AuditLog {
  id: string
  action: string
  resource: string
  resourceId: string | null
  details: any
  ipAddress: string | null
  createdAt: string
  user: { name: string | null; email: string; role: string }
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN: 'bg-purple-100 text-purple-700',
  LOGOUT: 'bg-muted text-muted-foreground',
  PURCHASE: 'bg-amber-100 text-amber-700',
  ADMIN: 'bg-orange-100 text-orange-700',
  DEFAULT: 'bg-muted text-muted-foreground',
}

const RESOURCE_ICONS: Record<string, React.ElementType> = {
  user: User,
  patient: User,
  analysis: FlaskConical,
  report: FileText,
  token_package: Coins,
  medication: Coins,
  knowledge: BookOpen,
  auth: Shield,
}

function getActionColor(action: string): string {
  const key = Object.keys(ACTION_COLORS).find(k => action.toUpperCase().includes(k))
  return key ? ACTION_COLORS[key] : ACTION_COLORS.DEFAULT
}

function getResourceIcon(resource: string): React.ElementType {
  return RESOURCE_ICONS[resource] || Activity
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [resourceFilter, setResourceFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        ...(search && { search }),
        ...(actionFilter && { action: actionFilter }),
        ...(resourceFilter && { resource: resourceFilter }),
      })
      const res = await fetch(`/api/admin/logs?${params}`)
      const json = await res.json()
      if (json.success) {
        setLogs(json.data)
        setTotalPages(json.pages)
        setTotal(json.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, search, actionFilter, resourceFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const formatDate = (d: string) => {
    const date = new Date(d)
    return date.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  }

  const exportCSV = () => {
    const headers = ['Data', 'Usuário', 'Email', 'Ação', 'Recurso', 'ID Recurso', 'IP']
    const rows = logs.map(log => [
      formatDate(log.createdAt),
      log.user.name || '',
      log.user.email,
      log.action,
      log.resource,
      log.resourceId || '',
      log.ipAddress || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Logs de Auditoria
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total.toLocaleString('pt-BR')} registro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Integridade da cadeia — lacuna 09 */}
      <IntegridadeAuditoria />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por ação, recurso ou usuário..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border border-border rounded-lg focus:ring-2 focus:ring-blue-500 bg-card"
        >
          <option value="">Todas as ações</option>
          <option value="CREATE">Criação</option>
          <option value="UPDATE">Atualização</option>
          <option value="DELETE">Exclusão</option>
          <option value="LOGIN">Login</option>
          <option value="PURCHASE">Compra</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select
          value={resourceFilter}
          onChange={e => { setResourceFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border border-border rounded-lg focus:ring-2 focus:ring-blue-500 bg-card"
        >
          <option value="">Todos os recursos</option>
          <option value="user">Usuário</option>
          <option value="patient">Paciente</option>
          <option value="analysis">Análise</option>
          <option value="report">Relatório</option>
          <option value="medication">Medicamento</option>
          <option value="token_package">Pacote de tokens</option>
          <option value="knowledge">Base de conhecimento</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum log encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Data/Hora</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Usuário</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ação</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Recurso</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Detalhes</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map(log => {
                  const ResourceIcon = getResourceIcon(log.resource)
                  return (
                    <tr key={log.id} className="hover:bg-muted transition-colors">
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap font-mono">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground text-xs">{log.user.name || '—'}</p>
                          <p className="text-muted-foreground text-xs">{log.user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <ResourceIcon className="w-3.5 h-3.5" />
                          {log.resource}
                          {log.resourceId && (
                            <span className="text-muted-foreground font-mono">{log.resourceId.slice(0, 8)}…</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                        {log.details ? (
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs break-all">
                            {JSON.stringify(log.details).slice(0, 80)}
                            {JSON.stringify(log.details).length > 80 ? '…' : ''}
                          </code>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                        {log.ipAddress || '—'}
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
            <p className="text-xs text-muted-foreground">Página {page} de {totalPages} · {total.toLocaleString('pt-BR')} registros</p>
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
    </div>
  )
}
