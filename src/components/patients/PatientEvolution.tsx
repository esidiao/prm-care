'use client'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingDown, TrendingUp, Minus, Activity } from 'lucide-react'

interface AnalysisSummary {
  id: string
  createdAt: string
  totalPRMs: number
  urgentPRMs: number
  highRiskPRMs: number
  moderatePRMs: number
}

interface Props {
  analyses: AnalysisSummary[]
  patientId: string
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ── Trend indicator ────────────────────────────────────────────────────────────

function TrendBadge({ analyses }: { analyses: AnalysisSummary[] }) {
  if (analyses.length < 2) return null
  const latest = analyses[0].totalPRMs
  const prev = analyses[1].totalPRMs
  const diff = latest - prev
  const pct = prev > 0 ? Math.round(Math.abs(diff / prev) * 100) : 0

  if (diff < 0) return (
    <span className="flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
      <TrendingDown className="h-3.5 w-3.5" /> {pct}% menos PRMs
    </span>
  )
  if (diff > 0) return (
    <span className="flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-300">
      <TrendingUp className="h-3.5 w-3.5" /> {pct}% mais PRMs
    </span>
  )
  return (
    <span className="flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
      <Minus className="h-3.5 w-3.5" /> Sem variação
    </span>
  )
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-xl text-xs">
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-600 dark:text-gray-400">{p.name}:</span>
          <span className="font-bold text-gray-900 dark:text-gray-100">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PatientEvolution({ analyses }: Props) {
  if (analyses.length < 2) return null

  // Chart data: oldest → newest
  const data = [...analyses]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((a, i) => ({
      name: fmt(a.createdAt),
      label: `Análise ${i + 1}`,
      Urgentes: a.urgentPRMs,
      'Alto risco': a.highRiskPRMs,
      Moderados: a.moderatePRMs,
      Total: a.totalPRMs,
      id: a.id,
    }))

  // Summary stats
  const totalResolved = analyses.length >= 2
    ? Math.max(0, analyses[analyses.length - 1].totalPRMs - analyses[0].totalPRMs)
    : 0
  const avgPRMs = Math.round(analyses.reduce((s, a) => s + a.totalPRMs, 0) / analyses.length)
  const peakAnalysis = analyses.reduce((max, a) => a.totalPRMs > max.totalPRMs ? a : max, analyses[0])

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700 px-5 py-4">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" />
          Evolução clínica — {analyses.length} análises
        </h2>
        <TrendBadge analyses={[...analyses].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )} />
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700 border-b border-gray-100 dark:border-gray-700">
        {[
          { label: 'Média de PRMs', value: avgPRMs },
          { label: 'Pico máximo', value: peakAnalysis.totalPRMs },
          { label: 'Análises', value: analyses.length },
        ].map(({ label, value }) => (
          <div key={label} className="px-4 py-3 text-center">
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="px-2 py-4 sm:px-4">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="gradUrgent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradHigh" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradMod" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#eab308" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.6} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Area type="monotone" dataKey="Urgentes" stroke="#ef4444" strokeWidth={2}
              fill="url(#gradUrgent)" dot={{ r: 3, fill: '#ef4444' }} />
            <Area type="monotone" dataKey="Alto risco" stroke="#f97316" strokeWidth={2}
              fill="url(#gradHigh)" dot={{ r: 3, fill: '#f97316' }} />
            <Area type="monotone" dataKey="Moderados" stroke="#eab308" strokeWidth={2}
              fill="url(#gradMod)" dot={{ r: 3, fill: '#eab308' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
