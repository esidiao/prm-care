'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Brain, ChevronDown, ChevronUp, Plus, Trash2, Printer,
  CheckCircle2, AlertTriangle, AlertCircle, Info, X, Loader2,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  SCALES, SCALE_LIST, SEVERITY_BADGE_CLASSES,
  type ScaleType, type SeverityLevel, type ScaleDefinition,
} from '@/lib/scales'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AssessmentRecord {
  id: string
  scaleType: string
  answers: unknown
  totalScore: number
  severity: string
  notes: string | null
  appliedAt: string
  createdAt: string
  user: { name: string | null; email: string }
}

interface Props {
  patientId: string
  initialAssessments: AssessmentRecord[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(date: string) {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function SeverityBadge({ severity, label }: { severity: string; label: string }) {
  const cls = SEVERITY_BADGE_CLASSES[severity as SeverityLevel] ?? 'bg-gray-100 text-gray-700 border-gray-200'
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

// ── ScaleIcon ─────────────────────────────────────────────────────────────────

function ScaleIcon({ type, size = 'md' }: { type: ScaleType; size?: 'sm' | 'md' }) {
  const colors: Record<ScaleType, string> = {
    GAD7: 'bg-violet-100 text-violet-700',
    PHQ9: 'bg-blue-100 text-blue-700',
    AUDIT_C: 'bg-amber-100 text-amber-700',
    MORISKY4: 'bg-teal-100 text-teal-700',
  }
  const sz = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm'
  return (
    <div className={`flex items-center justify-center rounded-lg font-bold ${sz} ${colors[type]}`}>
      {type === 'GAD7' ? 'G7' : type === 'PHQ9' ? 'P9' : type === 'AUDIT_C' ? 'AU' : 'MO'}
    </div>
  )
}

// ── Assessment Questionnaire Form ─────────────────────────────────────────────

function ScaleForm({
  scale,
  patientId,
  onSave,
  onCancel,
}: {
  scale: ScaleDefinition
  patientId: string
  onSave: (record: AssessmentRecord) => void
  onCancel: () => void
}) {
  // Usa null para distinguir "não respondida" de "respondida com valor 0"
  const [answers, setAnswers] = useState<Record<number, number | null>>(
    () => Object.fromEntries(scale.questions.map(q => [q.id, null]))
  )
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Conta apenas as perguntas que foram explicitamente respondidas (não null)
  const answered = scale.questions.filter(q => answers[q.id] !== null).length
  const complete = answered === scale.questionCount
  const totalScore = scale.questions.reduce((s, q) => s + (answers[q.id] ?? 0), 0)
  const severity = complete ? scale.getSeverity(totalScore) : null

  const handleSelect = (questionId: number, value: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = async () => {
    if (!complete) return
    setSaving(true)
    setError(null)
    try {
      const answersPayload = scale.questions.map(q => ({
        question: q.id,
        answer: answers[q.id] ?? 0,
      }))
      const body = {
        scaleType: scale.type,
        answers: answersPayload,
        totalScore,
        severity: scale.getSeverity(totalScore),
        notes: notes.trim() || null,
      }
      const res = await fetch(`/api/patients/${patientId}/scales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || `Erro ${res.status}`)
      }
      onSave(data.assessment)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(`Não foi possível salvar: ${msg}`)
      console.error('[ScaleForm] erro ao salvar:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <ScaleIcon type={scale.type} />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{scale.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{scale.description}</p>
          </div>
        </div>
        <button onClick={onCancel} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            {answered} de {scale.questionCount} respondidas
            {!complete && answered > 0 && (
              <span className="ml-1 text-amber-500">
                — faltam {scale.questionCount - answered}
              </span>
            )}
          </span>
          {complete && severity && (
            <span className="font-medium text-[#1e3a5f] dark:text-blue-400">
              Score: <strong>{totalScore}/{scale.maxScore}</strong>
            </span>
          )}
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              complete ? 'bg-emerald-500' : 'bg-[#1e3a5f]'
            }`}
            style={{ width: `${(answered / scale.questionCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {scale.questions.map((q, idx) => (
          <div key={q.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
              <span className="mr-2 text-gray-400 dark:text-gray-500">{idx + 1}.</span>
              {q.text}
            </p>
            <div className="flex flex-col gap-2">
              {q.options.map((opt) => {
                const isSelected = answers[q.id] === opt.value
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      isSelected
                        ? 'border-[#1e3a5f] bg-[#1e3a5f]/5 text-[#1e3a5f] dark:bg-[#1e3a5f]/20 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name={`scale-${scale.type}-q${q.id}`}
                      value={String(opt.value)}
                      checked={isSelected}
                      onChange={() => handleSelect(q.id, opt.value)}
                    />
                    <div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 flex-shrink-0 transition-colors ${
                      isSelected
                        ? 'border-[#1e3a5f] bg-[#1e3a5f] dark:border-blue-400 dark:bg-blue-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <span>{opt.label}</span>
                    <span className="ml-auto font-mono text-xs text-gray-400 shrink-0">({opt.value} pt)</span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* PHQ-9 Q9 alert */}
      {scale.type === 'PHQ9' && answers[9] !== null && (answers[9] ?? 0) > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            <strong>Atenção:</strong> Resposta positiva na questão de ideação suicida. Avalie imediatamente o risco e acione suporte especializado se necessário.
          </span>
        </div>
      )}

      {/* Result preview */}
      {complete && severity && (
        <div className="rounded-lg border-2 border-[#1e3a5f]/20 bg-[#1e3a5f]/5 dark:bg-[#1e3a5f]/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Score: {totalScore}/{scale.maxScore}
            </span>
            <SeverityBadge severity={severity} label={scale.getSeverityLabel(severity)} />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">{scale.getRecommendation(severity)}</p>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
          Observações clínicas (opcional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Contexto clínico relevante, medicamentos suspeitos, encaminhamentos realizados..."
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!complete || saving}
          title={!complete ? `Responda todas as ${scale.questionCount} questões para salvar` : ''}
          className="flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#162d4a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {saving ? 'Salvando...' : complete ? 'Salvar avaliação' : `Faltam ${scale.questionCount - answered} questão(ões)`}
        </button>
      </div>
    </div>
  )
}

// ── Assessment History Card ────────────────────────────────────────────────────

function AssessmentCard({
  record,
  scale,
  onDelete,
}: {
  record: AssessmentRecord
  scale: ScaleDefinition
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const severity = record.severity as SeverityLevel
  const answers = record.answers as Array<{ question: number; answer: number }>

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/patients/${record.id.split('_')[0]}/scales/${record.id}`,
        { method: 'DELETE' }
      )
      // We'll use the id from the record directly
      if (res.ok || res.status === 404) onDelete(record.id)
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <ScaleIcon type={record.scaleType as ScaleType} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {scale.name}
              </span>
              <SeverityBadge severity={severity} label={scale.getSeverityLabel(severity)} />
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                {record.totalScore}/{scale.maxScore}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {fmt(record.appliedAt)} · {record.user.name || record.user.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? '...' : 'Excluir'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Não
              </button>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-gray-100 dark:border-gray-700 pt-3">
          {/* Recommendation */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-3 text-xs text-gray-700 dark:text-gray-300">
            <p className="font-semibold mb-1 text-gray-900 dark:text-gray-100">Conduta sugerida</p>
            {scale.getRecommendation(severity)}
          </div>
          {/* Answers */}
          <div className="space-y-2">
            {scale.questions.map((q, idx) => {
              const ans = answers.find((a) => a.question === q.id)
              const opt = q.options.find((o) => o.value === ans?.answer)
              return (
                <div key={q.id} className="flex items-start gap-2 text-xs">
                  <span className="text-gray-400 w-5 shrink-0">{idx + 1}.</span>
                  <span className="text-gray-600 dark:text-gray-400 flex-1">{q.text}</span>
                  <span className={`shrink-0 font-medium ${(ans?.answer ?? 0) > 1 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {opt?.label ?? '—'} ({ans?.answer ?? 0})
                  </span>
                </div>
              )
            })}
          </div>
          {record.notes && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-3 text-xs text-blue-800 dark:text-blue-300">
              <p className="font-semibold mb-1">Observações</p>
              {record.notes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Trend Chart ───────────────────────────────────────────────────────────────

function ScaleTrendChart({ records, scale }: { records: AssessmentRecord[]; scale: ScaleDefinition }) {
  if (records.length < 2) return null

  const data = [...records]
    .sort((a, b) => new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime())
    .map((r) => ({
      date: new Date(r.appliedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      score: r.totalScore,
    }))

  const colorMap: Record<ScaleType, string> = {
    GAD7: '#7c3aed', PHQ9: '#2563eb', AUDIT_C: '#d97706', MORISKY4: '#0d9488',
  }
  const color = colorMap[scale.type] ?? '#1e3a5f'

  // Reference lines by scale
  const refs =
    scale.type === 'GAD7'
      ? [{ y: 5, label: 'Leve' }, { y: 10, label: 'Mod.' }, { y: 15, label: 'Grave' }]
      : scale.type === 'PHQ9'
      ? [{ y: 5, label: 'Leve' }, { y: 10, label: 'Mod.' }, { y: 15, label: 'M.Grave' }, { y: 20, label: 'Grave' }]
      : scale.type === 'AUDIT_C'
      ? [{ y: 3, label: 'Risco' }]
      : [{ y: 3, label: 'Média' }]

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
        Evolução — {scale.name}
      </h4>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, scale.maxScore]} tick={{ fontSize: 11 }} width={28} />
          <Tooltip
            formatter={(v: number) => [v, 'Score']}
            labelStyle={{ fontSize: 12 }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          {refs.map((r) => (
            <ReferenceLine key={r.y} y={r.y} stroke="#f97316" strokeDasharray="4 2"
              label={{ value: r.label, position: 'right', fontSize: 10, fill: '#f97316' }} />
          ))}
          <Line type="monotone" dataKey="score" stroke={color} strokeWidth={2.5}
            dot={{ r: 4, fill: color }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ClinicalScales({ patientId, initialAssessments }: Props) {
  const [assessments, setAssessments] = useState<AssessmentRecord[]>(initialAssessments)
  const [activeForm, setActiveForm] = useState<ScaleType | null>(null)
  const [activeTab, setActiveTab] = useState<ScaleType | 'all'>('all')
  const [showInfo, setShowInfo] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click (works on mobile too)
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [])

  const { toast } = useToast()

  const handleSave = useCallback((record: AssessmentRecord) => {
    setAssessments((prev) => [record, ...prev])
    setActiveForm(null)
    const scale = SCALES[record.scaleType as ScaleType]
    toast({
      title: `${scale?.name ?? 'Escala'} salva`,
      description: `Score: ${record.totalScore} — ${scale?.getSeverityLabel(record.severity as import('@/lib/scales').SeverityLevel) ?? record.severity}`,
      variant: 'success',
    } as Parameters<typeof toast>[0])
  }, [toast])

  const handleDelete = useCallback((id: string) => {
    setAssessments((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const filtered =
    activeTab === 'all'
      ? assessments
      : assessments.filter((a) => a.scaleType === activeTab)

  const groupedByType = SCALE_LIST.reduce<Record<string, AssessmentRecord[]>>((acc, s) => {
    acc[s.type] = assessments.filter((a) => a.scaleType === s.type)
    return acc
  }, {})

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[#1e3a5f] dark:text-blue-400" />
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">
            Escalas Clínicas Validadas
          </h2>
          <button
            onClick={() => setShowInfo((v) => !v)}
            className="rounded-full p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {assessments.length > 0 && (
            <a
              href={`/patients/${patientId}/scales/report`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" /> Relatório
            </a>
          )}
          {!activeForm && (
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#162d4a] active:bg-[#162d4a] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Nova aplicação</span>
                <span className="sm:hidden">Aplicar</span>
                <ChevronDown className={`h-3 w-3 ml-0.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl z-20">
                  {SCALE_LIST.map((s) => (
                    <button
                      key={s.type}
                      onClick={() => { setActiveForm(s.type); setDropdownOpen(false) }}
                      className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-xl last:rounded-b-xl transition-colors"
                    >
                      <ScaleIcon type={s.type} size="sm" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.questionCount} questões · score 0–{s.maxScore}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info panel */}
      {showInfo && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-950 px-5 py-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {SCALE_LIST.map((s) => (
              <div key={s.type} className="text-xs">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{s.name}</span>
                <p className="text-gray-500 dark:text-gray-400 mt-0.5">{s.description}</p>
                <p className="text-gray-400 dark:text-gray-500 mt-1 italic">{s.reference}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Active form */}
        {activeForm && (
          <div className="rounded-xl border-2 border-[#1e3a5f]/20 bg-gray-50 dark:bg-gray-900 p-5">
            <ScaleForm
              scale={SCALES[activeForm]}
              patientId={patientId}
              onSave={handleSave}
              onCancel={() => setActiveForm(null)}
            />
          </div>
        )}

        {assessments.length === 0 && !activeForm ? (
          <div className="py-10 text-center">
            <Brain className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma avaliação registrada</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Aplique GAD-7, PHQ-9, AUDIT-C ou Morisky-4 clicando em "Nova aplicação"
            </p>
          </div>
        ) : assessments.length > 0 ? (
          <>
            {/* Summary chips */}
            <div className="flex flex-wrap gap-2">
              {SCALE_LIST.map((s) => {
                const count = groupedByType[s.type]?.length ?? 0
                const latest = groupedByType[s.type]?.[0]
                if (count === 0) return null
                return (
                  <button
                    key={s.type}
                    onClick={() => setActiveTab(activeTab === s.type ? 'all' : s.type)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeTab === s.type
                        ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                    }`}
                  >
                    <ScaleIcon type={s.type} size="sm" />
                    {s.name} ({count})
                    {latest && (
                      <SeverityBadge
                        severity={latest.severity}
                        label={`${latest.totalScore}`}
                      />
                    )}
                  </button>
                )
              })}
              {activeTab !== 'all' && (
                <button
                  onClick={() => setActiveTab('all')}
                  className="rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Ver todas
                </button>
              )}
            </div>

            {/* Trend charts */}
            {(activeTab === 'all' ? SCALE_LIST : [SCALES[activeTab]]).map((s) => {
              const recs = groupedByType[s.type] ?? []
              return <ScaleTrendChart key={s.type} records={recs} scale={s} />
            })}

            {/* Records list */}
            <div className="space-y-2">
              {filtered.map((record) => (
                <AssessmentCard
                  key={record.id}
                  record={record}
                  scale={SCALES[record.scaleType as ScaleType]}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
