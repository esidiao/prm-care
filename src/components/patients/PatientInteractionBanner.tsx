import Link from 'next/link'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import type { DdiCheckResult } from '@/lib/prm-engine'

const SEV: Record<string, { ring: string; chip: string; bar: string }> = {
  contraindicated: { ring: 'border-red-200 bg-red-50/60', chip: 'bg-red-100 text-red-800', bar: 'text-red-700' },
  major: { ring: 'border-orange-200 bg-orange-50/60', chip: 'bg-orange-100 text-orange-800', bar: 'text-orange-700' },
  moderate: { ring: 'border-amber-200 bg-amber-50/60', chip: 'bg-amber-100 text-amber-800', bar: 'text-amber-700' },
  minor: { ring: 'border-green-200 bg-green-50/60', chip: 'bg-green-100 text-green-800', bar: 'text-green-700' },
}

/**
 * Alerta PROATIVO de interações sobre a lista de medicamentos ativos do paciente.
 * Renderiza sempre que a ficha é vista (não só na análise). Apoio à decisão.
 */
export function PatientInteractionBanner({ result }: { result: DdiCheckResult }) {
  if (result.interactions.length === 0) return null
  const top = result.globalRisk ?? 'moderate'
  const s = SEV[top] ?? SEV.moderate
  const hasContext = result.interactions.some(i => i.contextFlags?.length)

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${s.ring}`}>
      <div className="flex items-center justify-between gap-3">
        <div className={`flex items-center gap-2 font-bold ${s.bar}`}>
          <AlertTriangle className="h-5 w-5" />
          Interações na lista atual: {result.globalLabel} · {result.interactions.length}
        </div>
        <Link href="/interactions" className="flex items-center gap-1 text-sm text-gray-600 hover:underline shrink-0">Consulta completa <ChevronRight className="h-4 w-4" /></Link>
      </div>
      <ul className="mt-2 space-y-1.5">
        {result.interactions.slice(0, 4).map((it, i) => {
          const c = SEV[it.severity] ?? SEV.moderate
          return (
            <li key={i} className="text-sm text-gray-700">
              <span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${c.chip}`}>{it.severityLabel}</span>
              <b>{it.drugs[0]} + {it.drugs[1]}</b> — {it.clinicalEffect}
              {it.contextFlags?.map((f, k) => <span key={k} className="mt-0.5 block pl-1 text-xs text-amber-800">⚠ {f}</span>)}
            </li>
          )
        })}
        {result.interactions.length > 4 && <li className="text-xs text-gray-500">+ {result.interactions.length - 4} outra(s)…</li>}
      </ul>
      <p className="mt-2 text-xs text-gray-400">Apoio à decisão — não substitui a avaliação clínica. {hasContext && 'Itens com ⚠ têm risco amplificado pelo contexto do paciente.'}</p>
    </div>
  )
}
