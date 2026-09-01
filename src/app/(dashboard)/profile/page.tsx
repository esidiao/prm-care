'use client'
import { useState, useEffect, useRef } from 'react'
import {
  User, Mail, Building2, Award, BadgeCheck,
  Save, Loader2, CheckCircle2, AlertCircle, Camera,
  FlaskConical, Users, Calendar,
} from 'lucide-react'
import { apiErrorMessage } from '@/lib/utils'

const SPECIALIZATIONS = [
  'Farmácia Clínica',
  'Farmacêutica Hospitalar',
  'Farmacologia',
  'Oncologia',
  'Geriatria',
  'Pediatria',
  'Cardiologia',
  'Neurologia',
  'Endocrinologia',
  'Infectologia',
  'Atenção Primária',
  'Outra',
]

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Gratuito',
  BASIC: 'Básico',
  PROFESSIONAL: 'Profissional',
  INSTITUTIONAL: 'Institucional',
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  PROFESSIONAL: 'Profissional',
  STUDENT: 'Estudante',
  INSTITUTIONAL_MANAGER: 'Gestor Institucional',
}

interface ProfileData {
  id: string
  name: string | null
  email: string
  image: string | null
  role: string
  plan: string
  tokenBalance: number
  institution: string | null
  crfNumber: string | null
  specialization: string | null
  createdAt: string
  _count: { patients: number; analyses: number }
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [institution, setInstitution] = useState('')
  const [crfNumber, setCrfNumber] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [image, setImage] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then((data: ProfileData) => {
        setProfile(data)
        setName(data.name ?? '')
        setInstitution(data.institution ?? '')
        setCrfNumber(data.crfNumber ?? '')
        setSpecialization(data.specialization ?? '')
        setImage(data.image ?? '')
      })
      .catch(() => setError('Erro ao carregar perfil.'))
      .finally(() => setLoading(false))
  }, [])

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // O servidor recusa data URLs acima de 200 KB em base64 — o avatar vai para
    // o JWT do NextAuth, que trafega no cookie de sessão (limite de ~4 KB no
    // browser). 140 KB de arquivo ficam abaixo do teto depois do base64.
    if (file.size > 140 * 1024) {
      setError('Imagem deve ter no máximo 140 KB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, institution, crfNumber, specialization, image }),
      })
      const updated = await res.json().catch(() => null)
      if (!res.ok) throw new Error(apiErrorMessage(updated, 'Erro ao salvar'))
      setProfile(prev => prev ? { ...prev, ...updated } : prev)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar as alterações.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-300 dark:text-gray-600" />
      </div>
    )
  }

  const initials = (name || profile?.email || '?')[0].toUpperCase()
  const avatarSrc = image || profile?.image

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dados profissionais usados em relatórios, cartas e assinaturas
        </p>
      </div>

      {/* Stats strip */}
      {profile && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Pacientes', value: profile._count.patients, icon: Users, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950' },
            { label: 'Análises', value: profile._count.analyses, icon: FlaskConical, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950' },
            { label: 'Membro desde', value: new Date(profile.createdAt).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }), icon: Calendar, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
              <div className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-lg font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Main form card */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Avatar section */}
        <div className="bg-gradient-to-r from-brand-800 to-[#2a5298] px-6 py-8 flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <div className="h-20 w-20 rounded-2xl overflow-hidden ring-4 ring-white/20 bg-white/10 flex items-center justify-center">
              {avatarSrc ? (
                <img src={avatarSrc} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-white">{initials}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-card shadow-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
              title="Alterar foto"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageFile}
            />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{name || profile?.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/80">
                {ROLE_LABELS[profile?.role ?? ''] ?? profile?.role}
              </span>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/80">
                Plano {PLAN_LABELS[profile?.plan ?? ''] ?? profile?.plan}
              </span>
            </div>
            {crfNumber && (
              <p className="text-xs text-white/60 mt-1">CRF {crfNumber}</p>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Email (read-only) */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              E-mail
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2.5">
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground">{profile?.email}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">O e-mail não pode ser alterado</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Nome completo
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Dr. João Silva"
                className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2.5 text-sm text-foreground placeholder-gray-400 focus:border-brand-800 focus:outline-none focus:ring-1 focus:ring-brand-800"
              />
            </div>
          </div>

          {/* CRF */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              CRF (Conselho Regional de Farmácia)
            </label>
            <div className="relative">
              <BadgeCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={crfNumber}
                onChange={e => setCrfNumber(e.target.value)}
                placeholder="Ex: CRF-SP 12345"
                className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2.5 text-sm text-foreground placeholder-gray-400 focus:border-brand-800 focus:outline-none focus:ring-1 focus:ring-brand-800"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Aparece nos relatórios e cartas de encaminhamento</p>
          </div>

          {/* Specialization */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Especialização
            </label>
            <div className="relative">
              <Award className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                value={specialization}
                onChange={e => setSpecialization(e.target.value)}
                className="w-full appearance-none rounded-lg border border-border bg-card pl-9 pr-4 py-2.5 text-sm text-foreground focus:border-brand-800 focus:outline-none focus:ring-1 focus:ring-brand-800"
              >
                <option value="">Selecione…</option>
                {SPECIALIZATIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Institution */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Instituição / Local de trabalho
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                placeholder="Ex: Hospital das Clínicas - USP"
                className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2.5 text-sm text-foreground placeholder-gray-400 focus:border-brand-800 focus:outline-none focus:ring-1 focus:ring-brand-800"
              />
            </div>
          </div>

          {/* Photo URL (optional manual entry) */}
          {image && image.startsWith('http') && (
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5" htmlFor="image">
                URL da foto de perfil
              </label>
              <input id="image"
                type="url"
                value={image}
                onChange={e => setImage(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder-gray-400 focus:border-brand-800 focus:outline-none focus:ring-1 focus:ring-brand-800"
              />
            </div>
          )}

          {/* Feedback */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              Perfil atualizado com sucesso!
            </div>
          )}

          {/* Save button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-brand-800 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/50 p-4 text-xs text-blue-700 dark:text-blue-300">
        <p className="font-semibold mb-1">ℹ️ Como esses dados são usados</p>
        <ul className="space-y-0.5 list-disc list-inside text-blue-600 dark:text-blue-400">
          <li>Nome, CRF e especialização aparecem nos <strong>relatórios PDF</strong> e nas <strong>cartas de encaminhamento</strong></li>
          <li>A instituição é incluída no rodapé e no cabeçalho dos documentos gerados</li>
          <li>A foto é exibida na barra lateral e no topo da aplicação</li>
        </ul>
      </div>
    </div>
  )
}
