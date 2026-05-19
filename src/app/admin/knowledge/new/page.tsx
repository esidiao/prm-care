'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import {
  ArrowLeft, BookOpen, Plus, Save, Loader2,
  AlertTriangle, Tag, Pill, X, FileText
} from 'lucide-react'

const schema = z.object({
  title: z.string().min(3, 'Título obrigatório'),
  type: z.enum(['DRUG_INTERACTION', 'CONTRAINDICATION', 'SIDE_EFFECT', 'GUIDELINE', 'PROTOCOL', 'ALERT', 'EDUCATIONAL']),
  content: z.string().min(10, 'Conteúdo obrigatório (mín. 10 caracteres)'),
  summary: z.string().optional(),
  source: z.string().min(2, 'Fonte obrigatória'),
  sourceUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  publishedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  status: z.enum(['PENDING', 'VALIDATED', 'OUTDATED', 'REJECTED']).default('PENDING'),
  tags: z.array(z.string()).default([]),
  drugNames: z.array(z.string()).default([]),
  icd10Codes: z.array(z.string()).default([]),
  observations: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const TYPE_OPTIONS = [
  { value: 'DRUG_INTERACTION', label: 'Interação Medicamentosa', color: 'text-red-600' },
  { value: 'CONTRAINDICATION', label: 'Contraindicação', color: 'text-orange-600' },
  { value: 'SIDE_EFFECT', label: 'Efeito Adverso', color: 'text-yellow-600' },
  { value: 'GUIDELINE', label: 'Diretriz Clínica', color: 'text-blue-600' },
  { value: 'PROTOCOL', label: 'Protocolo', color: 'text-purple-600' },
  { value: 'ALERT', label: 'Alerta de Segurança', color: 'text-red-700' },
  { value: 'EDUCATIONAL', label: 'Educativo', color: 'text-green-600' },
]

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pendente de revisão' },
  { value: 'VALIDATED', label: 'Validado' },
  { value: 'OUTDATED', label: 'Desatualizado' },
  { value: 'REJECTED', label: 'Rejeitado' },
]

export default function NewKnowledgePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [drugInput, setDrugInput] = useState('')
  const [icdInput, setIcdInput] = useState('')

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'DRUG_INTERACTION',
      status: 'PENDING',
      tags: [],
      drugNames: [],
      icd10Codes: [],
    },
  })

  const tags = watch('tags')
  const drugNames = watch('drugNames')
  const icd10Codes = watch('icd10Codes')

  const addTag = (input: string, field: 'tags' | 'drugNames' | 'icd10Codes', setter: (v: string) => void) => {
    const val = input.trim()
    if (!val) return
    const current = watch(field) as string[]
    if (!current.includes(val)) {
      setValue(field, [...current, val])
    }
    setter('')
  }

  const removeItem = (field: 'tags' | 'drugNames' | 'icd10Codes', idx: number) => {
    const current = watch(field) as string[]
    setValue(field, current.filter((_, i) => i !== idx))
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          sourceUrl: data.sourceUrl || undefined,
          publishedAt: data.publishedAt || undefined,
          expiresAt: data.expiresAt || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao criar entrada')
      router.push('/admin/knowledge')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const selectedType = watch('type')

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/knowledge" className="text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            Nova Entrada na Base de Conhecimento
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Adicione diretrizes, interações, protocolos ou alertas clínicos
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Basic Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Informações básicas
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              {...register('title')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: Interação entre Varfarina e AINEs"
            />
            {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo <span className="text-red-500">*</span>
              </label>
              <select
                {...register('type')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status inicial</label>
              <select
                {...register('status')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Resumo
              <span className="ml-1 text-xs text-gray-400">(exibido na listagem)</span>
            </label>
            <input
              {...register('summary')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Breve descrição do conteúdo..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Conteúdo completo <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register('content')}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono"
              placeholder="Conteúdo clínico detalhado, mecanismo de ação, recomendações, evidências..."
            />
            {errors.content && <p className="mt-1 text-xs text-red-600">{errors.content.message}</p>}
          </div>
        </div>

        {/* Section 2: Source & Dates */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Fonte e datas</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fonte <span className="text-red-500">*</span>
              </label>
              <input
                {...register('source')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: ANVISA, CFF, Ministério da Saúde"
              />
              {errors.source && <p className="mt-1 text-xs text-red-600">{errors.source.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL da fonte</label>
              <input
                type="url"
                {...register('sourceUrl')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://..."
              />
              {errors.sourceUrl && <p className="mt-1 text-xs text-red-600">{errors.sourceUrl.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de publicação</label>
              <input
                type="date"
                {...register('publishedAt')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de expiração
                <span className="ml-1 text-xs text-gray-400">(quando revisar)</span>
              </label>
              <input
                type="date"
                {...register('expiresAt')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Classification */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Tag className="w-4 h-4 text-blue-600" />
            Classificação e indexação
          </h2>

          {/* Drug Names */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Pill className="w-3.5 h-3.5 text-blue-500" />
              Medicamentos relacionados
            </label>
            <div className="flex gap-2">
              <input
                value={drugInput}
                onChange={e => setDrugInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(drugInput, 'drugNames', setDrugInput) } }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: varfarina, ibuprofeno (Enter para adicionar)"
              />
              <button
                type="button"
                onClick={() => addTag(drugInput, 'drugNames', setDrugInput)}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {drugNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {drugNames.map((d, i) => (
                  <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    <Pill className="w-3 h-3" />
                    {d}
                    <button type="button" onClick={() => removeItem('drugNames', i)}>
                      <X className="w-3 h-3 hover:text-blue-900" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ICD-10 Codes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Códigos CID-10</label>
            <div className="flex gap-2">
              <input
                value={icdInput}
                onChange={e => setIcdInput(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(icdInput, 'icd10Codes', setIcdInput) } }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: I10, E11 (Enter para adicionar)"
              />
              <button
                type="button"
                onClick={() => addTag(icdInput, 'icd10Codes', setIcdInput)}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {icd10Codes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {icd10Codes.map((c, i) => (
                  <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-mono">
                    {c}
                    <button type="button" onClick={() => removeItem('icd10Codes', i)}>
                      <X className="w-3 h-3 hover:text-purple-900" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput, 'tags', setTagInput) } }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: anticoagulante, idoso, risco alto (Enter para adicionar)"
              />
              <button
                type="button"
                onClick={() => addTag(tagInput, 'tags', setTagInput)}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((t, i) => (
                  <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                    <Tag className="w-3 h-3" />
                    {t}
                    <button type="button" onClick={() => removeItem('tags', i)}>
                      <X className="w-3 h-3 hover:text-gray-900" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Observations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações internas</label>
            <textarea
              {...register('observations')}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Notas para a equipe de revisão..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin/knowledge"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {loading ? 'Salvando...' : 'Criar entrada'}
          </button>
        </div>
      </form>
    </div>
  )
}

