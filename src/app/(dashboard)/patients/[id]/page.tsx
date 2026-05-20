import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, FlaskConical, Plus, Pill, Activity,
  AlertTriangle, Calendar, FileText, Pencil, History
} from 'lucide-react'
import {
  formatDate, formatDateTime, calculateAge,
  RISK_LEVEL_CONFIG, PRM_CATEGORY_LABELS,
  RENAL_FUNCTION_LABELS, HEPATIC_FUNCTION_LABELS, ADHERENCE_LABELS
} from '@/lib/utils'
import { DeleteMedicationButton } from '@/components/patients/DeleteMedicationButton'
import { ExportMenu } from '@/components/export/ExportMenu'
import { PatientNotes } from '@/components/patients/PatientNotes'
import { ClinicalScales } from '@/components/patients/ClinicalScales'
import { PatientEvolution } from '@/components/patients/PatientEvolution'
import { MedDiscontinuationAlert } from '@/components/patients/MedDiscontinuationAlert'

export default async function PatientDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return null

  const [patient, initialNotes, initialAssessments] = await Promise.all([
    prisma.patient.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: {
        comorbidities: true,
        allergies: true,
        diagnoses: true,
        medications: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
        labResults: { orderBy: { collectedAt: 'desc' }, take: 10 },
        analyses: {
          include: { findings: true },
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
      },
    }),
    // Graceful fallback if table doesn't exist yet (pending migration)
    prisma.clinicalNote.findMany({
      where: { patientId: params.id },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, content: true, isPinned: true, createdAt: true, updatedAt: true,
        user: { select: { name: true, email: true } },
      },
    }).catch(() => [] as never[]),
    prisma.scaleAssessment.findMany({
      where: { patientId: params.id },
      orderBy: [{ scaleType: 'asc' }, { appliedAt: 'desc' }],
      select: {
        id: true, scaleType: true, answers: true, totalScore: true,
        severity: true, notes: true, appliedAt: true, createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }).catch(() => [] as never[]),
  ])

  if (!patient) notFound()

  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : patient.age

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Back link */}
      <Link href="/patients" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Pacientes
      </Link>

      {/* Patient header — stacks on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{patient.name || patient.code}</h1>
          {patient.name && <p className="text-gray-400 text-sm">{patient.code}</p>}
          {patient.isAnonymized && (
            <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">Anonimizado</span>
          )}
        </div>
        {/* Action buttons — scrollable row on mobile, wrapped on sm+ */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap sm:justify-end shrink-0">
          <Link href={`/patients/${patient.id}/edit`}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Pencil className="h-4 w-4" />
            <span className="hidden sm:inline">Editar perfil</span>
          </Link>
          {patient.analyses.length > 0 && (
            <Link href={`/patients/${patient.id}/history`}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </Link>
          )}
          {patient.analyses.length > 0 && (
            <ExportMenu mode="prms-only" patientId={patient.id} variant="icon" />
          )}
          <Link href={`/analysis/new?patientId=${patient.id}`}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3 py-2 text-sm font-medium text-white hover:bg-[#162d4a] transition-colors">
            <FlaskConical className="h-4 w-4" />
            <span>Nova análise</span>
          </Link>
        </div>
      </div>

      {/* Medication discontinuation alert */}
      <MedDiscontinuationAlert patientId={patient.id} />

      {/* Evolution chart — only when 2+ analyses */}
      {patient.analyses.length >= 2 && (
        <PatientEvolution
          patientId={patient.id}
          analyses={patient.analyses.map(a => ({
            id: a.id,
            createdAt: a.createdAt.toISOString(),
            totalPRMs: a.totalPRMs,
            urgentPRMs: a.urgentPRMs,
            highRiskPRMs: a.highRiskPRMs,
            moderatePRMs: a.moderatePRMs,
          }))}
        />
      )}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Left column — patient info */}
        <div className="space-y-3 sm:space-y-4 lg:col-span-1">
          {/* Demographics */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#1e3a5f]" /> Dados clínicos
            </h2>
            <dl className="space-y-3 text-sm">
              {[
                { label: 'Idade', value: age ? `${age} anos` : '—' },
                { label: 'Sexo biológico', value: patient.sex === 'MALE' ? 'Masculino' : patient.sex === 'FEMALE' ? 'Feminino' : patient.sex ? 'Outro' : '—' },
                { label: 'Peso', value: patient.weight ? `${patient.weight} kg` : '—' },
                { label: 'Altura', value: patient.height ? `${patient.height} cm` : '—' },
                { label: 'IMC', value: patient.bmi ? `${patient.bmi} kg/m²` : '—' },
                { label: 'Gestante', value: patient.isPregnant ? `Sim${patient.gestationalAge ? ` (${patient.gestationalAge} sem.)` : ''}` : 'Não' },
                { label: 'Lactante', value: patient.isLactating ? 'Sim' : 'Não' },
                { label: 'Idoso', value: patient.isElderly ? 'Sim (≥ 60 anos)' : 'Não' },
                { label: 'Função renal', value: patient.renalFunction ? RENAL_FUNCTION_LABELS[patient.renalFunction] || patient.renalFunction : '—' },
                { label: 'ClCr', value: patient.creatinineClearance ? `${patient.creatinineClearance} mL/min` : '—' },
                { label: 'Função hepática', value: patient.hepaticFunction ? HEPATIC_FUNCTION_LABELS[patient.hepaticFunction] || patient.hepaticFunction : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-gray-500 flex-shrink-0">{label}</dt>
                  <dd className="font-medium text-gray-900 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Diagnoses */}
          {patient.diagnoses.length > 0 && (
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold text-gray-900">Diagnósticos</h2>
              <ul className="space-y-2">
                {patient.diagnoses.map((d) => (
                  <li key={d.id} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 h-2 w-2 flex-shrink-0 rounded-full ${d.isPrimary ? 'bg-[#1e3a5f]' : 'bg-gray-300'}`} />
                    <span>{d.name}{d.icd10Code ? ` (${d.icd10Code})` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Comorbidities */}
          {patient.comorbidities.length > 0 && (
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold text-gray-900">Comorbidades</h2>
              <div className="flex flex-wrap gap-2">
                {patient.comorbidities.map((c) => (
                  <span key={c.id} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-[#1e3a5f]">{c.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Allergies */}
          {patient.allergies.length > 0 && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-5 shadow-sm">
              <h2 className="mb-3 font-semibold text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Alergias
              </h2>
              <ul className="space-y-1.5">
                {patient.allergies.map((a) => (
                  <li key={a.id} className="text-sm text-red-700">
                    <strong>{a.substance}</strong>{a.reaction ? ` — ${a.reaction}` : ''}{a.severity ? ` (${a.severity})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right column — medications & analyses */}
        <div className="space-y-3 sm:space-y-4 lg:col-span-2">
          {/* Medications */}
          <div className="rounded-xl border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Pill className="h-4 w-4 text-[#1e3a5f]" /> Medicamentos ({patient.medications.length})
              </h2>
              <Link href={`/patients/${patient.id}/medications/new`}
                className="flex items-center gap-1 text-xs font-medium text-[#1e3a5f] hover:underline">
                <Plus className="h-3 w-3" /> Adicionar
              </Link>
            </div>
            {patient.medications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">Nenhum medicamento cadastrado</div>
            ) : (
              <div className="divide-y">
                {patient.medications.map((med) => (
                  <div key={med.id} className="px-5 py-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{med.activeIngredient}</span>
                          {med.tradeName && <span className="text-xs text-gray-400">({med.tradeName})</span>}
                          {med.isSelfMedication && (
                            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">Automedicação</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-gray-500">
                          {med.dose ? `${med.dose}${med.doseUnit || ''}` : ''} {med.pharmaceuticalForm || ''} {med.frequency ? `· ${med.frequency}` : ''}
                          {med.route ? ` · ${med.route}` : ''}
                        </p>
                        {med.indication && <p className="mt-0.5 text-xs text-gray-400">Para: {med.indication}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-xs rounded-full px-2 py-0.5 ${
                          med.adherence === 'POOR' ? 'bg-red-50 text-red-700' :
                          med.adherence === 'MODERATE' ? 'bg-yellow-50 text-yellow-700' :
                          'bg-green-50 text-green-700'
                        }`}>
                          {ADHERENCE_LABELS[med.adherence] || med.adherence}
                        </span>
                        <DeleteMedicationButton medicationId={med.id} medicationName={med.activeIngredient} />
                      </div>
                    </div>
                    {med.adverseEffects && (
                      <p className="mt-2 text-xs text-orange-600 bg-orange-50 rounded px-2 py-1">
                        ⚠️ {med.adverseEffects}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lab Results */}
          {patient.labResults.length > 0 && (
            <div className="rounded-xl border bg-white shadow-sm">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold text-gray-900">Exames laboratoriais</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-5 py-2.5 text-left text-xs text-gray-500">Exame</th>
                      <th className="px-5 py-2.5 text-left text-xs text-gray-500">Resultado</th>
                      <th className="px-5 py-2.5 text-left text-xs text-gray-500">Referência</th>
                      <th className="px-5 py-2.5 text-left text-xs text-gray-500">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {patient.labResults.map((lab) => (
                      <tr key={lab.id} className={lab.isAbnormal ? 'bg-red-50' : ''}>
                        <td className="px-5 py-2.5 font-medium text-gray-900">{lab.examName}</td>
                        <td className={`px-5 py-2.5 font-medium ${lab.isAbnormal ? 'text-red-700' : 'text-gray-700'}`}>
                          {lab.value} {lab.unit || ''}
                          {lab.isAbnormal && ' ⚠️'}
                        </td>
                        <td className="px-5 py-2.5 text-gray-500">
                          {lab.referenceMin || lab.referenceMax ? `${lab.referenceMin ?? ''}–${lab.referenceMax ?? ''} ${lab.unit || ''}` : '—'}
                        </td>
                        <td className="px-5 py-2.5 text-gray-500">{lab.collectedAt ? formatDate(lab.collectedAt) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Clinical Scales */}
          <ClinicalScales
            patientId={patient.id}
            initialAssessments={initialAssessments.map(a => ({
              ...a,
              appliedAt: a.appliedAt.toISOString(),
              createdAt: a.createdAt.toISOString(),
            }))}
          />

          {/* Clinical Notes */}
          <PatientNotes
            patientId={patient.id}
            initialNotes={initialNotes.map(n => ({
              ...n,
              createdAt: n.createdAt.toISOString(),
              updatedAt: n.updatedAt.toISOString(),
            }))}
          />

          {/* Recent analyses */}
          <div className="rounded-xl border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-gray-900">Análises PRM</h2>
                {patient.analyses.length >= 2 && (
                  <Link href={`/patients/${patient.id}/history`}
                    className="flex items-center gap-1 text-xs text-[#1e3a5f] hover:underline">
                    <History className="h-3 w-3" /> Ver histórico
                  </Link>
                )}
              </div>
              <Link href={`/analysis/new?patientId=${patient.id}`}
                className="flex items-center gap-1 rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#162d4a] transition-colors">
                <FlaskConical className="h-3 w-3" /> Nova análise
              </Link>
            </div>
            {patient.analyses.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">Nenhuma análise realizada</div>
            ) : (
              <div className="divide-y">
                {patient.analyses.map((a) => (
                  <Link key={a.id} href={`/analysis/${a.id}`}
                    className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{formatDateTime(a.createdAt)}</p>
                        <p className="text-xs text-gray-400">{a.totalPRMs} PRM(s) identificado(s)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.urgentPRMs > 0 && <span className="risk-badge-urgent">{a.urgentPRMs} urgente</span>}
                      {a.highRiskPRMs > 0 && <span className="risk-badge-high">{a.highRiskPRMs} alto</span>}
                      {a.moderatePRMs > 0 && <span className="risk-badge-moderate">{a.moderatePRMs} mod.</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
