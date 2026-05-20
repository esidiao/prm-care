import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { PatientsTable } from '@/components/patients/PatientsTable'

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
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 mb-4">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-700">Nenhum paciente cadastrado</h3>
          <p className="mt-1 text-sm text-gray-400 max-w-xs">
            Cadastre o primeiro paciente para iniciar o seguimento farmacoterapêutico
          </p>
          <Link href="/patients/new" className="btn-primary mt-6">
            <Plus className="h-4 w-4" /> Cadastrar paciente
          </Link>
        </div>
      ) : (
        <PatientsTable patients={serialized as any} />
      )}
    </div>
  )
}
