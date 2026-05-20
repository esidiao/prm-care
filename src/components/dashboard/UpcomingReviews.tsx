'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, AlertCircle, CheckCircle2, ArrowRight, Clock } from 'lucide-react'

interface Review {
  id: string
  patientId: string
  scheduledDate: string
  type: string
  title: string
  status: string
  patient: { id: string; name: string | null; code: string }
}

const TYPE_ICONS: Record<string, string> = {
  MEDICATION_REVIEW: '💊',
  FOLLOW_UP: '🫀',
  LAB_CHECK: '🧪',
  ADHERENCE: '📋',
  CUSTOM: '📝',
}

function dayLabel(iso: string): { label: string; urgent: boolean } {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  if (diff < 0) return { label: `${Math.abs(diff)}d atrasada`, urgent: true }
  if (diff === 0) return { label: 'Hoje', urgent: true }
  if (diff === 1) return { label: 'Amanhã', urgent: false }
  return { label: `Em ${diff}d`, urgent: false }
}

export function UpcomingReviews() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reviews/upcoming')
      .then((r) => r.ok ? r.json() : [])
      .then(setReviews)
      .catch(() => setReviews([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Próximas revisões</h2>
          {reviews.some((r) => {
            const diff = Math.ceil((new Date(r.scheduledDate).getTime() - Date.now()) / 86400000)
            return diff <= 0
          }) && (
            <span className="rounded-full bg-red-100 dark:bg-red-900 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 animate-pulse">
              Atrasadas
            </span>
          )}
        </div>
        <Link href="/patients" className="text-xs font-medium text-[#1e3a5f] dark:text-blue-400 hover:underline">
          Ver pacientes
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Clock className="h-5 w-5 text-gray-300 dark:text-gray-600 animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900 mb-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Nenhuma revisão nos próximos 30 dias</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Agende revisões nos perfis dos pacientes</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {reviews.map((r) => {
            const { label, urgent } = dayLabel(r.scheduledDate)
            return (
              <Link
                key={r.id}
                href={`/patients/${r.patient.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors group"
              >
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-base ${
                  urgent ? 'bg-red-100 dark:bg-red-900' : 'bg-blue-50 dark:bg-blue-950'
                }`}>
                  {TYPE_ICONS[r.type] ?? '📝'}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-[#1e3a5f] dark:group-hover:text-blue-400 transition-colors">
                    {r.patient.name || r.patient.code}
                  </p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">{r.title}</p>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                    urgent
                      ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                      : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  }`}>
                    {urgent && <AlertCircle className="h-2.5 w-2.5 inline mr-0.5" />}
                    {label}
                  </span>
                  <ArrowRight className="h-3 w-3 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 transition-colors" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
