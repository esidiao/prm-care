'use client'
import { useState, useCallback, useEffect } from 'react'
import {
  Calendar, Plus, CheckCircle2, Clock, Trash2, Loader2,
  ClipboardCheck, FlaskConical, TestTube2, Heart, StickyNote, X,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface Review {
  id: string
  scheduledDate: string
  type: string
  title: string
  notes: string | null
  status: string
  completedAt: string | null
  completedNote: string | null
}

const REVIEW_TYPES = [
  { value: 'MEDICATION_REVIEW', label: 'Revisão de medicamentos', icon: FlaskConical, color: 'text-blue-600 bg-blue-50' },
  { value: 'FOLLOW_UP', label: 'Seguimento farmacoterapêutico', icon: Heart, color: 'text-emerald-600 bg-emerald-50' },
  { value: 'LAB_CHECK', label: 'Verificação de exames', icon: TestTube2, color: 'text-purple-600 bg-purple-50' },
  { value: 'ADHERENCE', label: 'Avaliação de adesão', icon: ClipboardCheck, color: 'text-amber-600 bg-amber-50' },
  { value: 'CUSTOM', label: 'Outro', icon: StickyNote, color: 'text-gray-600 bg-gray-100' },
]

function typeInfo(type: string) {
  return REVIEW_TYPES.find((t) => t.value === type) ?? REVIEW_TYPES[4]
}

function statusBadge(status: string, date: string) {
  const isPast = new Date(date) < new Date()
  if (status === 'COMPLETED') return { label: 'Concluída', cls: 'bg-emerald-100 text-emerald-700' }
  if (status === 'CANCELLED') return { label: 'Cancelada', cls: 'bg-gray-100 text-gray-500' }
  if (status === 'OVERDUE' || (status === 'PENDING' && isPast))
    return { label: 'Atrasada', cls: 'bg-red-100 text-red-700 font-semibold' }
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
  if (days === 0) return { label: 'Hoje', cls: 'bg-orange-100 text-orange-700 font-semibold' }
  if (days === 1) return { label: 'Amanhã', cls: 'bg-amber-100 text-amber-700' }
  if (days <= 7) return { label: `Em ${days}d`, cls: 'bg-blue-100 text-blue-700' }
  return { label: `Em ${days}d`, cls: 'bg-gray-100 text-gray-600' }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── New review form ───────────────────────────────────────────────────────────

function NewReviewForm({ patientId, onCreated, onCancel }: {
  patientId: string
  onCreated: (r: Review) => void
  onCancel: () => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    type: 'FOLLOW_UP',
    title: '',
    scheduledDate: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  // Auto-fill title when type changes
  const handleTypeChange = (type: string) => {
    const info = REVIEW_TYPES.find((t) => t.value === type)
    setForm((f) => ({ ...f, type, title: f.title || info?.label || '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.scheduledDate) return
    setSaving(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      onCreated(created)
      toast({ title: 'Revisão agendada', variant: 'success' } as Parameters<typeof toast>[0])
    } catch {
      toast({ title: 'Erro ao agendar revisão', variant: 'destructive' } as Parameters<typeof toast>[0])
    } finally {
      setSaving(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border-2 border-[#1e3a5f]/20 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Nova revisão agendada</p>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {REVIEW_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => handleTypeChange(t.value)}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
              form.type === t.value
                ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                : 'border-gray-200 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300'
            }`}
          >
            <t.icon className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Título</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            placeholder="Descrição da revisão"
            className="h-9 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Data agendada</label>
          <input
            type="date"
            value={form.scheduledDate}
            min={today}
            onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
            required
            className="h-9 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Observações (opcional)</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
          placeholder="Objetivos da revisão, exames a verificar…"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm resize-none focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#162d4a] disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
          Agendar
        </button>
      </div>
    </form>
  )
}

// ── Review card ───────────────────────────────────────────────────────────────

function ReviewCard({ review, onComplete, onDelete }: {
  review: Review
  onComplete: (id: string, note: string) => void
  onDelete: (id: string) => void
}) {
  const [completeMode, setCompleteMode] = useState(false)
  const [note, setNote] = useState('')
  const info = typeInfo(review.type)
  const badge = statusBadge(review.status, review.scheduledDate)
  const isDone = review.status === 'COMPLETED' || review.status === 'CANCELLED'

  return (
    <div className={`rounded-xl border p-3.5 transition-opacity ${isDone ? 'opacity-60 border-gray-100 dark:border-gray-800' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${info.color}`}>
          <info.icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{review.title}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>{badge.label}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Calendar className="h-3 w-3" />
            {fmtDate(review.scheduledDate)}
            <span className="text-gray-300">·</span>
            <span>{info.label}</span>
          </div>
          {review.notes && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{review.notes}</p>
          )}
          {review.completedNote && (
            <p className="mt-1 rounded bg-emerald-50 dark:bg-emerald-950 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300">
              ✓ {review.completedNote}
            </p>
          )}
        </div>

        {/* Actions */}
        {!isDone && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => setCompleteMode(true)}
              title="Marcar como concluída"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(review.id)}
              title="Excluir"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Complete form */}
      {completeMode && (
        <div className="mt-3 space-y-2 border-t border-gray-100 dark:border-gray-700 pt-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Observações da revisão realizada (opcional)…"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-xs resize-none focus:border-emerald-500 focus:outline-none"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCompleteMode(false)}
              className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={() => { onComplete(review.id, note); setCompleteMode(false) }}
              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Concluir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PatientReviews({ patientId, initialReviews }: {
  patientId: string
  initialReviews: Review[]
}) {
  const { toast } = useToast()
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [showForm, setShowForm] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  const pending = reviews.filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED')
  const done = reviews.filter((r) => r.status === 'COMPLETED' || r.status === 'CANCELLED')

  const handleComplete = useCallback(async (id: string, completedNote: string) => {
    try {
      const res = await fetch(`/api/patients/${patientId}/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED', completedNote }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setReviews((prev) => prev.map((r) => r.id === id ? updated : r))
      toast({ title: 'Revisão concluída', variant: 'success' } as Parameters<typeof toast>[0])
    } catch {
      toast({ title: 'Erro ao concluir revisão', variant: 'destructive' } as Parameters<typeof toast>[0])
    }
  }, [patientId, toast])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetch(`/api/patients/${patientId}/reviews/${id}`, { method: 'DELETE' })
      setReviews((prev) => prev.filter((r) => r.id !== id))
      toast({ title: 'Revisão removida', variant: 'default' } as Parameters<typeof toast>[0])
    } catch {
      toast({ title: 'Erro ao remover revisão', variant: 'destructive' } as Parameters<typeof toast>[0])
    }
  }, [patientId, toast])

  const overdue = pending.filter((r) => {
    const isPast = new Date(r.scheduledDate) < new Date()
    return r.status === 'OVERDUE' || (r.status === 'PENDING' && isPast)
  })

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Revisões agendadas
          </h2>
          {overdue.length > 0 && (
            <span className="rounded-full bg-red-100 dark:bg-red-900 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              {overdue.length} atrasada{overdue.length > 1 ? 's' : ''}
            </span>
          )}
          {pending.length > 0 && overdue.length === 0 && (
            <span className="rounded-full bg-blue-100 dark:bg-blue-900 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
              {pending.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#162d4a] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Agendar
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* New review form */}
        {showForm && (
          <NewReviewForm
            patientId={patientId}
            onCreated={(r) => { setReviews((prev) => [r, ...prev]); setShowForm(false) }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Pending reviews */}
        {pending.length === 0 && !showForm && (
          <div className="py-6 text-center">
            <Clock className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma revisão agendada</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Agende a próxima revisão farmacoterapêutica</p>
          </div>
        )}
        {pending.map((r) => (
          <ReviewCard key={r.id} review={r} onComplete={handleComplete} onDelete={handleDelete} />
        ))}

        {/* Completed toggle */}
        {done.length > 0 && (
          <div>
            <button
              onClick={() => setShowCompleted((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-1"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {showCompleted ? 'Ocultar' : 'Ver'} {done.length} revisão{done.length > 1 ? 'ões' : ''} concluída{done.length > 1 ? 's' : ''}
            </button>
            {showCompleted && (
              <div className="mt-2 space-y-2">
                {done.map((r) => (
                  <ReviewCard key={r.id} review={r} onComplete={handleComplete} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
