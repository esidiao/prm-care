import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { calculateAge, PRM_CATEGORY_LABELS, RISK_LEVEL_CONFIG } from '@/lib/utils'
import { ReferralPrintButton } from '@/components/patients/ReferralPrintButton'

const RISK_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MODERATE: 2, LOW: 3 }

export default async function ReferralPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return null

  const [patient, pharmacist] = await Promise.all([
    prisma.patient.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: {
        diagnoses: true,
        comorbidities: true,
        allergies: true,
        medications: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
        analyses: {
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            findings: {
              orderBy: { createdAt: 'asc' },
              include: { medication: { select: { activeIngredient: true, tradeName: true, dose: true, doseUnit: true } } },
            },
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, crfNumber: true, specialization: true, institution: true },
    }),
  ])

  if (!patient) notFound()

  const analysis = patient.analyses[0] ?? null
  const findings = analysis
    ? [...analysis.findings].sort(
        (a, b) => (RISK_ORDER[a.riskLevel] ?? 9) - (RISK_ORDER[b.riskLevel] ?? 9),
      )
    : []

  const referralFindings = findings.filter((f) => f.needsReferral || f.needsPrescriberContact)
  const otherFindings = findings.filter((f) => !f.needsReferral && !f.needsPrescriberContact)

  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : patient.age
  const today = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const todayShort = new Date().toLocaleDateString('pt-BR')

  const primaryDiagnosis = patient.diagnoses.find((d) => d.isPrimary) ?? patient.diagnoses[0]

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Toolbar — hidden on print */}
      <div className="fixed top-4 right-4 z-10 flex gap-2 print:hidden">
        <a
          href={`/patients/${patient.id}`}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow hover:bg-gray-50"
        >
          ← Voltar
        </a>
        <ReferralPrintButton />
      </div>

      {/* Letter */}
      <div className="mx-auto max-w-[720px] px-10 py-12 print:px-8 print:py-10 font-serif">

        {/* Header institution */}
        <div className="mb-8 border-b-2 border-gray-800 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-sans uppercase tracking-widest text-gray-500 mb-1">
                Serviço de Atenção Farmacêutica
              </p>
              <h1 className="text-xl font-bold text-gray-900">
                {pharmacist?.institution ?? 'Estabelecimento de Saúde'}
              </h1>
              {pharmacist?.specialization && (
                <p className="text-sm text-gray-500 mt-0.5">{pharmacist.specialization}</p>
              )}
            </div>
            <div className="text-right text-xs font-sans text-gray-500">
              <p>{todayShort}</p>
              {pharmacist?.crfNumber && <p className="mt-0.5">CRF: {pharmacist.crfNumber}</p>}
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="mb-8 text-center">
          <h2 className="text-lg font-bold uppercase tracking-wider text-gray-800">
            Carta de Encaminhamento / Comunicação Farmacêutico-Médico
          </h2>
          <p className="mt-1 text-sm text-gray-500 font-sans">
            Referente à Revisão da Farmacoterapia — Método Dáder
          </p>
        </div>

        {/* Salutation */}
        <p className="mb-6 text-sm leading-relaxed">
          Prezado(a) Médico(a) Prescritor(a),
        </p>

        {/* Opening paragraph */}
        <p className="mb-6 text-sm leading-relaxed text-justify">
          Venho, por meio desta, encaminhar as observações farmacêuticas referentes ao
          acompanhamento farmacoterapêutico do(a) paciente identificado(a) abaixo,
          realizado conforme o <strong>Método Dáder de Seguimento Farmacoterapêutico</strong>.
          Durante a revisão da farmacoterapia{analysis ? ` em ${new Date(analysis.createdAt).toLocaleDateString('pt-BR')}` : ''}{' '}
          foram identificados Problemas Relacionados a Medicamentos (PRMs) que requerem
          avaliação e/ou intervenção médica.
        </p>

        {/* Patient data box */}
        <div className="mb-6 rounded border border-gray-300 p-4 font-sans text-sm bg-gray-50 print:bg-gray-50">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            Identificação do Paciente
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <div className="flex gap-2">
              <span className="text-gray-500 w-24 shrink-0">Paciente:</span>
              <span className="font-semibold">{patient.name || patient.code}</span>
            </div>
            {age && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-24 shrink-0">Idade:</span>
                <span>{age} anos</span>
              </div>
            )}
            {patient.sex && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-24 shrink-0">Sexo:</span>
                <span>{patient.sex === 'MALE' ? 'Masculino' : patient.sex === 'FEMALE' ? 'Feminino' : 'Outro'}</span>
              </div>
            )}
            {primaryDiagnosis && (
              <div className="flex gap-2 col-span-2">
                <span className="text-gray-500 w-24 shrink-0">Diagnóstico:</span>
                <span>{primaryDiagnosis.name}{primaryDiagnosis.icd10Code ? ` (${primaryDiagnosis.icd10Code})` : ''}</span>
              </div>
            )}
            {patient.comorbidities.length > 0 && (
              <div className="flex gap-2 col-span-2">
                <span className="text-gray-500 w-24 shrink-0">Comorbidades:</span>
                <span>{patient.comorbidities.map((c) => c.name).join(', ')}</span>
              </div>
            )}
            {patient.allergies.length > 0 && (
              <div className="flex gap-2 col-span-2">
                <span className="text-gray-500 w-24 shrink-0 text-red-600 font-medium">Alergias:</span>
                <span className="text-red-700 font-medium">{patient.allergies.map((a) => a.substance).join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Medications */}
        {patient.medications.length > 0 && (
          <div className="mb-6 font-sans text-sm">
            <p className="mb-2 font-bold text-gray-800">Farmacoterapia Atual</p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-300 text-gray-500">
                  <th className="py-1.5 text-left font-semibold">Medicamento</th>
                  <th className="py-1.5 text-left font-semibold">Dose</th>
                  <th className="py-1.5 text-left font-semibold">Frequência</th>
                  <th className="py-1.5 text-left font-semibold">Via</th>
                  <th className="py-1.5 text-left font-semibold">Indicação</th>
                </tr>
              </thead>
              <tbody>
                {patient.medications.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100">
                    <td className="py-1.5 font-medium text-gray-900">
                      {m.activeIngredient}
                      {m.tradeName ? <span className="text-gray-400 font-normal"> ({m.tradeName})</span> : ''}
                    </td>
                    <td className="py-1.5 text-gray-700">
                      {m.dose ? `${m.dose} ${m.doseUnit ?? ''}`.trim() : '—'}
                    </td>
                    <td className="py-1.5 text-gray-700">{m.frequency ?? '—'}</td>
                    <td className="py-1.5 text-gray-700">{m.route ?? '—'}</td>
                    <td className="py-1.5 text-gray-700">{m.indication ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PRMs requiring referral / prescriber contact */}
        {findings.length > 0 && (
          <div className="mb-6 font-sans text-sm">
            <p className="mb-3 font-bold text-gray-800">
              Problemas Relacionados a Medicamentos (PRMs) Identificados
            </p>

            {referralFindings.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">
                  ⚠️ Requerem avaliação / intervenção médica
                </p>
                <div className="space-y-3">
                  {referralFindings.map((f, i) => {
                    const riskCfg = RISK_LEVEL_CONFIG[f.riskLevel as keyof typeof RISK_LEVEL_CONFIG]
                    return (
                      <div key={f.id} className="rounded border-l-4 pl-3 py-2 pr-2 border-red-400 bg-red-50 print:bg-red-50">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-red-800">PRM {i + 1}</span>
                          <span className="text-xs font-semibold text-gray-700">{f.title}</span>
                          <span className="ml-auto text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-200 text-red-800">
                            {riskCfg?.label ?? f.riskLevel}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed mb-1">{f.description}</p>
                        {f.pharmacistConduct && (
                          <p className="text-xs text-gray-600">
                            <strong>Conduta sugerida:</strong> {f.pharmacistConduct}
                          </p>
                        )}
                        {f.medication && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Medicamento: <strong>{f.medication.activeIngredient}</strong>
                            {f.medication.dose ? ` ${f.medication.dose} ${f.medication.doseUnit ?? ''}` : ''}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {otherFindings.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Demais PRMs identificados (para conhecimento)
                </p>
                <div className="space-y-2">
                  {otherFindings.map((f, i) => {
                    const riskCfg = RISK_LEVEL_CONFIG[f.riskLevel as keyof typeof RISK_LEVEL_CONFIG]
                    return (
                      <div key={f.id} className="rounded border border-gray-200 px-3 py-2 bg-gray-50 print:bg-gray-50">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-gray-700">{f.title}</span>
                          <span className="ml-auto text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                            {riskCfg?.label ?? f.riskLevel}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">{f.description}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {findings.length === 0 && (
          <p className="mb-6 text-sm text-gray-500 italic font-sans">
            Nenhum PRM identificado na análise mais recente.
          </p>
        )}

        {/* Closing */}
        <p className="mb-6 text-sm leading-relaxed text-justify">
          Coloco-me à disposição para discutir os achados acima e colaborar na
          otimização da farmacoterapia deste(a) paciente. Caso necessário, posso
          fornecer informações adicionais sobre as evidências clínicas que
          embasaram cada PRM identificado.
        </p>

        {/* Signature block */}
        <div className="mt-10 font-sans text-sm">
          <p className="mb-1 text-gray-600">{today}</p>
          <p className="mb-8 text-gray-600">
            {pharmacist?.institution ?? '___________________________'}
          </p>

          <div className="flex justify-between items-end">
            <div>
              <div className="mb-1 border-t border-gray-500 w-64" />
              <p className="font-semibold text-gray-800">{pharmacist?.name ?? session.user.name ?? 'Farmacêutico(a)'}</p>
              {pharmacist?.crfNumber && (
                <p className="text-gray-600">CRF: {pharmacist.crfNumber}</p>
              )}
              {pharmacist?.specialization && (
                <p className="text-gray-500 text-xs">{pharmacist.specialization}</p>
              )}
              <p className="text-gray-500 text-xs mt-0.5">{pharmacist?.email ?? session.user.email}</p>
            </div>

            <div className="text-right text-xs text-gray-400">
              <p>Gerado pelo PRM Care</p>
              <p>Método Dáder de Seguimento</p>
              <p>Farmacoterapêutico</p>
            </div>
          </div>
        </div>

        {/* Footer disclaimer */}
        <div className="mt-10 border-t border-gray-200 pt-4 text-[10px] text-gray-400 font-sans leading-relaxed">
          Este documento é uma comunicação entre profissionais de saúde gerada pelo sistema PRM Care.
          As informações clínicas são de responsabilidade do farmacêutico signatário e baseiam-se
          nos dados inseridos no sistema. Não substitui a avaliação médica. Documento gerado em {today}.
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { margin: 2cm; size: A4; }
          body { font-size: 11pt; }
          .print\\:hidden { display: none !important; }
        }
      ` }} />
    </div>
  )
}
