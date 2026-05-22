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
          <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {patients.length} paciente{patients.length !== 1 ? 's' : ''} cadastrado{patients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/patients/new" className="btn-primary">
          <Plus className="h-4 w-4" /> Novo paciente
        </Link>
      </div>

      {patients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white overflow-hidden">
          {/* Visual header */}
          <div className="bg-gradient-to-br from-[#0f2744] to-[#1e3a5f] px-8 py-10 text-center text-white">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 mb-4">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold">Nenhum paciente ainda</h3>
            <p className="text-white/60 text-sm mt-1 max-w-xs mx-auto">
              Comece cadastrando um paciente para realizar o seguimento farmacoterapêutico pelo Método Dáder.
            </p>
            <Link href="/patients/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-[#1e3a5f] hover:bg-blue-50 transition-colors shadow-sm">
              <Plus className="h-4 w-4" /> Cadastrar primeiro paciente
            </Link>
          </div>

          {/* Passos seguintes */}
          <div className="px-8 py-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Como funciona</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { step: '1', icon: Users, color: 'bg-blue-100 text-blue-700', title: 'Cadastrar paciente', desc: 'Dados clínicos, medicamentos, diagnósticos e comorbidades' },
                { step: '2', icon: FlaskConical, color: 'bg-purple-100 text-purple-700', title: 'Analisar PRMs', desc: 'IA + regras Dáder identificam problemas farmacoterapêuticos' },
                { step: '3', icon: FileText, color: 'bg-emerald-100 text-emerald-700', title: 'Gerar relatório', desc: 'Documentação clínica e carta ao médico prescritor' },
              ].map(({ step, icon: Icon, color, title, desc }) => (
                <div key={step} className="flex gap-3">
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${color} text-xs font-bold`}>
                    {step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-center">
              <GuidedTour
                trigger={
                  <button className="flex items-center gap-2 text-sm text-[#1e3a5f] hover:underline">
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
