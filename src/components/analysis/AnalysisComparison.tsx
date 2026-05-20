'use client'
import { TrendingDown, TrendingUp, Minus, ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'

interface FindingSummary {
  id: string
  title: string
  riskLevel: string
  category: string
  isResolved: boolean
}

interface Props {
  currentAnalysisId: string
  previousAnalysis: {
    id: string
    createdAt: string
    totalPRMs: number
    urgentPRMs: number
    highRiskPRMs: number
    findings: FindingSummary[]
  }
  currentFindings: FindingSummary[]
}

const RISK_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MODERATE: 2, LOW: 3 }
const RISK_COLORS: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  MODERATE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  LOW: 'bg-green-100 text-green-700 border-green-200',
}
const RISK_LABELS: Record<string, string> = {
  URGENT: 'Urgente', HIGH: 'Alto', MODERATE: 'Moderado', LOW: 'Baixo',
}

export function AnalysisComparison({ currentAnalysisId, previousAnalysis, currentFindings }: Props) {
  const prevTitles = new Set(previousAnalysis.findings.map((f) => f.title.toLowerCase().trim()))
  const currTitles = new Set(currentFindings.map((f) => f.title.toLowerCase().trim()))

  // New PRMs: in current but not in previous
  const newPRMs = currentFindings
    .filter((f) => !prevTitles.has(f.title.toLowerCase().trim()) && !f.isResolved)
    .sort((a, b) => (RISK_ORDER[a.riskLevel] ?? 9) - (RISK_ORDER[b.riskLevel] ?? 9))

  // Resolved since last: were in previous (unresolved), now resolved or absent
  const resolvedSince = previousAnalysis.findings
    .filter((f) => !f.isResolved)
    .filter((f) => {
      const inCurrent = currentFindings.find((c) => c.title.toLowerCase().trim() === f.title.toLowerCase().trim())
      return !inCurrent || inCurrent.isResolved
    })

  // Persisting unresolved
  const persisting = currentFindings
    .filter((f) => !f.isResolved && prevTitles.has(f.title.toLowerCase().trim()))
    .sort((a, b) => (RISK_ORDER[a.riskLevel] ?? 9) - (RISK_ORDER[b.riskLevel] ?? 9))

  const totalCurrent = currentFindings.filter((f) => !f.isResolved).length
  const totalPrev = previousAnalysis.findings.filter((f) => !f.isResolved).length
  const delta = totalCurrent - totalPrev
  const improved = delta < 0
  const worsened = delta > 0

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-4 bg-gradient-to-r from-[#1e3a5f]/5 to-transparent">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Comparação com análise anterior
          </h3>
        </div>
        <Link href={`/analysis/${previousAnalysis.id}`}
          className="flex items-center gap-1 text-xs text-[#1e3a5f] dark:text-blue-400 hover:underline">
          Ver anterior <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Delta summary */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700 border-b border-gray-100 dark:border-gray-700">
        <div className="px-4 py-3 text-center">
          <p className={`text-xl font-bold ${improved ? 'text-emerald-600' : worsened ? 'text-red-600' : 'text-gray-600'}`}>
            {delta > 0 ? `+${delta}` : delta}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">variação</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-xl font-bold text-emerald-600">{resolvedSince.length}</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">resolvidos</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-xl font-bold text-red-600">{newPRMs.length}</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">novos PRMs</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Trend message */}
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
          improved ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' :
          worsened ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300' :
          'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400'
        }`}>
          {improved ? <TrendingDown className="h-4 w-4" /> : worsened ? <TrendingUp className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
          {improved
            ? `Melhora: ${Math.abs(delta)} PRM(s) a menos em relação à análise anterior.`
            : worsened
            ? `Atenção: ${delta} PRM(s) novo(s) surgiu(ram) desde a última análise.`
            : 'Estável: mesmo número de PRMs ativos da análise anterior.'}
        </div>

        {/* New PRMs */}
        {newPRMs.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
              🆕 PRMs novos nesta análise
            </p>
            <div className="space-y-1">
              {newPRMs.slice(0, 4).map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-1.5 text-xs">
                  <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${RISK_COLORS[f.riskLevel] ?? 'bg-gray-100 text-gray-600'}`}>
                    {RISK_LABELS[f.riskLevel] ?? f.riskLevel}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">{f.title}</span>
                </div>
              ))}
              {newPRMs.length > 4 && (
                <p className="text-[10px] text-gray-400 pl-2">+{newPRMs.length - 4} mais…</p>
              )}
            </div>
          </div>
        )}

        {/* Resolved since */}
        {resolvedSince.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              ✓ Resolvidos desde a última análise
            </p>
            <div className="space-y-1">
              {resolvedSince.slice(0, 3).map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                  <span>✓</span>
                  <span className="line-through opacity-70">{f.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Persisting high-risk */}
        {persisting.filter((f) => f.riskLevel === 'URGENT' || f.riskLevel === 'HIGH').length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
              ⚠️ Alto risco persistente (já na análise anterior)
            </p>
            <div className="space-y-1">
              {persisting.filter((f) => f.riskLevel === 'URGENT' || f.riskLevel === 'HIGH').map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/50 px-3 py-1.5 text-xs text-orange-700 dark:text-orange-300">
                  <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${RISK_COLORS[f.riskLevel]}`}>
                    {RISK_LABELS[f.riskLevel]}
                  </span>
                  <span>{f.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
