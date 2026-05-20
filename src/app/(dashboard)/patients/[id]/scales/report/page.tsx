import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { SCALES, SEVERITY_BADGE_CLASSES, type ScaleType, type SeverityLevel } from '@/lib/scales'
import { calculateAge } from '@/lib/utils'

export default async function ScaleReportPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return null

  const [patient, assessments] = await Promise.all([
    prisma.patient.findFirst({
      where: { id: params.id, userId: session.user.id },
      select: {
        id: true, name: true, code: true, sex: true, age: true, dateOfBirth: true,
        diagnoses: { select: { name: true, icd10Code: true, isPrimary: true } },
      },
    }),
    prisma.scaleAssessment.findMany({
      where: { patientId: params.id },
      orderBy: [{ scaleType: 'asc' }, { appliedAt: 'desc' }],
      select: {
        id: true, scaleType: true, answers: true, totalScore: true,
        severity: true, notes: true, appliedAt: true,
        user: { select: { name: true, email: true, crfNumber: true } },
      },
    }),
  ])

  if (!patient) notFound()

  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : patient.age
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  const grouped: Record<string, typeof assessments> = {}
  for (const a of assessments) {
    if (!grouped[a.scaleType]) grouped[a.scaleType] = []
    grouped[a.scaleType].push(a)
  }

  function fmt(date: Date | string) {
    return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const severityLabel: Record<SeverityLevel, string> = {
    MINIMAL: 'Mínima',
    MILD: 'Leve',
    MODERATE: 'Moderada',
    MODERATELY_SEVERE: 'Moderadamente grave',
    SEVERE: 'Grave',
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Print button - hidden on print */}
      <div className="fixed top-4 right-4 print:hidden z-10">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-[#162d4a]"
        >
          🖨️ Imprimir / Salvar PDF
        </button>
      </div>

      <div className="mx-auto max-w-3xl px-8 py-10 print:px-6 print:py-8">
        {/* Report Header */}
        <div className="mb-8 border-b-2 border-[#1e3a5f] pb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#1e3a5f]">
                Relatório de Escalas Clínicas Validadas
              </h1>
              <p className="mt-1 text-sm text-gray-500">Emitido em {today}</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p className="font-semibold text-gray-700">PRM Care</p>
              <p>Cuidado Farmacêutico</p>
            </div>
          </div>
        </div>

        {/* Patient Info */}
        <div className="mb-6 rounded-lg border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">
            Dados do Paciente
          </h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-gray-500 w-20 shrink-0">Paciente:</span>
              <span className="font-semibold">{patient.name || patient.code}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-20 shrink-0">Código:</span>
              <span>{patient.code}</span>
            </div>
            {age && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-20 shrink-0">Idade:</span>
                <span>{age} anos</span>
              </div>
            )}
            {patient.sex && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-20 shrink-0">Sexo:</span>
                <span>{patient.sex === 'MALE' ? 'Masculino' : patient.sex === 'FEMALE' ? 'Feminino' : 'Outro'}</span>
              </div>
            )}
            {patient.diagnoses.length > 0 && (
              <div className="col-span-2 flex gap-2">
                <span className="text-gray-500 w-20 shrink-0">Diagnósticos:</span>
                <span>{patient.diagnoses.map((d) => d.name + (d.icd10Code ? ` (${d.icd10Code})` : '')).join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Assessment Summary Table */}
        {assessments.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">
              Resumo das Avaliações
            </h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="py-2 text-left text-gray-600 font-semibold">Escala</th>
                  <th className="py-2 text-left text-gray-600 font-semibold">Data</th>
                  <th className="py-2 text-center text-gray-600 font-semibold">Score</th>
                  <th className="py-2 text-left text-gray-600 font-semibold">Gravidade</th>
                  <th className="py-2 text-left text-gray-600 font-semibold">Profissional</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => {
                  const scale = SCALES[a.scaleType as ScaleType]
                  const sev = a.severity as SeverityLevel
                  return (
                    <tr key={a.id} className="border-b border-gray-100">
                      <td className="py-2 font-medium">{scale?.name ?? a.scaleType}</td>
                      <td className="py-2 text-gray-600">{fmt(a.appliedAt)}</td>
                      <td className="py-2 text-center font-bold">{a.totalScore}/{scale?.maxScore ?? '?'}</td>
                      <td className="py-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE_CLASSES[sev] ?? ''}`}>
                          {severityLabel[sev] ?? a.severity}
                        </span>
                      </td>
                      <td className="py-2 text-gray-600 text-xs">{a.user.name || a.user.email}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Detailed results by scale */}
        {Object.entries(grouped).map(([type, records]) => {
          const scale = SCALES[type as ScaleType]
          if (!scale) return null
          return (
            <div key={type} className="mb-8 page-break-inside-avoid">
              <h2 className="mb-1 text-base font-bold text-[#1e3a5f] border-b border-[#1e3a5f]/30 pb-1">
                {scale.name} — {scale.fullName}
              </h2>
              <p className="mb-4 text-xs text-gray-500 italic">{scale.reference}</p>

              {records.map((rec, idx) => {
                const sev = rec.severity as SeverityLevel
                const answers = rec.answers as Array<{ question: number; answer: number }>
                return (
                  <div key={rec.id} className={`mb-4 rounded-lg border border-gray-200 p-4 ${idx > 0 ? 'opacity-75' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-700">
                          Aplicação {idx === 0 ? '(mais recente)' : `#${records.length - idx}`}
                        </span>
                        <span className="text-xs text-gray-500">{fmt(rec.appliedAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">
                          {rec.totalScore}/{scale.maxScore} pontos
                        </span>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${SEVERITY_BADGE_CLASSES[sev] ?? ''}`}>
                          {severityLabel[sev] ?? rec.severity}
                        </span>
                      </div>
                    </div>

                    {/* Answers */}
                    <table className="w-full text-xs mb-3">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="pb-1 text-left text-gray-400 font-normal">#</th>
                          <th className="pb-1 text-left text-gray-400 font-normal">Questão</th>
                          <th className="pb-1 text-right text-gray-400 font-normal">Resposta</th>
                          <th className="pb-1 text-right text-gray-400 font-normal pr-1">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scale.questions.map((q) => {
                          const ans = answers.find((a) => a.question === q.id)
                          const opt = q.options.find((o) => o.value === ans?.answer)
                          const pts = ans?.answer ?? 0
                          return (
                            <tr key={q.id} className="border-b border-gray-50">
                              <td className="py-1 text-gray-400 w-5">{q.id}</td>
                              <td className="py-1 text-gray-700">{q.text}</td>
                              <td className={`py-1 text-right ${pts > 1 ? 'font-semibold text-orange-700' : 'text-gray-600'}`}>
                                {opt?.label ?? '—'}
                              </td>
                              <td className={`py-1 text-right pr-1 font-mono ${pts > 1 ? 'font-bold text-orange-700' : 'text-gray-500'}`}>
                                {pts}
                              </td>
                            </tr>
                          )
                        })}
                        <tr className="border-t border-gray-300">
                          <td colSpan={3} className="pt-1 text-right font-semibold text-gray-700">Total:</td>
                          <td className="pt-1 text-right pr-1 font-bold text-gray-900">{rec.totalScore}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Recommendation */}
                    <div className="rounded bg-gray-50 p-3 text-xs">
                      <p className="font-semibold text-gray-800 mb-1">Conduta farmacêutica sugerida</p>
                      <p className="text-gray-600">{scale.getRecommendation(sev)}</p>
                    </div>

                    {rec.notes && (
                      <div className="mt-2 rounded bg-blue-50 p-3 text-xs">
                        <p className="font-semibold text-blue-800 mb-1">Observações clínicas</p>
                        <p className="text-blue-700">{rec.notes}</p>
                      </div>
                    )}

                    <p className="mt-2 text-xs text-gray-400 text-right">
                      Aplicado por: {rec.user.name || rec.user.email}
                      {rec.user.crfNumber ? ` · CRF ${rec.user.crfNumber}` : ''}
                    </p>
                  </div>
                )
              })}
            </div>
          )
        })}

        {assessments.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            Nenhuma avaliação registrada para este paciente.
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-400">
          <p>
            Este relatório foi gerado automaticamente pelo PRM Care em {today}.
            Os instrumentos utilizados (GAD-7, PHQ-9, AUDIT-C, Morisky-4) são escalas validadas de domínio público.
            O conteúdo deste documento é de uso exclusivo do profissional farmacêutico responsável e não substitui avaliação médica ou psicológica.
          </p>
          <div className="mt-4 flex justify-between">
            <div>
              <p className="font-semibold text-gray-600">Farmacêutico(a) responsável</p>
              <div className="mt-6 border-t border-gray-400 w-48" />
              <p className="mt-1">Assinatura / CRF</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-600">Local e data</p>
              <div className="mt-6 border-t border-gray-400 w-48" />
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 1.5cm; }
          .print\\:hidden { display: none !important; }
          .page-break-inside-avoid { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}
