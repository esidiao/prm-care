'use client'

import { useState } from 'react'
import { BookOpen, Pencil, Save, X, Loader2, CheckCircle2, Sparkles } from 'lucide-react'
import { apiErrorMessage } from '@/lib/utils'

type Soap = {
  subjective: string
  objective: string
  assessment: string
  plan: string
  createdAt: string
  updatedAt: string
  attestedAt: string | null
  attestedBy: { name: string | null; crfNumber: string | null } | null
}

const SECTIONS = [
  { key: 'subjective', label: 'S — Subjetivo', hint: 'Queixas relatadas', accent: 'border-l-blue-400' },
  { key: 'objective',  label: 'O — Objetivo',  hint: 'Dados clínicos', accent: 'border-l-gray-400' },
  { key: 'assessment', label: 'A — Avaliação', hint: 'Impressão farmacêutica', accent: 'border-l-yellow-400' },
  { key: 'plan',       label: 'P — Plano',     hint: 'Intervenções propostas', accent: 'border-l-green-400' },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

/**
 * Registro SOAP da análise, editável pelo farmacêutico.
 *
 * O texto inicial vem do motor determinístico. Enquanto ninguém o revisar, ele é
 * exibido como *sugestão do sistema* — a Resolução CFF nº 751/2022 exige que a
 * avaliação e o plano de cuidado sejam do profissional, e um texto que a máquina
 * escreveu e o farmacêutico não confirmou não é registro dele.
 *
 * Salvar a revisão grava o atesto — `attestedAt` e o farmacêutico responsável —,
 * o que dá identificação ao registro, como a norma exige. Registros anteriores a
 * 31/08/2026 têm atesto nulo: nunca passaram por revisão humana.
 */
export function SoapRecord({ analysisId, soap }: { analysisId: string; soap: Soap }) {
  const [record, setRecord] = useState(soap)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<SectionKey, string>>({
    subjective: soap.subjective,
    objective: soap.objective,
    assessment: soap.assessment,
    plan: soap.plan,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const attestedBy = record.attestedBy
  const attestation = record.attestedAt
    ? new Date(record.attestedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : null

  const startEditing = () => {
    setDraft({
      subjective: record.subjective,
      objective: record.objective,
      assessment: record.assessment,
      plan: record.plan,
    })
    setError(null)
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setError(null)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/analysis/${analysisId}/soap`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(apiErrorMessage(json, 'Não foi possível salvar o registro.'))
      setRecord(json.data)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o registro.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted px-5 py-3.5">
        <BookOpen className="h-4 w-4 text-brand-800" />
        <h2 className="font-semibold text-foreground text-sm">Registro SOAP</h2>

        {attestation ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300">
            <CheckCircle2 className="h-3 w-3" />
            Atestado por {attestedBy?.name || 'farmacêutico'}
            {attestedBy?.crfNumber ? ` · CRF ${attestedBy.crfNumber}` : ''}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            <Sparkles className="h-3 w-3" /> Sugestão do sistema — não revisada
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={cancel}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-card disabled:opacity-50">
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-800 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-900 disabled:opacity-50">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {saving ? 'Salvando…' : 'Salvar registro'}
              </button>
            </>
          ) : (
            <button
              onClick={startEditing}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-card">
              <Pencil className="h-3.5 w-3.5" /> Revisar e editar
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="border-b border-red-200 bg-red-50 px-5 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
        {SECTIONS.map(({ key, label, hint, accent }) => (
          <div key={key} className={`p-4 border-l-4 ${accent}`}>
            <label htmlFor={`soap-${key}`} className="block text-xs font-bold text-foreground mb-0.5">{label}</label>
            <p className="text-[10px] text-muted-foreground mb-2">{hint}</p>
            {editing ? (
              <textarea
                id={`soap-${key}`}
                value={draft[key]}
                onChange={e => setDraft({ ...draft, [key]: e.target.value })}
                rows={5}
                maxLength={5000}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-brand-800"
              />
            ) : (
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{record[key] || '—'}</p>
            )}
          </div>
        ))}
      </div>

      <p className="border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">
        {attestation
          ? `Registro atestado em ${attestation} e é o que sai no relatório em PDF.`
          : 'Texto gerado pelo motor de análise, ainda sem atesto. Revise antes de emitir o relatório — o registro do atendimento é de responsabilidade do farmacêutico (CFF nº 751/2022).'}
      </p>
    </div>
  )
}
