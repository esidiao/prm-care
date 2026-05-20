import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import { Plus, Users, FlaskConical, Calendar, ChevronRight } from 'lucide-react'
import { formatDate, calculateAge } from '@/lib/utils'
import { ExportMenu } from '@/components/export/ExportMenu'

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
        <div className="flex items-center gap-2">
          {patients.length > 0 && <ExportMenu mode="all" />}
          <Link href="/patients/new" className="btn-primary">
            <Plus className="h-4 w-4" /> Novo paciente
          </Link>
        </div>
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
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header-cell">Paciente</th>
                <th className="table-header-cell">Idade / Sexo</th>
                <th className="table-header-cell">Análises</th>
                <th className="table-header-cell">Última análise</th>
                <th className="table-header-cell">Alertas</th>
                <th className="table-header-cell w-36"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {patients.map((patient) => {
                const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : patient.age
                const lastAnalysis = patient.analyses[0]
                const sexLabel = patient.sex === 'MALE' ? 'M' : patient.sex === 'FEMALE' ? 'F' : patient.sex ? 'Outro' : null
                const initials = (patient.name || patient.code).slice(0, 2).toUpperCase()
                return (
                  <tr key={patient.id} className="hover:bg-gray-50/70 transition-colors group">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f]/10 text-xs font-bold text-[#1e3a5f]">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{patient.name || patient.code}</p>
                          {patient.name && <p className="text-xs text-gray-400">{patient.code}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-gray-600">
                      {age ? `${age} anos` : '—'}
                      {sexLabel && <span className="ml-1.5 inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">{sexLabel}</span>}
                    </td>
                    <td className="table-cell">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {patient._count.analyses}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500">
                      {lastAnalysis ? (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          {formatDate(lastAnalysis.createdAt)}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-1">
                        {lastAnalysis?.urgentPRMs ? (
                          <span className="risk-badge-urgent">{lastAnalysis.urgentPRMs} urgente</span>
                        ) : null}
                        {lastAnalysis?.highRiskPRMs ? (
                          <span className="risk-badge-high">{lastAnalysis.highRiskPRMs} alto</span>
                        ) : null}
                        {!lastAnalysis?.urgentPRMs && !lastAnalysis?.highRiskPRMs && lastAnalysis?.totalPRMs ? (
                          <span className="risk-badge-low">{lastAnalysis.totalPRMs} PRM</span>
                        ) : null}
                        {!lastAnalysis && <span className="text-xs text-gray-400">Sem análise</span>}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/patients/${patient.id}`}
                          className="btn-secondary px-3 py-1.5 text-xs">
                          Ver perfil
                        </Link>
                        <Link href={`/analysis/new?patientId=${patient.id}`}
                          className="btn-primary px-3 py-1.5 text-xs">
                          <FlaskConical className="h-3 w-3" /> Analisar
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
