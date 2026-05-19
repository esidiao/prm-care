'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, User, Heart, AlertTriangle,
  Stethoscope, FlaskConical, Save, Loader2, Pill, CheckCircle2
} from 'lucide-react'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const patientSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  birthDate: z.string().optional(),
  age: z.coerce.number().optional().or(z.literal('')),
  sex: z.enum(['MALE', 'FEMALE', 'OTHER']),
  weight: z.coerce.number().positive().optional().or(z.literal('')),
  height: z.coerce.number().positive().optional().or(z.literal('')),
  isPregnant: z.boolean().default(false),
  gestationalAge: z.coerce.number().optional().or(z.literal('')),
  isLactating: z.boolean().default(false),
  renalFunction: z.string().optional(),
  creatinineClearance: z.coerce.number().optional().or(z.literal('')),
  hepaticFunction: z.string().optional(),
  chiefComplaint: z.string().optional(),
  clinicalHistory: z.string().optional(),
  observations: z.string().optional(),
  comorbidities: z.array(z.object({
    name: z.string().min(1, 'Nome obrigatório'),
    icd10Code: z.string().optional(),
  })).default([]),
  allergies: z.array(z.object({
    substance: z.string().min(1, 'Substância obrigatória'),
    severity: z.string().optional(),
    reaction: z.string().optional(),
  })).default([]),
  diagnoses: z.array(z.object({
    name: z.string().min(1, 'Diagnóstico obrigatório'),
    icd10Code: z.string().optional(),
    isPrimary: z.boolean().default(false),
  })).default([]),
})

const medSchema = z.object({
  activeIngredient: z.string().min(1, 'Princípio ativo obrigatório'),
  tradeName: z.string().optional(),
  dose: z.coerce.number().optional().or(z.literal('')),
  doseUnit: z.string().optional(),
  pharmaceuticalForm: z.string().optional(),
  route: z.string().optional(),
  frequency: z.string().optional(),
  indication: z.string().optional(),
  adherence: z.string().optional(),
  isSelfMedication: z.boolean().default(false),
  adverseEffects: z.string().optional(),
})

type PatientForm = z.infer<typeof patientSchema>
type MedForm = z.infer<typeof medSchema>

const RENAL_OPTIONS = [
  { value: '', label: 'Selecionar...' },
  { value: 'normal', label: 'Normal' },
  { value: 'mild_impairment', label: 'Leve (ClCr 60–89 mL/min)' },
  { value: 'moderate_impairment', label: 'Moderada (ClCr 30–59 mL/min)' },
  { value: 'severe_impairment', label: 'Grave (ClCr 15–29 mL/min)' },
  { value: 'failure', label: 'Insuficiência renal (ClCr < 15 mL/min)' },
]
const HEPATIC_OPTIONS = [
  { value: '', label: 'Selecionar...' },
  { value: 'normal', label: 'Normal' },
  { value: 'mild_impairment', label: 'Leve (Child-Pugh A)' },
  { value: 'moderate_impairment', label: 'Moderada (Child-Pugh B)' },
  { value: 'severe_impairment', label: 'Grave (Child-Pugh C)' },
]
const ADHERENCE_OPTIONS = [
  { value: 'EXCELLENT', label: 'Excelente (> 95%)' },
  { value: 'GOOD', label: 'Boa (80–95%)' },
  { value: 'MODERATE', label: 'Moderada (50–79%)' },
  { value: 'POOR', label: 'Baixa (< 50%)' },
  { value: 'UNKNOWN', label: 'Não avaliada' },
]
const ROUTE_OPTIONS = [
  { value: 'ORAL', label: 'Oral' },
  { value: 'SUBLINGUAL', label: 'Sublingual' },
  { value: 'INTRAVENOUS', label: 'Intravenoso' },
  { value: 'INTRAMUSCULAR', label: 'Intramuscular' },
  { value: 'SUBCUTANEOUS', label: 'Subcutâneo' },
  { value: 'INHALED', label: 'Inalatório' },
  { value: 'TOPICAL', label: 'Tópico' },
  { value: 'TRANSDERMAL', label: 'Transdérmico' },
  { value: 'RECTAL', label: 'Retal' },
  { value: 'OPHTHALMIC', label: 'Oftálmico' },
  { value: 'NASAL', label: 'Nasal' },
  { value: 'OTHER', label: 'Outro' },
]

// ─── Medication Edit Row ──────────────────────────────────────────────────────

