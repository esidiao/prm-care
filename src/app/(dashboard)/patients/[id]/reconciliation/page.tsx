import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pill } from 'lucide-react'
import { calculateAge } from '@/lib/utils'
import { resolveSchedule, generatePosologyAlerts, getTherapeuticClass, type ResolvedSchedule } from '@/lib/posology'
import { getPKProfile } from '@/lib/pharma-pk-db'
import { MedScheduleGrid } from '@/components/reconciliation/MedScheduleGrid'
import { PrintButton } from '@/components/reconciliation/PrintButton'

// ── Exported types (used by MedScheduleGrid) ─────────────────────────────────

export interface MedWithSchedule {
  id: string
  name: string
  activeIngredient: string
  dosage: string | null
  frequency: string | null
  schedule: ResolvedSchedule
  therapeuticClass: string
  pkClass?: string   // classe terapêutica detalhada do banco FK
}

export interface PosologyAlert {
  type: string
  severity: 'high' | 'medium' | 'low'
  title: string
  medication: string
  message: string
  recommendation?: string
}

// Severity mapping from posology engine → UI
const SEVERITY_MAP: Record<string, 'high' | 'medium' | 'low'> = {
  critical: 'high',
  warning: 'medium',
  info: 'low',
}

// Type label mapping
const TYPE_LABELS: Record<string, string> = {
  timing: 'Horário',
  food: 'Interação Alimentar',
  high_risk: 'Alto Risco',
  interaction: 'Interação Medicamentosa',
  adherence: 'Adesão',
  renal: 'Ajuste Renal',
  hepatic: 'Ajuste Hepático',
  beers: 'Critérios Beers',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ReconciliationPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return null

  const patient = await prisma.patient.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      medications: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
    },
  })

  if (!patient) notFound()

  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : patient.age

  // Resolve schedules for each medication
  const meds: MedWithSchedule[] = patient.medications.map(med => {
    const profile = getPKProfile(med.activeIngredient)
    return {
      id: med.id,
      activeIngredient: med.activeIngredient,
      name: med.tradeName ? `${med.activeIngredient} (${med.tradeName})` : med.activeIngredient,
      dosage: med.dose != null ? `${med.dose}${med.doseUnit ?? ''}` : null,
      frequency: med.frequency,
      schedule: resolveSchedule({
        activeIngredient: med.activeIngredient,
        schedule: med.schedule,
        frequencyHours: med.frequencyHours,
        frequency: med.frequency,
      }),
      therapeuticClass: getTherapeuticClass(med.activeIngredient),
      pkClass: profile?.class,
    }
  })

  // Generate clinical alerts (posology engine returns its own PosologyAlert type)
  const rawAlerts = generatePosologyAlerts(patient.medications, {
    isElderly: age !== null && age !== undefined && age >= 65,
    renalFunction: patient.renalFunction ?? undefined,
    hepaticFunction: patient.hepaticFunction ?? undefined,
  })

  // Transform to UI PosologyAlert shape
  const alerts: PosologyAlert[] = rawAlerts.map(a => ({
    type: a.type,
    severity: SEVERITY_MAP[a.severity] ?? 'low',
    title: TYPE_LABELS[a.type] ?? a.type,
    medication: a.medicationName,
    message: a.message,
    recommendation: a.recommendation,
  }))

  // Sort: high → medium → low
  alerts.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.severity] - order[b.severity]
  })

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Nav */}
      <Link
        href={`/patients/${params.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao paciente
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e3a5f]">
            <Pill className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Conciliação Farmacêutica</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {patient.name || patient.code}
              {age !== null && age !== undefined && ` · ${age} anos`}
              {patient.medications.length > 0 && ` · ${patient.medications.length} medicamento${patient.medications.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <PrintButton />
      </div>

      {/* Print-only header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Conciliação Farmacêutica</h1>
        <p className="text-gray-600 mt-1">
          Paciente: {patient.name || patient.code}
          {age !== null && age !== undefined && ` · ${age} anos`}
        </p>
      </div>

      {patient.medications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <Pill className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">Nenhum medicamento ativo cadastrado</p>
          <p className="text-sm text-gray-400 mt-1">
            Cadastre os medicamentos na aba de edição do paciente para gerar a conciliação.
          </p>
          <Link
            href={`/patients/${params.id}/edit`}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#162d4a]"
          >
            Editar paciente
          </Link>
        </div>
      ) : (
        <MedScheduleGrid
          meds={meds}
          alerts={alerts}
          patientName={patient.name || patient.code}
          patientAge={age ?? null}
        />
      )}
    </div>
  )
}
