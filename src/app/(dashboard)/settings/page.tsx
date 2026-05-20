import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { formatDateTime } from '@/lib/utils'
import { Shield, User, Coins, Key } from 'lucide-react'
import { ProfileForm, PasswordForm } from '@/components/settings/ProfileForm'

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Gratuito', BASIC: 'Básico', PROFESSIONAL: 'Profissional', INSTITUTIONAL: 'Institucional',
}
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', PROFESSIONAL: 'Farmacêutico', STUDENT: 'Estudante', INSTITUTIONAL_MANAGER: 'Gestor',
}
const CONSENT_LABELS: Record<string, string> = {
  TERMS_OF_USE: 'Termos de Uso', PRIVACY_POLICY: 'Política de Privacidade',
  DATA_PROCESSING: 'Tratamento de Dados', CLINICAL_DISCLAIMER: 'Aviso Clínico',
}

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, role: true, plan: true,
      crfNumber: true, specialization: true, institution: true,
      tokenBalance: true, twoFactorEnabled: true, password: true,
      createdAt: true, lastLoginAt: true,
      consents: { orderBy: { acceptedAt: 'desc' } },
    },
  })

  if (!user) return null

  return (
    <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Configurações</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie sua conta e preferências</p>
      </div>

      {/* ── Dados da conta (read-only) ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" /> Dados da conta
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {[
            { label: 'Perfil', value: ROLE_LABELS[user.role] ?? user.role },
            { label: 'Plano', value: PLAN_LABELS[user.plan] ?? user.plan },
            { label: 'Tokens', value: user.plan === 'INSTITUTIONAL' ? '∞ Ilimitado' : String(user.tokenBalance) },
            { label: 'Membro desde', value: formatDateTime(user.createdAt) },
            { label: 'Último acesso', value: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col">
              <dt className="text-xs text-gray-400 dark:text-gray-500">{label}</dt>
              <dd className="font-medium text-gray-800 dark:text-gray-200">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ── Editar perfil ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" /> Editar perfil
        </h2>
        <ProfileForm
          profile={{
            name: user.name,
            email: user.email,
            crfNumber: user.crfNumber,
            specialization: user.specialization,
            institution: user.institution,
            hasPassword: !!user.password,
          }}
        />
      </div>

      {/* ── Plano e tokens ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
          <Coins className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" /> Plano e tokens
        </h2>
        <div className="flex items-center justify-between rounded-xl bg-[#eff6ff] dark:bg-[#1e3a5f]/20 p-4">
          <div>
            <p className="font-semibold text-[#1e3a5f] dark:text-blue-300">Plano {PLAN_LABELS[user.plan]}</p>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              {user.plan === 'INSTITUTIONAL' ? 'Acesso ilimitado' : `Saldo: ${user.tokenBalance} tokens`}
            </p>
          </div>
          {user.plan !== 'INSTITUTIONAL' && (
            <a
              href="/tokens"
              className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#162d4a] transition-colors"
            >
              Comprar tokens
            </a>
          )}
        </div>
      </div>

      {/* ── Segurança / Senha ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
          <Key className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" /> Alterar senha
        </h2>
        {!user.password ? (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-300">Conta sem senha local</p>
            <p className="mt-1 text-amber-700 dark:text-amber-400">
              Você entrou via SSO (Google/Microsoft). Defina uma senha para poder entrar também por e-mail e senha.
            </p>
          </div>
        ) : null}
        <div className={!user.password ? 'mt-4' : ''}>
          <PasswordForm hasPassword={!!user.password} />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 px-4 py-3 text-sm">
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">Autenticação em dois fatores</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Camada extra de segurança (TOTP)</p>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            user.twoFactorEnabled ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            {user.twoFactorEnabled ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      </div>

      {/* ── Consentimentos LGPD ── */}
      {user.consents.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" /> Consentimentos LGPD
          </h2>
          <div className="space-y-2">
            {user.consents.map((consent) => (
              <div key={consent.id} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {CONSENT_LABELS[consent.type] ?? consent.type}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    v{consent.version} · {formatDateTime(consent.acceptedAt)}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  consent.accepted
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                }`}>
                  {consent.accepted ? 'Aceito' : 'Recusado'}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
            Para exercer seus direitos LGPD (acesso, correção, exclusão),{' '}
            <a href="mailto:privacidade@prmcare.com.br" className="text-[#1e3a5f] dark:text-blue-400 underline">
              entre em contato
            </a>
          </p>
        </div>
      )}

      {/* ── Zona de risco ── */}
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-5">
        <h2 className="mb-2 font-semibold text-red-800 dark:text-red-300 text-sm">Zona de risco</h2>
        <p className="mb-4 text-sm text-red-700 dark:text-red-400">
          A exclusão da conta é permanente e remove todos os dados, análises e relatórios. Esta ação não pode ser desfeita.
        </p>
        <button className="rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
          Solicitar exclusão de conta
        </button>
      </div>
    </div>
  )
}