function MedEditRow({ med, onSave, onDelete }: {
  med: any
  onSave: (id: string, data: any) => Promise<void>
  onDelete: (id: string, name: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saved, setSaved] = useState(false)

  const { register, handleSubmit } = useForm<MedForm>({
    resolver: zodResolver(medSchema),
    defaultValues: {
      activeIngredient: med.activeIngredient || '',
      tradeName: med.tradeName || '',
      dose: med.dose || '',
      doseUnit: med.doseUnit || '',
      pharmaceuticalForm: med.pharmaceuticalForm || '',
      route: med.route || 'ORAL',
      frequency: med.frequency || '',
      indication: med.indication || '',
      adherence: med.adherence || 'UNKNOWN',
      isSelfMedication: med.isSelfMedication || false,
      adverseEffects: med.adverseEffects || '',
    },
  })

  const onSubmit = async (data: MedForm) => {
    setSaving(true)
    await onSave(med.id, data)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setExpanded(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    await onDelete(med.id, med.activeIngredient)
    setDeleting(false)
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50">
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex-1 text-left">
          <div className="flex items-center gap-3">
            <Pill className="h-4 w-4 text-[#1e3a5f] shrink-0" />
            <div>
              <span className="font-medium text-gray-900 text-sm">{med.activeIngredient}</span>
              {med.tradeName && <span className="text-xs text-gray-400 ml-2">({med.tradeName})</span>}
              <span className="text-xs text-gray-500 ml-3">
                {med.dose ? `${med.dose}${med.doseUnit || ''}` : ''} {med.frequency ? `· ${med.frequency}` : ''}
              </span>
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {saved && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-[#1e3a5f] hover:underline px-2 py-1"
          >
            {expanded ? 'Fechar' : 'Editar'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <form onSubmit={handleSubmit(onSubmit)} className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Princípio ativo *</label>
              <input {...register('activeIngredient')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: Atorvastatina" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome comercial</label>
              <input {...register('tradeName')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: Lipitor" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Dose</label>
              <input {...register('dose')} type="number" step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: 20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Unidade da dose</label>
              <input {...register('doseUnit')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: mg, mcg, UI" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Forma farmacêutica</label>
              <input {...register('pharmaceuticalForm')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: Comprimido, Cápsula, Solução" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Via de administração</label>
              <select {...register('route')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                {ROUTE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Frequência / Posologia</label>
              <input {...register('frequency')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: 1x ao dia, 8/8h" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Indicação / Motivo do uso</label>
              <input {...register('indication')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: Hipertensão arterial" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Adesão ao tratamento</label>
              <select {...register('adherence')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                {ADHERENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" {...register('isSelfMedication')} id={`self-${med.id}`}
                className="rounded border-gray-300 text-blue-600" />
              <label htmlFor={`self-${med.id}`} className="text-sm text-gray-600">Automedicação</label>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Efeitos adversos / Observações</label>
              <textarea {...register('adverseEffects')} rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Ex: Relata mialgia leve, dificuldade de deglutição..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setExpanded(false)}
              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1e3a5f] text-white text-sm rounded-lg hover:bg-[#162d4a] disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? 'Salvando...' : 'Salvar medicamento'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EditPatientPage() {
  const router = useRouter()
  const params = useParams()
  const patientId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [medications, setMedications] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'basic' | 'clinical' | 'comorbidities' | 'allergies' | 'diagnoses' | 'medications'>('basic')

  const { register, control, handleSubmit, watch, reset, formState: { errors } } = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
    defaultValues: { sex: 'MALE', isPregnant: false, isLactating: false, comorbidities: [], allergies: [], diagnoses: [] },
  })

  const comorbidities = useFieldArray({ control, name: 'comorbidities' })
  const allergies = useFieldArray({ control, name: 'allergies' })
  const diagnoses = useFieldArray({ control, name: 'diagnoses' })

  // Load patient data
  useEffect(() => {
    fetch(`/api/patients/${patientId}`)
      .then(r => r.json())
      .then(json => {
        const p = json.data
        if (!p) return
        reset({
          name: p.name || '',
          birthDate: p.dateOfBirth ? p.dateOfBirth.substring(0, 10) : '',
          age: p.age || '',
          sex: p.sex || 'MALE',
          weight: p.weight || '',
          height: p.height || '',
          isPregnant: p.isPregnant || false,
          gestationalAge: p.gestationalAge || '',
          isLactating: p.isLactating || false,
          renalFunction: p.renalFunction || '',
          creatinineClearance: p.creatinineClearance || '',
          hepaticFunction: p.hepaticFunction || '',
          chiefComplaint: p.chiefComplaint || '',
          clinicalHistory: p.clinicalHistory || '',
          observations: p.observations || '',
          comorbidities: (p.comorbidities || []).map((c: any) => ({ name: c.name, icd10Code: c.icd10Code || '' })),
          allergies: (p.allergies || []).map((a: any) => ({ substance: a.substance, severity: a.severity || 'MODERATE', reaction: a.reaction || '' })),
          diagnoses: (p.diagnoses || []).map((d: any) => ({ name: d.name, icd10Code: d.icd10Code || '', isPrimary: d.isPrimary || false })),
        })
        setMedications(p.medications || [])
        setLoading(false)
      })
      .catch(() => { setError('Erro ao carregar paciente.'); setLoading(false) })
  }, [patientId, reset])

  const onSubmit = async (data: PatientForm) => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          dateOfBirth: data.birthDate || undefined,
          age: data.age || undefined,
          sex: data.sex,
          weight: data.weight || undefined,
          height: data.height || undefined,
          isPregnant: data.isPregnant,
          gestationalAge: data.gestationalAge || undefined,
          isLactating: data.isLactating,
          renalFunction: data.renalFunction || undefined,
          creatinineClearance: data.creatinineClearance || undefined,
          hepaticFunction: data.hepaticFunction || undefined,
          chiefComplaint: data.chiefComplaint,
          clinicalHistory: data.clinicalHistory,
          observations: data.observations,
          comorbidities: data.comorbidities,
          allergies: data.allergies,
          diagnoses: data.diagnoses,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveMed = async (id: string, data: MedForm) => {
    const res = await fetch(`/api/medications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      alert('Erro ao salvar medicamento.')
      return
    }
    const json = await res.json()
    setMedications(prev => prev.map(m => m.id === id ? { ...m, ...json.data } : m))
  }

  const handleDeleteMed = async (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"? Esta ação não pode ser desfeita.`)) return
    const res = await fetch(`/api/medications/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setMedications(prev => prev.filter(m => m.id !== id))
    } else {
      alert('Erro ao excluir medicamento.')
    }
  }

  const tabs = [
    { id: 'basic', label: 'Dados pessoais', icon: User },
    { id: 'clinical', label: 'Dados clínicos', icon: Stethoscope },
    { id: 'comorbidities', label: 'Comorbidades', icon: Heart, count: comorbidities.fields.length },
    { id: 'allergies', label: 'Alergias', icon: AlertTriangle, count: allergies.fields.length },
    { id: 'diagnoses', label: 'Diagnósticos', icon: Stethoscope, count: diagnoses.fields.length },
    { id: 'medications', label: 'Medicamentos', icon: Pill, count: medications.length },
  ] as const

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/patients/${patientId}`} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Paciente</h1>
          <p className="text-sm text-gray-500 mt-0.5">Atualize os dados do paciente e seus medicamentos</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Dados do paciente salvos com sucesso!
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-gray-200">
            {tabs.map(tab => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {'count' in tab && tab.count > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* ── Dados pessoais ── */}
            {activeTab === 'basic' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                    <input {...register('name')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Nome do paciente" />
                    {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de nascimento</label>
                    <input type="date" {...register('birthDate')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Idade (se sem data de nascimento)</label>
                    <input type="number" {...register('age')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: 65" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sexo biológico</label>
                    <select {...register('sex')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option value="MALE">Masculino</option>
                      <option value="FEMALE">Feminino</option>
                      <option value="OTHER">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
                    <input type="number" step="0.1" {...register('weight')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: 70.5" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Altura (cm)</label>
                    <input type="number" step="0.1" {...register('height')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: 168" />
                  </div>
                  {watch('sex') === 'FEMALE' && (
                    <>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input type="checkbox" {...register('isPregnant')} className="rounded border-gray-300 text-blue-600" />
                          Gestante
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input type="checkbox" {...register('isLactating')} className="rounded border-gray-300 text-blue-600" />
                          Lactante
                        </label>
                      </div>
                      {watch('isPregnant') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Idade gestacional (semanas)</label>
                          <input type="number" {...register('gestationalAge')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Ex: 28" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Dados clínicos ── */}
            {activeTab === 'clinical' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Função renal</label>
                    <select {...register('renalFunction')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      {RENAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Clearance de creatinina (mL/min)</label>
                    <input type="number" step="0.1" {...register('creatinineClearance')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: 55" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Função hepática</label>
                    <select {...register('hepaticFunction')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      {HEPATIC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Queixa principal</label>
                    <input {...register('chiefComplaint')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: Dor torácica, falta de ar, tontura..." />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">História clínica</label>
                    <textarea {...register('clinicalHistory')} rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      placeholder="Resumo da história clínica relevante..." />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observações gerais</label>
                    <textarea {...register('observations')} rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      placeholder="Informações adicionais relevantes..." />
                  </div>
                </div>
              </div>
            )}

            {/* ── Comorbidades ── */}
            {activeTab === 'comorbidities' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Condições de saúde do paciente</p>
                  <button type="button" onClick={() => comorbidities.append({ name: '', icd10Code: '' })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white text-sm font-medium rounded-lg hover:bg-[#162d4a]">
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                </div>
                {comorbidities.fields.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Heart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma comorbidade registrada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comorbidities.fields.map((field, idx) => (
                      <div key={field.id} className="flex gap-3 items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1 grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <input {...register(`comorbidities.${idx}.name`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                              placeholder="Ex: Hipertensão arterial" />
                          </div>
                          <input {...register(`comorbidities.${idx}.icd10Code`)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            placeholder="CID-10 (Ex: I10)" />
                        </div>
                        <button type="button" onClick={() => comorbidities.remove(idx)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Alergias ── */}
            {activeTab === 'allergies' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Alergias e intolerâncias</p>
                  <button type="button" onClick={() => allergies.append({ substance: '', severity: 'MODERATE', reaction: '' })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white text-sm font-medium rounded-lg hover:bg-[#162d4a]">
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                </div>
                {allergies.fields.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma alergia registrada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allergies.fields.map((field, idx) => (
                      <div key={field.id} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1 grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Substância</label>
                            <input {...register(`allergies.${idx}.substance`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                              placeholder="Ex: Penicilina" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Gravidade</label>
                            <select {...register(`allergies.${idx}.severity`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                              <option value="MILD">Leve</option>
                              <option value="MODERATE">Moderada</option>
                              <option value="SEVERE">Grave</option>
                              <option value="anaphylaxis">Anafilaxia</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Tipo de reação</label>
                            <input {...register(`allergies.${idx}.reaction`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                              placeholder="Ex: Urticária, Anafilaxia" />
                          </div>
                        </div>
                        <button type="button" onClick={() => allergies.remove(idx)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg mt-5">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Diagnósticos ── */}
            {activeTab === 'diagnoses' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Diagnósticos atuais</p>
                  <button type="button" onClick={() => diagnoses.append({ name: '', icd10Code: '', isPrimary: false })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white text-sm font-medium rounded-lg hover:bg-[#162d4a]">
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                </div>
                {diagnoses.fields.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Stethoscope className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum diagnóstico registrado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {diagnoses.fields.map((field, idx) => (
                      <div key={field.id} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1 grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">Diagnóstico</label>
                            <input {...register(`diagnoses.${idx}.name`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                              placeholder="Ex: Insuficiência cardíaca congestiva" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">CID-10</label>
                            <input {...register(`diagnoses.${idx}.icd10Code`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                              placeholder="Ex: I50" />
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-2 pt-5">
                          <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
                            <input type="checkbox" {...register(`diagnoses.${idx}.isPrimary`)} className="rounded border-gray-300 text-blue-600" />
                            Principal
                          </label>
                          <button type="button" onClick={() => diagnoses.remove(idx)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Medicamentos ── */}
            {activeTab === 'medications' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-500">Clique em <strong>Editar</strong> para alterar os dados de cada medicamento</p>
                  <Link href={`/patients/${patientId}/medications/new`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white text-sm font-medium rounded-lg hover:bg-[#162d4a]">
                    <Plus className="w-4 h-4" /> Novo medicamento
                  </Link>
                </div>
                {medications.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Pill className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum medicamento cadastrado</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {medications.map(med => (
                      <MedEditRow key={med.id} med={med} onSave={handleSaveMed} onDelete={handleDeleteMed} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer — só aparece nas abas de perfil */}
        {activeTab !== 'medications' && (
          <div className="flex items-center justify-between">
            <Link href={`/patients/${patientId}`}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </Link>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-[#1e3a5f] text-white text-sm font-medium rounded-lg hover:bg-[#162d4a] disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
