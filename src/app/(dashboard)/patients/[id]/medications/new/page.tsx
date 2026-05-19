'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { ArrowLeft, Pill, Save, Loader2, AlertTriangle, Info } from 'lucide-react'

const schema = z.object({
  activeIngredient: z.string().min(1, 'Princípio ativo obrigatório'),
  tradeName: z.string().optional(),
  dose: z.string().optional(),
  doseUnit: z.string().optional(),
  pharmaceuticalForm: z.string().optional(),
  route: z.string().default('ORAL'),
  frequency: z.string().optional(),
  indication: z.string().optional(),
  prescriber: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isSelfMedication: z.boolean().default(false),
  isActive: z.boolean().default(true),
  adverseEffects: z.string().optional(),
  observations: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const ROUTES = [
  { value: 'ORAL', label: 'Oral' },
  { value: 'SUBLINGUAL', label: 'Sublingual' },
  { value: 'INTRAVENOUS', label: 'Intravenosa' },
  { value: 'INTRAMUSCULAR', label: 'Intramuscular' },
  { value: 'SUBCUTANEOUS', label: 'Subcutânea' },
  { value: 'TRANSDERMAL', label: 'Transdérmica' },
  { value: 'INHALED', label: 'Inalatória' },
  { value: 'TOPICAL', label: 'Tópica' },
  { value: 'RECTAL', label: 'Retal' },
  { value: 'OPHTHALMIC', label: 'Oftálmica' },
  { value: 'OTIC', label: 'Ótica' },
  { value: 'NASAL', label: 'Nasal' },
  { value: 'OTHER', label: 'Outra' },
]

const FREQUENCIES = [
  'Uma vez ao dia',
  'Duas vezes ao dia',
  'Três vezes ao dia',
  'Quatro vezes ao dia',
  'A cada 4 horas',
  'A cada 6 horas',
  'A cada 8 horas',
  'A cada 12 horas',
  'Dias alternados',
  'Uma vez por semana',
  'Conforme necessário (SOS)',
]

const DOSE_UNITS = ['mg', 'g', 'mcg', 'mL', 'UI', 'gotas', 'comprimido(s)', 'cápsula(s)', '%']

const PHARMA_FORMS = [
  'Comprimido', 'Cápsula', 'Solução oral', 'Suspensão', 'Xarope',
  'Injetável', 'Creme', 'Pomada', 'Gel', 'Colírio', 'Spray', 'Inalador', 'Supositório',
]

export default function NewMedicationPage() {
  const router = useRouter()
  const { id: patientId } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      route: 'ORAL',
      isSelfMedication: false,
      isActive: true,
    },
  })

  const isSelfMedication = watch('isSelfMedication')

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/patients/${patientId}/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
          endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao adicionar medicamento')
      router.push(`/patients/${patientId}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/patients/${patientId}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Adicionar Medicamento</h1>
          <p className="text-sm text-gray-500">Registre um medicamento em uso pelo paciente</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="card-padded space-y-5">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
            <Pill className="h-5 w-5 text-[#1e3a5f]" />
            <h2 className="font-semibold text-gray-900">Identificação do medicamento</h2>
          </div>

          {/* Princípio ativo + Nome comercial */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">
                Princípio ativo <span className="text-red-500">*</span>
              </label>
              <input
                {...register('activeIngredient')}
                className="input"
                placeholder="Ex: Metformina"
              />
              {errors.activeIngredient && (
                <p className="field-error">{errors.activeIngredient.message}</p>
              )}
            </div>

            <div>
              <label className="label">
                Nome comercial
                <span className="ml-1 text-xs font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                {...register('tradeName')}
                className="input"
                placeholder="Ex: Glifage"
              />
            </div>
          </div>

          {/* Dose + Unidade + Forma farmacêutica */}
          <div className="grid gap-4 grid-cols-3">
            <div>
              <label className="label">Dose</label>
              <input
                {...register('dose')}
                className="input"
                placeholder="Ex: 500"
              />
            </div>

            <div>
              <label className="label">Unidade</label>
              <select {...register('doseUnit')} className="input">
                <option value="">Selecionar</option>
                {DOSE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Forma farmacêutica</label>
              <select {...register('pharmaceuticalForm')} className="input">
                <option value="">Selecionar</option>
                {PHARMA_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          {/* Via + Frequência */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Via de administração</label>
              <select {...register('route')} className="input">
                {ROUTES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Frequência / Posologia</label>
              <select {...register('frequency')} className="input">
                <option value="">Selecionar</option>
                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                <option value="Outro">Outro (especificar nas observações)</option>
              </select>
            </div>
          </div>

          {/* Prescritor + Indicação */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Prescritor</label>
              <input
                {...register('prescriber')}
                className="input"
                placeholder="Ex: Dr. João Silva"
              />
            </div>

            <div>
              <label className="label">Indicação clínica</label>
              <input
                {...register('indication')}
                className="input"
                placeholder="Ex: Diabetes tipo 2"
              />
            </div>
          </div>

          {/* Datas */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Data de início</label>
              <input type="date" {...register('startDate')} className="input" />
            </div>

            <div>
              <label className="label">
                Data de término
                <span className="ml-1 text-xs font-normal text-gray-400">(em branco = uso contínuo)</span>
              </label>
              <input type="date" {...register('endDate')} className="input" />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex flex-wrap gap-6 rounded-lg bg-gray-50 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                {...register('isSelfMedication')}
                className="h-4 w-4 rounded border-gray-300 text-[#1e3a5f]"
              />
              Automedicação
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                {...register('isActive')}
                className="h-4 w-4 rounded border-gray-300 text-[#1e3a5f]"
              />
              Em uso ativo
            </label>
          </div>

          {isSelfMedication && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <Info className="h-4 w-4 flex-shrink-0 text-amber-600 mt-0.5" />
              <p className="text-xs text-amber-800">
                Medicamentos de automedicação serão sinalizados na análise PRM e podem indicar problemas
                de necessidade (uso sem indicação) ou de segurança (interações).
              </p>
            </div>
          )}

          {/* Efeitos adversos + Observações */}
          <div className="space-y-4">
            <div>
              <label className="label">Efeitos adversos relatados</label>
              <textarea
                {...register('adverseEffects')}
                rows={2}
                className="input resize-none"
                placeholder="Ex: Náuseas, dor abdominal..."
              />
            </div>
            <div>
              <label className="label">Observações</label>
              <textarea
                {...register('observations')}
                rows={2}
                className="input resize-none"
                placeholder="Informações adicionais, ajustes de dose, etc."
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Link href={`/patients/${patientId}`} className="btn-secondary">
            Cancelar
          </Link>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
              : <><Save className="h-4 w-4" /> Adicionar medicamento</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
