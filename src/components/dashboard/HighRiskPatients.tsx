'use client'
import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'

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

export function HighRiskPatients({ patients }: { patients: HighRiskPatient[] }) {
  if (patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 mb-3">
          <AlertTriangle className="h-5 w-5 text-green-600" />
        </div>
        <p className="text-sm text-gray-500">Nenhum paciente com PRMs de alto risco pendentes</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-50">
      {patients.map((patient) => {
        const latestAnalysis = patient.analyses[0]
        const isUrgent = latestAnalysis?.urgentPRMs > 0

        return (
          <Link
            key={patient.id}
            href={`/patients/${patient.id}`}
            className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                isUrgent ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {(patient.code || 'P').slice(0, 3)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate group-hover:text-[#1e3a5f]">
                  {patient.name || patient.code}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {latestAnalysis?.urgentPRMs > 0 && (
                    <span className="text-xs rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 font-medium">
                      {latestAnalysis.urgentPRMs} urgente
                    </span>
                  )}
                  {latestAnalysis?.highRiskPRMs > 0 && (
                    <span className="text-xs rounded-full bg-orange-100 text-orange-700 px-1.5 py-0.5 font-medium">
                      {latestAnalysis.highRiskPRMs} alto
                    </span>
                  )}
                </div>
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
          </Link>
        )
      })}
    </div>
  )
}
