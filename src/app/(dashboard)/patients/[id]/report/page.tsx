import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import {
  calculateAge, formatDate, formatDateTime,
  RISK_LEVEL_CONFIG, PRM_CATEGORY_LABELS,
  RENAL_FUNCTION_LABELS, HEPATIC_FUNCTION_LABELS, ADHERENCE_LABELS,
} from '@/lib/utils'
import { ReferralPrintButton } from '@/components/patients/ReferralPrintButton'

const SEVERITY_PT: Record<string, string> = {
  MINIMAL: 'Mínima', MILD: 'Leve', MODERATE: 'Moderada',
  MODERATELY_SEVERE: 'Mod. grave', SEVERE: 'Grave',
}
const SCALE_NAMES: Record<string, string> = {
  GAD7: 'GAD-7 (Ansiedade)', PHQ9: 'PHQ-9 (Depressão)',
  AUDIT_C: 'AUDIT-C (Álcool)', MORISKY4: 'Morisky-4 (Adesão)',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 page-break-inside-avoid">
      <h2 className="mb-2 border-b border-gray-300 pb-1 text-xs font-bold uppercase tracking-wider text-[#1e3a5f]">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-36 shrink-0 text-gray-500">{label}:</span>
      <span className="text-gray-900">{value}</span>
    </div>
  )
}

