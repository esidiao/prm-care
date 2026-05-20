// Server component — detects medications that were referenced in recent PRM
// analyses but are no longer active (possible discontinuation)
import { AlertTriangle, Pill } from 'lucide-react'
import prisma from '@/lib/prisma'

interface Props {
  patientId: string
}

// Drug substrings considered high clinical risk if discontinued without reason
const HIGH_RISK_PATTERNS = [
  // Cardiovascular
  'metoprolol','bisoprolol','carvedilol','atenolol','propranolol',
  'enalapril','lisinopril','ramipril','captopril',
  'losartan','valsartan','olmesartan','candesartan',
  'amiodarona','amiodarone','digoxina','digoxin',
  'warfarina','warfarin','acenocumarol',
  'rivaroxabana','apixabana','dabigatrana','edoxabana',
  'sinvastatina','atorvastatina','rosuvastatina','pravastatina',
  // CNS
  'levodopa','carbidopa','pramipexol','rotigotina',
  'clonazepam','diazepam','lorazepam','alprazolam','bromazepam',
  'fenitoína','valproato','carbamazepina','lamotrigina','topiramato','levetiracetam',
  'lítio','lithium',
  'haloperidol','risperidona','olanzapina','quetiapina','clozapina','aripiprazol',
  'fluoxetina','sertralina','escitalopram','citalopram','paroxetina','venlafaxina','duloxetina',
  // Endocrine
  'insulina','insulin','glargina','detemir','degludec',
  'levotiroxina','levothyroxine',
  'prednisolona','prednisona','dexametasona','hidrocortisona','budesonida',
  // Respiratory
  'formoterol','salmeterol','indacaterol',
  'tiotrópio','umeclidínio','glicopirrônio',
  // Immunosuppressants
  'metotrexato','methotrexate','azatioprina','micofenolato','tacrolimus','ciclosporina',
]

function isHighRisk(name: string): boolean {
  const lower = name.toLowerCase()
  return HIGH_RISK_PATTERNS.some((p) => lower.includes(p))
}

export async function MedDiscontinuationAlert({ patientId }: Props) {
  // Medications currently inactive for this patient
  let inactiveMeds: Array<{ id: string; activeIngredient: string; tradeName: string | null; updatedAt: Date }> = []
  let recentFindings: Array<{ medicationId: string | null }> = []

  try {
    ;[inactiveMeds, recentFindings] = await Promise.all([
      prisma.medication.findMany({
        where: { patientId, isActive: false },
        select: { id: true, activeIngredient: true, tradeName: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      prisma.pRMFinding.findMany({
        where: { medicationId: { not: null }, analysis: { patientId } },
        select: { medicationId: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])
  } catch {
    return null
  }

  if (!inactiveMeds.length) return null

  // Find inactive meds that were referenced in PRM findings
  const referencedIds = new Set(recentFindings.map((f) => f.medicationId).filter(Boolean))
  const discontinuedWithPRMs = inactiveMeds.filter((m) => referencedIds.has(m.id))

  // Also flag high-risk drugs discontinued in the last 60 days regardless of PRM reference
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
  const recentHighRisk = inactiveMeds.filter(
    (m) =>
      isHighRisk(m.activeIngredient) &&
      new Date(m.updatedAt) > sixtyDaysAgo &&
      !discontinuedWithPRMs.find((d) => d.id === m.id),
  )

  const toShow = [...discontinuedWithPRMs, ...recentHighRisk]
  if (!toShow.length) return null

  const highRisk = toShow.filter((m) => isHighRisk(m.activeIngredient))
  const others = toShow.filter((m) => !isHighRisk(m.activeIngredient))

  return (
    <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
            Interrupção de medicamento(s) detectada
          </h3>
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
            {toShow.length} medicamento{toShow.length > 1 ? 's' : ''} marcado{toShow.length > 1 ? 's' : ''} como inativo{toShow.length > 1 ? 's' : ''} — verifique se a descontinuação foi intencional.
          </p>

          {highRisk.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">
                ⚠️ Alto risco clínico
              </p>
              <div className="flex flex-wrap gap-1.5">
                {highRisk.map((m) => (
                  <span key={m.id}
                    className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:text-red-300">
                    <Pill className="h-3 w-3 flex-shrink-0" />
                    {m.activeIngredient}{m.tradeName ? ` (${m.tradeName})` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {others.map((m) => (
                <span key={m.id}
                  className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-300">
                  <Pill className="h-3 w-3 flex-shrink-0" />
                  {m.activeIngredient}
                </span>
              ))}
            </div>
          )}

          <p className="mt-3 text-xs text-amber-600 dark:text-amber-500 leading-relaxed">
            Possíveis causas: reação adversa, falta de acesso, descontinuação médica, baixa adesão.
            Recomenda-se verificar com o paciente e registrar o motivo no prontuário.
          </p>
        </div>
      </div>
    </div>
  )
}
