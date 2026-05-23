'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  DollarSign, Coins, TrendingUp, Clock, CheckCircle2,
  AlertTriangle, ArrowUpRight, ChevronLeft, ChevronRight,
  Package, RefreshCw, BarChart2,
} from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/utils'

interface Summary {
  totalRevenueCents: number
  revenueThisMonthCents: number
  revenueThisWeekCents: number
  totalPayments: number
  paymentsThisMonth: number
  pendingPayments: number
  tokensSold: number
  tokensConsumed: number
  tokensThisMonth: number
}

interface PaymentRow {
  id: string
  amountInCents: number
  status: string
  method: string | null
  gateway: string | null
  externalId: string | null
  paidAt: string | null
  createdAt: string
  user: { id: string; name: string | null; email: string } | null
}

interface TopPackage {
  packageId: string | null
  _count: { id: number }
  _sum: { amount: number | null }
  package: { id: string; name: string; tokens: number; priceInCents: number } | null
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'Aprovado',
  pending: 'Pendente',
  failed: 'Falhou',
  refunded: 'Estornado',
}

const STATUS_COLOR: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-600',
}

const METHOD_LABEL: Record<string, string> = {
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  pix: 'Pix',
  boleto: 'Boleto',
  account_money: 'Saldo MP',
}

function StatCard({
  icon: Icon, label, value, sub, color = 'blue',
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color?: 'blue' | 'green' | 'amber' | 'purple'
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{label}</p>
        <div className={`rounded-lg p-2 ${colors[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// Mini sparkline usando apenas divs (sem biblioteca de gráfico)
function Sparkline({ data }: { data: Record<string, number> }) {
  const days = Object.keys(data).sort()
  const values = days.map(d => data[d])
  const max = Math.max(...values, 1)

  return (
    <div className="flex items-end gap-0.5 h-16">
      {days.map((day, i) => (
        <div
          key={day}
          className="flex-1 bg-[#1e3a5f]/70 rounded-sm min-w-0 transition-all hover:bg-[#1e3a5f]"
          style={{ height: `${Math.max(4, (values[i] / max) * 100)}%` }}
          title={`${day}: ${formatCurrency(values[i])}`}
        />
      ))}
    </div>
  )
}

export default function FinanceiroDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [topPackages, setTopPackages] = useState<TopPackage[]>([])
  const [dailyRevenue, setDailyRevenue] = useState<Record<string, number>>({})
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/financeiro?page=${p}`)
      const data = await res.json()
      setSummary(data.summary)
      setPayments(data.recentPayments)
      setTopPackages(data.topPackages)
      setDailyRevenue(data.dailyRevenue)
      setPage(data.currentPage)
      setTotalPages(data.totalPages)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(1) }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Financeiro</h1>
          <p className="text-gray-500 text-sm">Receitas, tokens e pagamentos</p>
        </div>
        <button
          onClick={() => load(page)}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Cards de resumo */}
      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={DollarSign}
            label="Receita total"
            value={formatCurrency(summary.totalRevenueCents)}
            sub={`${summary.totalPayments} pagamentos aprovados`}
            color="green"
          />
          <StatCard
            icon={TrendingUp}
            label="Receita (30 dias)"
            value={formatCurrency(summary.revenueThisMonthCents)}
            sub={`${summary.paymentsThisMonth} vendas no período`}
            color="blue"
          />
          <StatCard
            icon={Coins}
            label="Tokens vendidos"
            value={summary.tokensSold.toLocaleString('pt-BR')}
            sub={`${summary.tokensThisMonth.toLocaleString('pt-BR')} nos últimos 30 dias`}
            color="purple"
          />
          <StatCard
            icon={Clock}
            label="Pagamentos pendentes"
            value={String(summary.pendingPayments)}
            sub={`${summary.tokensConsumed.toLocaleString('pt-BR')} tokens consumidos no total`}
            color="amber"
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 rounded-xl border bg-white animate-pulse" />
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">

        {/* Receita diária — sparkline */}
        <div className="lg:col-span-2 rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Receita diária (últimos 30 dias)</h2>
              <p className="text-xs text-gray-400">Passe o mouse sobre as barras para ver o valor</p>
            </div>
            <BarChart2 className="h-5 w-5 text-gray-300" />
          </div>
          {Object.keys(dailyRevenue).length > 0 ? (
            <Sparkline data={dailyRevenue} />
          ) : (
            <div className="h-16 flex items-center justify-center text-sm text-gray-400">
              Sem dados de receita no período
            </div>
          )}
        </div>

        {/* Top pacotes */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Pacotes mais vendidos</h2>
          </div>
          {topPackages.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sem vendas ainda</p>
          ) : (
            <div className="space-y-3">
              {topPackages.map((tp, i) => (
                <div key={tp.packageId ?? i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {tp.package?.name ?? 'Pacote removido'}
                      </p>
                      <p className="text-xs text-gray-400">{tp.package?.tokens ?? '?'} tokens</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-[#1e3a5f]">{tp._count.id}x</p>
                    <p className="text-xs text-gray-400">{(tp._sum.amount ?? 0).toLocaleString('pt-BR')} tkn</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabela de pagamentos */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold text-gray-900">Histórico de pagamentos</h2>
          <span className="text-xs text-gray-400">Página {page} de {totalPages}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Data</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Usuário</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Valor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Forma</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">ID externo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && payments.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[1, 2, 3, 4, 5, 6].map(j => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Nenhum pagamento encontrado
                  </td>
                </tr>
              ) : (
                payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDateTime(p.paidAt ?? p.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {p.user ? (
                        <div>
                          <p className="font-medium text-gray-900">{p.user.name ?? '—'}</p>
                          <p className="text-xs text-gray-400">{p.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                      {formatCurrency(p.amountInCents)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.method ? (METHOD_LABEL[p.method] ?? p.method) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {p.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                        {p.status === 'pending' && <Clock className="h-3 w-3" />}
                        {p.status === 'failed' && <AlertTriangle className="h-3 w-3" />}
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.externalId ? (
                        <span className="font-mono text-xs text-gray-400 truncate max-w-[120px] block" title={p.externalId}>
                          {p.externalId}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-5 py-3">
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1 || loading}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <span className="text-xs text-gray-400">{page} / {totalPages}</span>
            <button
              onClick={() => load(page + 1)}
              disabled={page >= totalPages || loading}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Próxima <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
