import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { formatDate, formatRelative } from '@/lib/utils'
import { BookOpen, Plus, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import Link from 'next/link'

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  PENDING: { label: 'Pendente', badge: 'bg-yellow-100 text-yellow-800' },
  VALIDATED: { label: 'Validado', badge: 'bg-green-100 text-green-800' },
  EXPIRED: { label: 'Vencido', badge: 'bg-red-100 text-red-800' },
  ARCHIVED: { label: 'Arquivado', badge: 'bg-gray-100 text-gray-600' },
}

const TYPE_LABELS: Record<string, string> = {
  INTERACTION: 'Interação', CONTRAINDICATION: 'Contraindicação', DOSAGE: 'Dosagem',
  HEALTH_ALERT: 'Alerta Sanitário', PROTOCOL: 'Protocolo', PACKAGE_INSERT: 'Bula',
  GUIDELINE: 'Diretriz', ADVERSE_REACTION: 'Reação Adversa',
}

export default async function KnowledgePage() {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') redirect('/dashboard')

  const entries = await prisma.knowledgeBase.findMany({
    include: { createdBy: { select: { name: true, email: true } } },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 50,
  })

  const pendingCount = entries.filter(e => e.status === 'PENDING').length
  const expiredCount = entries.filter(e => e.status === 'EXPIRED').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="text-2xl font-bold text-gray-900">Base de Conhecimento Clínico</h1>
          <p className="text-gray-500">{entries.length} entrada(s) · {pendingCount} pendente(s) de validação</p>
        </div>
        <Link href="/admin/knowledge/new"
          className="flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#162d4a] transition-colors">
          <Plus className="h-4 w-4" /> Nova entrada
        </Link>
      </div>

      {(pendingCount > 0 || expiredCount > 0) && (
        <div className="flex gap-3">
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2.5 text-sm text-yellow-800">
              <Clock className="h-4 w-4" /> {pendingCount} entrada(s) aguardando validação
            </div>
          )}
          {expiredCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
              <AlertTriangle className="h-4 w-4" /> {expiredCount} entrada(s) vencida(s)
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Título</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Tipo</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Fonte</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Última revisão</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Criado por</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900 max-w-xs truncate">{entry.title}</p>
                  {entry.drugNames.length > 0 && (
                    <p className="text-xs text-gray-400">{entry.drugNames.slice(0, 3).join(', ')}</p>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-[#1e3a5f]">
                    {TYPE_LABELS[entry.type] || entry.type}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-500 max-w-xs truncate">
                  {entry.sourceUrl ? (
                    <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer"
                      className="hover:underline text-[#1e3a5f]">{entry.source}</a>
                  ) : entry.source}
                </td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CONFIG[entry.status]?.badge || ''}`}>
                    {STATUS_CONFIG[entry.status]?.label || entry.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-500">
                  {entry.lastReviewedAt ? formatRelative(entry.lastReviewedAt) : '—'}
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">
                  {entry.createdBy.name || entry.createdBy.email}
                </td>
                <td className="px-5 py-3">
                  <Link
                    href={`/admin/knowledge/${entry.id}`}
                    className="text-xs text-[#1e3a5f] hover:underline font-medium"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {entries.length === 0 && (
          <div className="py-16 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-gray-500">Base de conhecimento vazia</p>
            <Link href="/admin/knowledge/new" className="mt-2 inline-block text-sm text-[#1e3a5f] hover:underline">
              Adicionar primeira entrada
            </Link>
          </div>
        )}
      </div>

      {/* Sources guidance */}
      <div className="rounded-xl border border-blue-100 bg-[#eff6ff] p-5">
        <h3 className="font-semibold text-[#1e3a5f] mb-3">Fontes recomendadas para atualização</h3>
        <ul className="space-y-1.5 text-sm text-blue-700">
          {[
            'Bulário Eletrônico da Anvisa — bulario.anvisa.gov.br',
            'Protocolos Clínicos e Diretrizes Terapêuticas — Ministério da Saúde',
            'Diretrizes de sociedades científicas (SBC, SBEM, SBD, etc.)',
            'Bases licenciadas: Micromedex, Lexicomp, UpToDate (mediante contrato)',
            'Alertas de farmacovigilância — Anvisa',
          ].map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
              {s}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-blue-500">
          Nota: Não copie conteúdo protegido. Use apenas referência, resumo técnico próprio e link para a fonte original.
        </p>
      </div>
    </div>
  )
}
