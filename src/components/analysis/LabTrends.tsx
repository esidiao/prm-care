'use client'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { analyzeLabTrends, type LabPoint } from '@/lib/lab-trends'

const STYLE = {
  high: 'border-red-200 bg-red-50/60 text-red-800',
  warning: 'border-amber-200 bg-amber-50/60 text-amber-800',
  info: 'border-slate-200 bg-slate-50 text-slate-700',
} as const

/**
 * Painel de monitoramento temporal: mostra exames com PIORA entre as duas medidas
 * mais recentes. Só renderiza quando há tendência relevante. Apoio à decisão.
 */
export function LabTrends({ labs }: { labs: LabPoint[] }) {
  const trends = analyzeLabTrends(labs)
  if (trends.length === 0) return null

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 print:hidden">
      <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
        <Activity className="h-5 w-5 text-[#2c7a7b]" /> Monitoramento de exames (tendência)
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{trends.length}</span>
      </h2>
      <p className="mt-1 text-sm text-gray-500">Variação relevante entre as duas medidas mais recentes — reavaliar conduta.</p>
      <div className="mt-3 space-y-2">
        {trends.map((t, i) => (
          <div key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${STYLE[t.severity]}`}>
            {t.direction === 'up' ? <TrendingUp className="mt-0.5 h-4 w-4 shrink-0" /> : <TrendingDown className="mt-0.5 h-4 w-4 shrink-0" />}
            <div>
              <span className="font-semibold">{t.analyte}: {t.previous} → {t.latest}{t.unit ? ` ${t.unit}` : ''}</span>
              <p>{t.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
