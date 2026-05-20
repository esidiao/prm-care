'use client'
import Link from 'next/link'
import { AlertTriangle, AlertCircle, ArrowRight, CheckCircle, Calendar } from 'lucide-react'

interface HighRiskPatient {
  id: string
  name: string | null
  code: string
  analyses: {
    id: string
    createdAt: Date
    urgentPRMs: number
    highRiskPRMs: number
    _count: { findings: number }
  }[]
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

export function HighRiskPatients({ patients }: { patients: HighRiskPatient[] }) {
  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 mb-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
        </div>
        <p className="text-sm font-medium text-gray-600">Nenhum paciente com risco alto pendente</p>
        <p className="text-xs text-gray-400 mt-1">Todos os PRMs urgentes foram resolvidos</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-50">
      {patients.map((patient) => {
        const a = patient.analyses[0]
        const isUrgent = (a?.urgentPRMs ?? 0) > 0
        const days = a ? daysSince(a.createdAt) : null

        return (
          <Link
            key={patient.id}
            href={`/analysis/${a?.id ?? ''}`}
            className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/80 transition-colors group"
          >
            {/* Avatar */}
            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
              isUrgent ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
            }`}>
              {(patient.name || patient.code).slice(0, 2).toUpperCase()}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-[#1e3a5f] transition-colors">
                {patient.name || patient.code}
              </p>
              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                {(a?.urgentPRMs ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {a!.urgentPRMs} urgente
                  </span>
                )}
                {(a?.highRiskPRMs ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                    <AlertCircle className="h-2.5 w-2.5" />
                    {a!.highRiskPRMs} alto
                  </span>
                )}
                {days !== null && (
                  <span className={`inline-flex items-center gap-0.5 text-[10px] ${
                    days > 30 ? 'text-amber-500' : 'text-gray-400'
                  }`}>
                    <Calendar className="h-2.5 w-2.5" />
                    {days === 0 ? 'hoje' : `${days}d atrás`}
                  </span>
                )}
              </div>
            </div>

            <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-300 group-hover:text-gray-500 transition-colors" />
          </Link>
        )
      })}

      {/* Footer: link to filtered list */}
      <div className="px-5 py-3">
        <Link href="/patients?filter=urgent"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-red-200 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
          Ver todos os pacientes em risco
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
