'use client'
import { useState, useCallback } from 'react'
import {
  StickyNote, Plus, Pin, PinOff, Pencil, Trash2,
  Check, X, Loader2, ChevronDown, ChevronUp, Bold,
  Italic, List, Minus,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Note {
  id: string
  content: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
  user: { name: string | null; email: string }
}

interface Props {
  patientId: string
  initialNotes: Note[]
}

// ── Markdown renderer (lightweight, no dependency) ────────────────────────────

function renderMarkdown(text: string): string {
  return text
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-gray-800 dark:text-gray-200 mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-gray-900 dark:text-gray-100 mt-3 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-gray-900 dark:text-gray-100 mt-3 mb-1">$1</h1>')
    // Bold / italic
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-gray-100">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    .replace(/_(.+?)_/g, '<em class="italic">$1</em>')
    // Inline code
    .replace(/`(.+?)`/g, '<code class="rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5 text-xs font-mono text-red-700 dark:text-red-400">$1</code>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="my-2 border-gray-200 dark:border-gray-700" />')
    // Unordered list items
    .replace(/^\s*[-*] (.+)$/gm, '<li class="ml-4 list-disc text-gray-700 dark:text-gray-300 text-sm">$1</li>')
    // Ordered list items
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-700 dark:text-gray-300 text-sm">$1</li>')
    // Line breaks
    .replace(/\n/g, '<br />')
}

function MarkdownPreview({ content }: { content: string }) {
  return (
    <div
      className="prose-sm text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  )
}

// ── Markdown toolbar ──────────────────────────────────────────────────────────

function ToolbarButton({
  icon: Icon, title, onClick,
}: { icon: React.ElementType; title: string; onClick: () => void }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-600 dark:hover:text-gray-200 transition-colors">
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

function insertAtCursor(
  textarea: HTMLTextAreaElement,
  before: string,
  after = '',
  placeholder = '',
) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = textarea.value.slice(start, end) || placeholder
  const newValue =
    textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end)
  return { newValue, newCursor: start + before.length + selected.length + after.length }
}

// ── Note card ─────────────────────────────────────────────────────────────────

function NoteCard({
  note, patientId, onUpdate, onDelete,
}: {
  note: Note
  patientId: string
  onUpdate: (updated: Note) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(note.content)
  const [preview, setPreview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(note.isPinned)
  const [deleting, setDeleting] = useState(false)

  const isLong = note.content.length > 300

  async function save() {
    if (!editContent.trim() || editContent === note.content) {
      setEditing(false)
      setEditContent(note.content)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      })
      const json = await res.json()
      if (res.ok) { onUpdate(json.note); setEditing(false) }
    } finally { setLoading(false) }
  }

  async function togglePin() {
    setLoading(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !note.isPinned }),
      })
      const json = await res.json()
      if (res.ok) onUpdate(json.note)
    } finally { setLoading(false) }
  }

  async function deleteNote() {
    if (!confirm('Excluir esta anotação? A ação não pode ser desfeita.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/notes/${note.id}`, { method: 'DELETE' })
      if (res.ok) onDelete(note.id)
    } finally { setDeleting(false) }
  }

  function formatDate(d: string) {
    const dt = new Date(d)
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={`rounded-xl border transition-all ${
      note.isPinned
        ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20'
        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
        {note.isPinned && <Pin className="h-3 w-3 text-amber-500 flex-shrink-0" />}
        <span className="flex-1 text-[11px] text-gray-400 dark:text-gray-500">
          {formatDate(note.createdAt)}
          {note.updatedAt !== note.createdAt && ' (editado)'}
          {' · '}{note.user.name || note.user.email}
        </span>
        <div className="flex items-center gap-0.5">
          <button onClick={togglePin} disabled={loading} title={note.isPinned ? 'Desafixar' : 'Fixar'}
            className="flex h-6 w-6 items-center justify-center rounded text-gray-300 hover:text-amber-500 dark:text-gray-600 dark:hover:text-amber-400 transition-colors">
            {note.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => { setEditing(true); setExpanded(true) }} title="Editar"
            className="flex h-6 w-6 items-center justify-center rounded text-gray-300 hover:text-blue-500 dark:text-gray-600 dark:hover:text-blue-400 transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={deleteNote} disabled={deleting} title="Excluir"
            className="flex h-6 w-6 items-center justify-center rounded text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors">
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {editing ? (
          <NoteEditor
            value={editContent}
            onChange={setEditContent}
            onSave={save}
            onCancel={() => { setEditing(false); setEditContent(note.content) }}
            loading={loading}
          />
        ) : (
          <>
            <div className={isLong && !expanded ? 'max-h-24 overflow-hidden relative' : ''}>
              <MarkdownPreview content={note.content} />
              {isLong && !expanded && (
                <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-white dark:from-gray-800 to-transparent" />
              )}
            </div>
            {isLong && (
              <button onClick={() => setExpanded(e => !e)}
                className="mt-1 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                {expanded ? <><ChevronUp className="h-3 w-3" /> Recolher</> : <><ChevronDown className="h-3 w-3" /> Expandir</>}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Editor with toolbar ───────────────────────────────────────────────────────

function NoteEditor({
  value, onChange, onSave, onCancel, loading, autoFocus = true,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  loading: boolean
  autoFocus?: boolean
}) {
  const [showPreview, setShowPreview] = useState(false)
  const textareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    if (el && autoFocus) el.focus()
  }, [autoFocus])

  function wrap(before: string, after = '', placeholder = 'texto') {
    const el = document.querySelector<HTMLTextAreaElement>('textarea[data-notes-editor]')
    if (!el) return
    const { newValue, newCursor } = insertAtCursor(el, before, after, placeholder)
    onChange(newValue)
    setTimeout(() => { el.focus(); el.setSelectionRange(newCursor - after.length, newCursor - after.length) }, 0)
  }

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-2 py-1">
        <ToolbarButton icon={Bold} title="Negrito (**texto**)" onClick={() => wrap('**', '**', 'negrito')} />
        <ToolbarButton icon={Italic} title="Itálico (*texto*)" onClick={() => wrap('*', '*', 'itálico')} />
        <ToolbarButton icon={List} title="Lista (- item)" onClick={() => wrap('- ', '', 'item')} />
        <ToolbarButton icon={Minus} title="Separador (---)" onClick={() => wrap('\n---\n')} />
        <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-600" />
        <button type="button" onClick={() => setShowPreview(p => !p)}
          className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
            showPreview
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}>
          {showPreview ? 'Editar' : 'Pré-visualizar'}
        </button>
      </div>

      {showPreview ? (
        <div className="min-h-[100px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-3">
          <MarkdownPreview content={value || '*Nenhum conteúdo*'} />
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          data-notes-editor
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSave() }
            if (e.key === 'Escape') onCancel()
          }}
          placeholder="Escreva sua anotação clínica... (Markdown suportado)&#10;&#10;Dica: **negrito**, *itálico*, - lista, `código`&#10;Ctrl+Enter para salvar"
          className="w-full min-h-[120px] resize-y rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 p-3 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 font-mono"
          rows={5}
        />
      )}

      <div className="flex items-center gap-2">
        <button onClick={onSave} disabled={!value.trim() || loading}
          className="flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#162d4a] disabled:opacity-50 transition-colors dark:bg-blue-600 dark:hover:bg-blue-500">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Salvar
        </button>
        <button onClick={onCancel}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <X className="h-3.5 w-3.5" /> Cancelar
        </button>
        <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">Ctrl+Enter salva · Esc cancela</span>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PatientNotes({ patientId, initialNotes }: Props) {
  const { toast } = useToast()
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [adding, setAdding] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [saving, setSaving] = useState(false)

  async function createNote() {
    if (!newContent.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      })
      const json = await res.json()
      if (res.ok) {
        setNotes(prev => [json.note, ...prev])
        setNewContent('')
        setAdding(false)
        toast({ title: 'Anotação salva', variant: 'success' } as Parameters<typeof toast>[0])
      }
    } catch {
      toast({ title: 'Erro ao salvar anotação', variant: 'destructive' } as Parameters<typeof toast>[0])
    } finally { setSaving(false) }
  }

  function handleUpdate(updated: Note) {
    setNotes(prev => {
      const list = prev.map(n => n.id === updated.id ? updated : n)
      // Re-sort: pinned first
      return [...list.filter(n => n.isPinned), ...list.filter(n => !n.isPinned)]
    })
  }

  function handleDelete(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  return (
    <div className="card overflow-visible">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-4">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Anotações clínicas
          </h2>
          {notes.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 px-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">
              {notes.length}
            </span>
          )}
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Nova anotação
          </button>
        )}
      </div>

      <div className="p-5 space-y-3">
        {/* New note editor */}
        {adding && (
          <div className="rounded-xl border-2 border-blue-200 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-950/20 p-4">
            <p className="mb-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
              Nova anotação clínica
            </p>
            <NoteEditor
              value={newContent}
              onChange={setNewContent}
              onSave={createNote}
              onCancel={() => { setAdding(false); setNewContent('') }}
              loading={saving}
            />
          </div>
        )}

        {/* Notes list */}
        {notes.length === 0 && !adding ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20 mb-3">
              <StickyNote className="h-6 w-6 text-amber-400" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Nenhuma anotação ainda
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Registre observações clínicas, alertas e acompanhamentos
            </p>
            <button
              onClick={() => setAdding(true)}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
            >
              <Plus className="h-4 w-4" /> Criar primeira anotação
            </button>
          </div>
        ) : (
          notes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              patientId={patientId}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}
