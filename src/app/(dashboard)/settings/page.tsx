import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { formatDateTime } from '@/lib/utils'
import { Shield, User, Coins, Bell } from 'lucide-react'

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { consents: { orderBy: { acceptedAt: 'desc' } } },
  })

  const PLAN_LABELS: Record<string, string> = {
    FREE: 'Gratuito', BASIC: 'Básico', PROFESSIONAL: 'Profissional', INSTITUTIONAL: 'Institucional'
  }
  const CONSENT_LABELS: Record<string, string> = {
    TERMS_OF_USE: 'Termos de Uso', PRIVACY_POLICY: 'Política de Privacidade',
    DATA_PROCESSING: 'Tratamento de Dados', CLINICAL_DISCLAIMER: 'Aviso Clínico'
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="page-header">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500">Gerencie sua conta e preferências</p>
      </div>

      {/* Profile */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900 flex items-center gap-2">
          <User className="h-4 w-4 text-[#1e3a5f]" /> Perfil
        </h2>
        <dl className="space-y-3 text-sm">
          {[
            { label: 'Nome', value: user?.name || '—' },
            { label: 'Email', value: user?.email || '—' },
            { label: 'Perfil', value: user?.role || '—' },
            { label: 'Plano', value: PLAN_LABELS[user?.plan || 'FREE'] },
            { label: 'CRF', value: user?.crfNumber || 'Não informado' },
            { label: 'Instituição', value: user?.institution || 'Não informada' },
            { label: 'Membro desde', value: user?.createdAt ? formatDateTime(user.createdAt) : '—' },
            { label: 'Último acesso', value: user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between gap-2 border-b pb-2 last:border-0 last:pb-0">
              <dt className="text-gray-500">{label}</dt>
              <dd className="font-medium text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Plan */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900 flex items-center gap-2">
          <Coins className="h-4 w-4 text-[#1e3a5f]" /> Plano e tokens
        </h2>
        <div className="flex items-center justify-between rounded-lg bg-[#eff6ff] p-4">
          <div>
            <p className="font-semibold text-[#1e3a5f]">Plano {PLAN_LABELS[user?.plan || 'FREE']}</p>
            <p className="text-sm text-blue-700">Saldo: {user?.tokenBalance ?? 0} tokens</p>
          </div>
          <a href="/tokens" className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#162d4a] transition-colors">
            Comprar tokens
          </a>
        </div>
      </div>

      {/* Consents (LGPD) */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900 flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#1e3a5f]" /> Consentimentos LGPD
        </h2>
        <div className="space-y-2">
          {user?.consents.map(consent => (
            <div key={consent.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-900">{CONSENT_LABELS[consent.type] || consent.type}</p>
                <p className="text-xs text-gray-400">v{consent.version} · {formatDateTime(consent.acceptedAt)}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${consent.accepted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {consent.accepted ? 'Aceito' : 'Recusado'}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-400">
          Para exercer seus direitos LGPD (acesso, correção, exclusão de dados), envie email para{' '}
          <a href="mailto:privacidade@prmcare.com.br" className="text-[#1e3a5f] underline">privacidade@prmcare.com.br</a>
        </p>
      </div>

      {/* Security */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900 flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#1e3a5f]" /> Segurança
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Autenticação em dois fatores</p>
              <p className="text-xs text-gray-400">Adicione uma camada extra de segurança</p>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
              {user?.twoFactorEnabled ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <a href="/settings/change-password"
            className="block rounded-lg border px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-center">
            Alterar senha
          </a>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="mb-3 font-semibold text-red-800">Zona de risco</h2>
        <p className="mb-4 text-sm text-red-700">
          A exclusão da conta é permanente e remove todos os seus dados, análises e relatórios.
          Esta ação não pode ser desfeita.
        </p>
        <button className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors">
          Solicitar exclusão de conta
        </button>
      </div>
    </div>
  )
}
