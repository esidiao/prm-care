'use client'
import { useState } from 'react'
import { Save, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface ProfileData {
  name: string | null
  email: string
  crfNumber: string | null
  specialization: string | null
  institution: string | null
  hasPassword: boolean
}

// ── Profile fields form ────────────────────────────────────────────────────────

export function ProfileForm({ profile }: { profile: ProfileData }) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    name: profile.name ?? '',
    crfNumber: profile.crfNumber ?? '',
    specialization: profile.specialization ?? '',
    institution: profile.institution ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
      toast({
        title: 'Perfil atualizado',
        description: 'Suas informações foram salvas com sucesso.',
        variant: 'success',
      } as Parameters<typeof toast>[0])
      setTimeout(() => setSaved(false), 3000)
    } catch {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível atualizar o perfil. Tente novamente.',
        variant: 'destructive',
      } as Parameters<typeof toast>[0])
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Nome completo
          </label>
          <input
            type="text"
            value={form.name}
            onChange={set('name')}
            placeholder="Seu nome"
            className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
            E-mail
          </label>
          <input
            type="email"
            value={profile.email}
            disabled
            className="h-10 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 text-sm text-gray-500 cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-400">O e-mail não pode ser alterado</p>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
            CRF (Conselho Regional de Farmácia)
          </label>
          <input
            type="text"
            value={form.crfNumber}
            onChange={set('crfNumber')}
            placeholder="Ex: SP-123456"
            className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Especialização
          </label>
          <input
            type="text"
            value={form.specialization}
            onChange={set('specialization')}
            placeholder="Ex: Farmácia Clínica, Oncologia…"
            className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Instituição / Local de trabalho
          </label>
          <input
            type="text"
            value={form.institution}
            onChange={set('institution')}
            placeholder="Ex: Hospital das Clínicas de SP"
            className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#162d4a] disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}

// ── Change password form ───────────────────────────────────────────────────────

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [show, setShow] = useState({ current: false, new: false, confirm: false })
  const [saving, setSaving] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const strength = (() => {
    const p = form.newPassword
    let score = 0
    if (p.length >= 8) score++
    if (/[A-Z]/.test(p)) score++
    if (/[0-9]/.test(p)) score++
    if (/[^A-Za-z0-9]/.test(p)) score++
    return score
  })()

  const strengthLabel = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'][strength]
  const strengthColor = ['', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-400'][strength]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.newPassword !== form.confirmPassword) {
      toast({ title: 'Senhas não coincidem', variant: 'destructive' } as Parameters<typeof toast>[0])
      return
    }
    if (form.newPassword.length < 8) {
      toast({ title: 'A senha deve ter pelo menos 8 caracteres', variant: 'destructive' } as Parameters<typeof toast>[0])
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.currentPassword || undefined,
          newPassword: form.newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      toast({
        title: 'Senha alterada',
        description: 'Sua senha foi atualizada com sucesso.',
        variant: 'success',
      } as Parameters<typeof toast>[0])
    } catch (err) {
      toast({
        title: 'Erro ao alterar senha',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      } as Parameters<typeof toast>[0])
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {hasPassword && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Senha atual
          </label>
          <div className="relative">
            <input
              type={show.current ? 'text' : 'password'}
              value={form.currentPassword}
              onChange={set('currentPassword')}
              placeholder="••••••••"
              required
              className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
            />
            <button type="button" onClick={() => setShow((s) => ({ ...s, current: !s.current }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {show.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Nova senha
          </label>
          <div className="relative">
            <input
              type={show.new ? 'text' : 'password'}
              value={form.newPassword}
              onChange={set('newPassword')}
              placeholder="Mínimo 8 caracteres"
              required
              minLength={8}
              className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
            />
            <button type="button" onClick={() => setShow((s) => ({ ...s, new: !s.new }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {show.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {form.newPassword.length > 0 && (
            <div className="mt-1.5 space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor : 'bg-gray-200 dark:bg-gray-700'}`} />
                ))}
              </div>
              <p className={`text-xs ${['', 'text-red-500', 'text-amber-500', 'text-blue-500', 'text-emerald-500'][strength]}`}>
                {strengthLabel}
              </p>
            </div>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Confirmar nova senha
          </label>
          <div className="relative">
            <input
              type={show.confirm ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              placeholder="Repita a nova senha"
              required
              className={`h-10 w-full rounded-lg border bg-white dark:bg-gray-800 px-3 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 transition-colors ${
                form.confirmPassword && form.confirmPassword !== form.newPassword
                  ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
                  : 'border-gray-300 dark:border-gray-600 focus:border-[#1e3a5f] focus:ring-[#1e3a5f]'
              }`}
            />
            <button type="button" onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {show.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {form.confirmPassword && form.confirmPassword !== form.newPassword && (
            <p className="mt-1 text-xs text-red-500">As senhas não coincidem</p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || (!!form.confirmPassword && form.confirmPassword !== form.newPassword)}
          className="flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#162d4a] disabled:opacity-50 transition-colors"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Salvando…' : 'Alterar senha'}
        </button>
      </div>
    </form>
  )
}
