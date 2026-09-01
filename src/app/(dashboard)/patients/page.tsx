import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import { Plus, Users, FlaskConical, FileText, Sparkles } from 'lucide-react'
import { PatientsTable } from '@/components/patients/PatientsTable'
import { GuidedTour } from '@/components/onboarding/GuidedTour'

async function getPatients(userId: string) {
  return prisma.patient.findMany({
    where: { userId, isActive: true },
    include: {
      _count: { select: { analyses: true } },
      analyses: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true, urgentPRMs: true, highRiskPRMs: true, totalPRMs: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export default async function PatientsPage() {
  const session = await getSession()
  if (!session) return null
  const patients = await getPatients(session.user.id)

  // Serialize dates so the client component receives plain objects
  const serialized = patients.map(p => ({
    ...p,
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth : null,
    updatedAt: p.updatedAt,
    analyses: p.analyses.map(a => ({ ...a, createdAt: a.createdAt })),
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-lg">Pacientes</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {patients.length} paciente{patients.length !== 1 ? 's' : ''} cadastrado{patients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/patients/new" className="btn-primary">
          <Plus className="h-4 w-4" /> Novo paciente
        </Link>
      </div>

      {patients.length === 0 ? (
        <div className="card overflow-hidden border-dashed">
          {/* Hero */}
          <div className="bg-gradient-to-br from-brand-900 to-brand-800 px-8 py-10 text-center text-white">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold">Nenhum paciente ainda</h3>
            <p className="mx-auto mt-1 max-w-xs text-sm text-white/60">
              Comece cadastrando um paciente para realizar o seguimento farmacoterapêutico pelo Método Dáder.
            </p>
            <Link
              href="/patients/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-card px-5 py-2.5 text-sm font-bold text-brand-800 shadow-sm transition-colors hover:bg-brand-50"
            >
              <Plus className="h-4 w-4" /> Cadastrar primeiro paciente
            </Link>
          </div>

          {/* Passos */}
          <div className="bg-card px-8 py-6">
            <p className="section-label mb-4">Como funciona</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { step: '1', icon: Users,       color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',     title: 'Cadastrar paciente', desc: 'Dados clínicos, medicamentos, diagnósticos e comorbidades' },
                { step: '2', icon: FlaskConical, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', title: 'Analisar PRMs',       desc: 'IA + regras Dáder identificam problemas farmacoterapêuticos' },
                { step: '3', icon: FileText,     color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', title: 'Gerar relatório',    desc: 'Documentação clínica e carta ao médico prescritor' },
              ].map(({ step, icon: Icon, color, title, desc }) => (
                <div key={step} className="flex gap-3">
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${color}`}>
                    {step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-center">
              <GuidedTour
                trigger={
                  <button className="flex items-center gap-2 text-sm text-brand-800 hover:underline dark:text-brand-400">
                    <Sparkles className="h-3.5 w-3.5" /> Ver tour completo do sistema
                  </button>
                }
              />
            </div>
          </div>
        </div>
      ) : (
        <PatientsTable patients={serialized as any} />
      )}
    </div>
  )
}
