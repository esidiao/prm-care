'use client'
import Link from 'next/link'
import { Dna, ChevronRight } from 'lucide-react'
import { pgxForDrugs } from '@/lib/pgx'

/**
 * Alertas de farmacogenômica (CPIC) derivados automaticamente da lista de
 * medicamentos do paciente. Só renderiza quando há alguma associação relevante.
 * Apoio à decisão — não substitui aconselhamento genético.
 */
export function PgxAlerts({ drugs }: { drugs: string[] }) {
  const items = pgxForDrugs(drugs)
  if (items.length === 0) return null

  return (
    <div className="rounded-2xl border border-indigo-200 bg-white p-4 sm:p-6 print:hidden">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Dna className="h-5 w-5 text-indigo-600" /> Farmacogenômica (CPIC)
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">{items.length}</span>
        </h2>
        <Link href="/pharmacogenomics" className="flex items-center gap-1 text-sm text-indigo-700 hover:underline">Detalhar <ChevronRight className="h-4 w-4" /></Link>
      </div>
      <p className="mt-1 text-sm text-gray-500">Medicamentos do paciente com diretriz gene–medicamento relevante. Considere genotipagem quando indicado.</p>
      <div className="mt-3 space-y-2">
        {items.map((g, i) => (
          <div key={i} className="rounded-lg border border-gray-100 bg-indigo-50/40 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">{g.gene}</span>
              <span className="text-sm font-semibold text-gray-800">{g.drugLabel}</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">CPIC {g.level}</span>
            </div>
            <p className="mt-1 text-xs text-gray-600">{g.summary}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-400">Diretrizes CPIC (cpicpgx.org) — apoio à decisão; a conduta depende do genótipo/fenótipo real, exames e contexto clínico. Não substitui aconselhamento genético.</p>
    </div>
  )
}