export default async function PatientReportPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return null

  const [patient, pharmacist, notes, assessments] = await Promise.all([
    prisma.patient.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: {
        diagnoses: { orderBy: { isPrimary: 'desc' } },
        comorbidities: true,
        allergies: true,
        medications: { orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }] },
        labResults: { orderBy: { collectedAt: 'desc' }, take: 20 },
        analyses: {
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            findings: {
              orderBy: { createdAt: 'asc' },
              include: { medication: { select: { activeIngredient: true, tradeName: true } } },
            },
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, crfNumber: true, specialization: true, institution: true },
    }),
    prisma.clinicalNote.findMany({
      where: { patientId: params.id },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, content: true, isPinned: true, createdAt: true, user: { select: { name: true } } },
    }).catch(() => [] as never[]),
    prisma.scaleAssessment.findMany({
      where: { patientId: params.id },
      orderBy: [{ scaleType: 'asc' }, { appliedAt: 'desc' }],
      select: { id: true, scaleType: true, totalScore: true, severity: true, appliedAt: true, user: { select: { name: true } } },
    }).catch(() => [] as never[]),
  ])

  if (!patient) notFound()

  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : patient.age
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const todayShort = new Date().toLocaleDateString('pt-BR')

  const activeMeds = patient.medications.filter((m) => m.isActive)
  const inactiveMeds = patient.medications.filter((m) => !m.isActive)
  const allPRMs = patient.analyses.flatMap((a) => a.findings)
  const unresolvedPRMs = allPRMs.filter((f) => !f.isResolved)
  const resolvedPRMs = allPRMs.filter((f) => f.isResolved)

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Toolbar */}
      <div className="fixed top-4 right-4 z-10 flex gap-2 print:hidden">
        <a
          href={`/patients/${patient.id}`}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow hover:bg-gray-50"
        >
          ← Voltar
        </a>
        <ReferralPrintButton />
      </div>

      <div className="mx-auto max-w-[740px] px-10 py-10 print:px-6 print:py-8 font-sans text-xs">

        {/* ── Cover header ───────────────────────────────────────────── */}
        <div className="mb-8 border-b-2 border-[#1e3a5f] pb-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">PRM Care — Método Dáder</p>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">
                Relatório Completo do Paciente
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {patient.name || patient.code}
                {age ? ` · ${age} anos` : ''}
                {patient.sex === 'MALE' ? ' · M' : patient.sex === 'FEMALE' ? ' · F' : ''}
              </p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p className="font-semibold text-gray-600">{pharmacist?.institution ?? 'Serviço Farmacêutico'}</p>
              {pharmacist?.crfNumber && <p>CRF: {pharmacist.crfNumber}</p>}
              <p className="mt-1">{todayShort}</p>
            </div>
          </div>

          {/* Summary chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { label: 'Medicamentos ativos', value: activeMeds.length },
              { label: 'Análises realizadas', value: patient.analyses.length },
              { label: 'PRMs ativos', value: unresolvedPRMs.length },
              { label: 'PRMs resolvidos', value: resolvedPRMs.length },
              ...(assessments.length > 0 ? [{ label: 'Escalas aplicadas', value: assessments.length }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="rounded border border-gray-200 bg-gray-50 px-3 py-1.5 text-center">
                <p className="text-base font-bold text-[#1e3a5f]">{value}</p>
                <p className="text-[10px] text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 1. Dados clínicos ──────────────────────────────────────── */}
        <Section title="1. Dados Clínicos e Demográficos">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <Field label="Código do paciente" value={patient.code} />
            <Field label="Idade" value={age ? `${age} anos` : undefined} />
            <Field label="Sexo biológico" value={patient.sex === 'MALE' ? 'Masculino' : patient.sex === 'FEMALE' ? 'Feminino' : patient.sex ? 'Outro' : undefined} />
            <Field label="Data de nasc." value={patient.dateOfBirth ? formatDate(patient.dateOfBirth) : undefined} />
            <Field label="Peso" value={patient.weight ? `${patient.weight} kg` : undefined} />
            <Field label="Altura" value={patient.height ? `${patient.height} cm` : undefined} />
            <Field label="IMC" value={patient.bmi ? `${patient.bmi} kg/m²` : undefined} />
            <Field label="Gestante" value={patient.isPregnant ? `Sim${patient.gestationalAge ? ` (${patient.gestationalAge} sem.)` : ''}` : 'Não'} />
            <Field label="Lactante" value={patient.isLactating ? 'Sim' : 'Não'} />
            <Field label="Idoso (≥60 anos)" value={patient.isElderly ? 'Sim' : 'Não'} />
            <Field label="Função renal" value={patient.renalFunction ? RENAL_FUNCTION_LABELS[patient.renalFunction] : undefined} />
            <Field label="ClCr" value={patient.creatinineClearance ? `${patient.creatinineClearance} mL/min` : undefined} />
            <Field label="Função hepática" value={patient.hepaticFunction ? HEPATIC_FUNCTION_LABELS[patient.hepaticFunction] : undefined} />
          </div>
          {patient.chiefComplaint && (
            <div className="mt-2">
              <Field label="Queixa principal" value={patient.chiefComplaint} />
            </div>
          )}
          {patient.observations && (
            <div className="mt-1">
              <Field label="Observações" value={patient.observations} />
            </div>
          )}
        </Section>

        {/* ── 2. Diagnósticos ───────────────────────────────────────── */}
        {patient.diagnoses.length > 0 && (
          <Section title="2. Diagnósticos">
            <div className="space-y-1">
              {patient.diagnoses.map((d) => (
                <div key={d.id} className="flex items-start gap-2">
                  <span className={`mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full ${d.isPrimary ? 'bg-[#1e3a5f]' : 'bg-gray-400'}`} />
                  <span className="text-gray-900">{d.name}{d.icd10Code ? ` (${d.icd10Code})` : ''}</span>
                  {d.isPrimary && <span className="text-[10px] text-gray-400">(principal)</span>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── 3. Comorbidades e alergias ───────────────────────────── */}
        {(patient.comorbidities.length > 0 || patient.allergies.length > 0) && (
          <Section title="3. Comorbidades e Alergias">
            {patient.comorbidities.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-semibold uppercase text-gray-500 mb-1">Comorbidades</p>
                <p className="text-gray-800">{patient.comorbidities.map((c) => c.name).join(' · ')}</p>
              </div>
            )}
            {patient.allergies.length > 0 && (
              <div className="rounded border border-red-200 bg-red-50 p-2">
                <p className="text-[10px] font-bold uppercase text-red-700 mb-1">⚠️ Alergias</p>
                {patient.allergies.map((a) => (
                  <p key={a.id} className="text-red-800">
                    <strong>{a.substance}</strong>
                    {a.reaction ? ` — ${a.reaction}` : ''}
                    {a.severity ? ` (${a.severity})` : ''}
                  </p>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── 4. Farmacoterapia ─────────────────────────────────────── */}
        <Section title={`4. Farmacoterapia (${activeMeds.length} ativo${activeMeds.length !== 1 ? 's' : ''}${inactiveMeds.length > 0 ? `, ${inactiveMeds.length} inativo${inactiveMeds.length !== 1 ? 's' : ''}` : ''})`}>
          {activeMeds.length > 0 ? (
            <table className="w-full border-collapse mb-2">
              <thead>
                <tr className="border-b border-gray-300 text-[10px] text-gray-500">
                  <th className="py-1 text-left font-semibold">Medicamento</th>
                  <th className="py-1 text-left font-semibold">Dose</th>
                  <th className="py-1 text-left font-semibold">Frequência</th>
                  <th className="py-1 text-left font-semibold">Adesão</th>
                  <th className="py-1 text-left font-semibold">Indicação</th>
                </tr>
              </thead>
              <tbody>
                {activeMeds.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100">
                    <td className="py-1 font-medium text-gray-900">
                      {m.activeIngredient}
                      {m.tradeName ? <span className="font-normal text-gray-400"> ({m.tradeName})</span> : ''}
                      {m.isSelfMedication ? <span className="ml-1 text-orange-600">[auto]</span> : ''}
                    </td>
                    <td className="py-1 text-gray-700">{m.dose ? `${m.dose} ${m.doseUnit ?? ''}`.trim() : '—'}</td>
                    <td className="py-1 text-gray-700">{m.frequency ?? '—'}</td>
                    <td className="py-1 text-gray-700">{m.adherence ? ADHERENCE_LABELS[m.adherence] ?? m.adherence : '—'}</td>
                    <td className="py-1 text-gray-700">{m.indication ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-400 italic">Nenhum medicamento ativo registrado.</p>
          )}
          {inactiveMeds.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[10px] text-gray-400 print:hidden">
                Ver {inactiveMeds.length} medicamento(s) inativo(s)
              </summary>
              <p className="mt-1 text-gray-400">
                {inactiveMeds.map((m) => m.activeIngredient).join(', ')}
              </p>
            </details>
          )}
        </Section>

        {/* ── 5. Exames laboratoriais ───────────────────────────────── */}
        {patient.labResults.length > 0 && (
          <Section title="5. Exames Laboratoriais">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-[10px] text-gray-500">
                  <th className="py-1 text-left font-semibold">Exame</th>
                  <th className="py-1 text-left font-semibold">Resultado</th>
                  <th className="py-1 text-left font-semibold">Referência</th>
                  <th className="py-1 text-left font-semibold">Data</th>
                </tr>
              </thead>
              <tbody>
                {patient.labResults.map((lab) => (
                  <tr key={lab.id} className={`border-b border-gray-100 ${lab.isAbnormal ? 'bg-red-50' : ''}`}>
                    <td className="py-1 font-medium text-gray-900">{lab.examName}</td>
                    <td className={`py-1 font-medium ${lab.isAbnormal ? 'text-red-700' : 'text-gray-700'}`}>
                      {lab.value} {lab.unit ?? ''}{lab.isAbnormal ? ' ⚠️' : ''}
                    </td>
                    <td className="py-1 text-gray-500">
                      {lab.referenceMin != null || lab.referenceMax != null
                        ? `${lab.referenceMin ?? ''}–${lab.referenceMax ?? ''} ${lab.unit ?? ''}`
                        : '—'}
                    </td>
                    <td className="py-1 text-gray-500">{lab.collectedAt ? formatDate(lab.collectedAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* ── 6. Análises PRM ───────────────────────────────────────── */}
        {patient.analyses.length > 0 && (
          <Section title={`6. Análises Farmacoterapêuticas (${patient.analyses.length})`}>
            {patient.analyses.map((analysis, ai) => (
              <div key={analysis.id} className={`mb-4 rounded border border-gray-200 p-3 ${ai > 0 ? 'opacity-80' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-800">
                    Análise {patient.analyses.length - ai} — {formatDateTime(analysis.createdAt)}
                  </span>
                  <div className="flex gap-1.5">
                    {analysis.urgentPRMs > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                        {analysis.urgentPRMs} urgente(s)
                      </span>
                    )}
                    {analysis.highRiskPRMs > 0 && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                        {analysis.highRiskPRMs} alto risco
                      </span>
                    )}
                    {analysis.moderatePRMs > 0 && (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">
                        {analysis.moderatePRMs} moderado(s)
                      </span>
                    )}
                    {analysis.totalPRMs === 0 && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                        Sem PRMs
                      </span>
                    )}
                  </div>
                </div>

                {analysis.summary && (
                  <p className="mb-2 text-gray-600 leading-relaxed">{analysis.summary}</p>
                )}

                {analysis.findings.length > 0 && (
                  <div className="space-y-1.5">
                    {analysis.findings.map((f) => {
                      const cfg = RISK_LEVEL_CONFIG[f.riskLevel as keyof typeof RISK_LEVEL_CONFIG]
                      return (
                        <div key={f.id} className={`rounded border-l-2 pl-2 py-1 ${f.isResolved ? 'border-green-400 opacity-60' : f.riskLevel === 'URGENT' ? 'border-red-500' : f.riskLevel === 'HIGH' ? 'border-orange-400' : 'border-yellow-400'}`}>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">{f.title}</span>
                            <span className={`text-[10px] font-bold uppercase px-1 py-0.5 rounded ${cfg?.badge ?? 'bg-gray-100 text-gray-700'}`}>
                              {cfg?.label ?? f.riskLevel}
                            </span>
                            <span className="text-gray-400 text-[10px]">
                              {PRM_CATEGORY_LABELS[f.category as keyof typeof PRM_CATEGORY_LABELS] ?? f.category}
                            </span>
                            {f.isResolved && <span className="ml-auto text-green-600 text-[10px] font-semibold">✓ Resolvido</span>}
                          </div>
                          <p className="text-gray-600 mt-0.5 leading-snug">{f.description}</p>
                          {f.medication && (
                            <p className="text-gray-400 mt-0.5">Med: {f.medication.activeIngredient}{f.medication.tradeName ? ` (${f.medication.tradeName})` : ''}</p>
                          )}
                          {f.pharmacistConduct && (
                            <p className="mt-0.5 text-gray-600"><strong>Conduta:</strong> {f.pharmacistConduct}</p>
                          )}
                          {f.suggestedExams && (
                            <p className="mt-0.5 text-gray-600"><strong>Exames sugeridos:</strong> {f.suggestedExams}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* ── 7. Escalas clínicas ───────────────────────────────────── */}
        {assessments.length > 0 && (
          <Section title={`7. Escalas Clínicas Validadas (${assessments.length} aplicações)`}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-[10px] text-gray-500">
                  <th className="py-1 text-left font-semibold">Escala</th>
                  <th className="py-1 text-center font-semibold">Score</th>
                  <th className="py-1 text-left font-semibold">Gravidade</th>
                  <th className="py-1 text-left font-semibold">Data</th>
                  <th className="py-1 text-left font-semibold">Profissional</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100">
                    <td className="py-1 font-medium text-gray-900">{SCALE_NAMES[a.scaleType] ?? a.scaleType}</td>
                    <td className="py-1 text-center font-bold text-gray-800">{a.totalScore}</td>
                    <td className="py-1 text-gray-700">{SEVERITY_PT[a.severity] ?? a.severity}</td>
                    <td className="py-1 text-gray-500">{new Date(a.appliedAt).toLocaleDateString('pt-BR')}</td>
                    <td className="py-1 text-gray-500">{a.user.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* ── 8. Anotações clínicas ─────────────────────────────────── */}
        {notes.length > 0 && (
          <Section title={`8. Anotações Clínicas (${notes.length})`}>
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className={`rounded border p-2 ${n.isPinned ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-400">
                      {new Date(n.createdAt).toLocaleDateString('pt-BR')} — {n.user.name ?? 'Farmacêutico'}
                    </span>
                    {n.isPinned && <span className="text-[10px] text-amber-700 font-semibold">📌 Fixada</span>}
                  </div>
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{n.content}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Assinatura ────────────────────────────────────────────── */}
        <div className="mt-10 border-t border-gray-200 pt-6">
          <div className="flex justify-between items-end">
            <div>
              <div className="mb-1 border-t border-gray-500 w-56" />
              <p className="font-semibold text-gray-800 text-sm">{pharmacist?.name ?? session.user.name ?? 'Farmacêutico(a)'}</p>
              {pharmacist?.crfNumber && <p className="text-gray-600">CRF: {pharmacist.crfNumber}</p>}
              {pharmacist?.specialization && <p className="text-gray-500 text-[10px]">{pharmacist.specialization}</p>}
              <p className="text-gray-500 text-[10px] mt-0.5">{pharmacist?.email ?? session.user.email}</p>
            </div>
            <div className="text-right">
              <div className="mb-1 border-t border-gray-400 w-40" />
              <p className="text-[10px] text-gray-500">Local e data</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 border-t border-gray-100 pt-3 text-[9px] text-gray-400 leading-relaxed">
          Relatório gerado automaticamente pelo PRM Care em {today}. As informações clínicas são de responsabilidade
          do profissional farmacêutico e baseiam-se nos dados inseridos no sistema. Documento confidencial — uso exclusivo do
          profissional de saúde responsável.
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { margin: 1.8cm; size: A4; }
          body { font-size: 10pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break-inside-avoid { page-break-inside: avoid; }
          details summary { display: none; }
          details { display: block; }
          details p { display: block !important; }
        }
      ` }} />
    </div>
  )
}
