'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import {
  ArrowLeft, BookOpen, Plus, Save, Loader2,
  AlertTriangle, Tag, Pill, X, CheckCircle, Clock
} from 'lucide-react'

const schema = z.object({
  title: z.string().min(3),
  type: z.enum(['DRUG_INTERACTION', 'CONTRAINDICATION', 'SIDE_EFFECT', 'GUIDELINE', 'PROTOCOL', 'ALERT', 'EDUCATIONAL']),
  content: z.string().min(10),
  summary: z.string().optional(),
  source: z.string().min(2),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  publishedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  status: z.enum(['PENDING', 'VALIDATED', 'OUTDATED', 'REJECTED']),
  observations: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const TYPE_OPTIONS = [
  { value: 'DRUG_INTERACTION', label: 'Interação Medicamentosa' },
  { value: 'CONTRAINDICATION', label: 'Contraindicação' },
  { value: 'SIDE_EFFECT', label: 'Efeito Adverso' },
  { value: 'GUIDELINE', label: 'Diretriz Clínica' },
  { value: 'PROTOCOL', label: 'Protocolo' },
  { value: 'ALERT', label: 'Alerta de Segurança' },
  { value: 'EDUCATIONAL', label: 'Educativo' },
]

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pendente', icon: Clock, color: 'text-yellow-600' },
  { value: 'VALIDATED', label: 'Validado', icon: CheckCircle, color: 'text-green-600' },
  { value: 'OUTDATED', label: 'Desatualizado', icon: AlertTriangle, color: 'text-orange-600' },
  { value: 'REJECTED', label: 'Rejeitado', icon: X, color: 'text-red-600' },
]

export default function EditKnowledgePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [drugNames, setDrugNames] = useState<string[]>([])
  const [icd10Codes, setIcd10Codes] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [drugInput, setDrugInput] = useState('')
  const [icdInput, setIcdInput] = useState('')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/knowledge?id=${id}`)
        const json = await res.json()
        const entry = Array.isArray(json.data) ? json.data.find((e: any) => e.id === id) : null
        if (entry) {
          reset({
            title: entry.title,
            type: entry.type,
            content: entry.content,
            summary: entry.summary || '',
            source: entry.source,
            sourceUrl: entry.sourceUrl || '',
            publishedAt: entry.publishedAt ? entry.publishedAt.slice(0, 10) : '',
            expiresAt: entry.expiresAt ? entry.expiresAt.slice(0, 10) : '',
            status: entry.status,
            observations: entry.observations || '',
          })
          setTags(entry.tags || [])
          setDrugNames(entry.drugNames || [])
          setIcd10Codes(entry.icd10Codes || [])
        }
      } catch {
        setError('Erro ao carregar entrada')
      } finally {
        setFetching(false)
      }
    }
    load()
  }, [id, reset])

  const addChip = (val: string, list: string[], setList: (v: string[]) => void, setter: (v: string) => void) => {
    const trimmed = val.trim()
    if (trimmed && !list.includes(trimmed)) setList([...list, trimmed])
    setter('')
  }

  const removeChip = (val: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.filter(v => v !== val))
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/knowledge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          ...data,
          sourceUrl: data.sourceUrl || null,
          publishedAt: data.publishedAt || null,
          expiresAt: data.expiresAt || null,
          tags,
          drugNames,
          icd10Codes,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar')
      router.push('/admin/knowledge')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/knowledge" className="text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            Editar Entrada — Base de Conhecimento
          </h1>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Conteúdo principal */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input
              {...register('title')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
            {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select {...register('type')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
              <select {...register('status')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resumo</label>
            <input
              {...register('summary')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Exibido na listagem"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Conteúdo completo *</label>
            <textarea
              {...register('content')}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none font-mono"
            />
            {errors.content && <p className="mt-1 text-xs text-red-600">{errors.content.message}</p>}
          </div>
        </div>

        {/* Fonte e datas */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Fonte e datas</h2>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fonte *</label>
              <input {...register('source')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              {errors.source && <p className="mt-1 text-xs text-red-600">{errors.source.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL da fonte</label>
              <input type="url" {...register('sourceUrl')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Publicado em</label>
              <input type="date" {...register('publishedAt')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expira em</label>
              <input type="date" {...register('expiresAt')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Classificação */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Tag className="w-4 h-4 text-blue-600" /> Classificação
          </h2>

          {/* Medicamentos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Pill className="w-3.5 h-3.5 text-blue-500" /> Medicamentos
            </label>
            <div className="flex gap-2">
              <input
                value={drugInput}
                onChange={e => setDrugInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChip(drugInput, drugNames, setDrugNames, setDrugInput) } }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Enter para adicionar"
              />
              <button type="button" onClick={() => addChip(drugInput, drugNames, setDrugNames, setDrugInput)}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {drugNames.map(d => (
                <span key={d} className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {d}
                  <button type="button" onClick={() => removeChip(d, drugNames, setDrugNames)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* CID-10 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CID-10</label>
            <div className="flex gap-2">
              <input
                value={icdInput}
                onChange={e => setIcdInput(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChip(icdInput, icd10Codes, setIcd10Codes, setIcdInput) } }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: I10"
              />
              <button type="button" onClick={() => addChip(icdInput, icd10Codes, setIcd10Codes, setIcdInput)}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {icd10Codes.map(c => (
                <span key={c} className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-mono">
                  {c}
                  <button type="button" onClick={() => removeChip(c, icd10Codes, setIcd10Codes)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChip(tagInput, tags, setTags, setTagInput) } }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Enter para adicionar"
              />
              <button type="button" onClick={() => addChip(tagInput, tags, setTags, setTagInput)}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map(t => (
                <span key={t} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                  <Tag className="w-3 h-3" />{t}
                  <button type="button" onClick={() => removeChip(t, tags, setTags)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações internas</label>
            <textarea
              {...register('observations')}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <Link href="/admin/knowledge"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {loading ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  )
}
