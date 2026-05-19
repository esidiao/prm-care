'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, User, Heart, AlertTriangle,
  Stethoscope, FlaskConical, Save, Loader2
} from 'lucide-react'

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  birthDate: z.string().min(1, 'Data de nascimento obrigatória'),
  sex: z.enum(['MALE', 'FEMALE', 'OTHER']),
  weight: z.coerce.number().positive().optional().or(z.literal('')),
  height: z.coerce.number().positive().optional().or(z.literal('')),
  creatinine: z.coerce.number().positive().optional().or(z.literal('')),
  isPregnant: z.boolean().default(false),
  isLactating: z.boolean().default(false),
  observations: z.string().optional(),
  comorbidities: z.array(z.object({
    name: z.string().min(2, 'Nome obrigatório'),
    icd10Code: z.string().optional(),
    isActive: z.boolean().default(true),
  })).default([]),
  allergies: z.array(z.object({
    substance: z.string().min(1, 'Substância obrigatória'),
    severity: z.enum(['MILD', 'MODERATE', 'SEVERE']),
    reaction: z.string().optional(),
  })).default([]),
  diagnoses: z.array(z.object({
    description: z.string().min(2, 'Descrição obrigatória'),
    icd10Code: z.string().optional(),
    isPrimary: z.boolean().default(false),
  })).default([]),
  labResults: z.array(z.object({
    name: z.string().min(1, 'Nome obrigatório'),
    value: z.string().min(1, 'Valor obrigatório'),
    unit: z.string().optional(),
    referenceRange: z.string().optional(),
    collectedAt: z.string().optional(),
  })).default([]),
})

type FormData = z.infer<typeof schema>

const severityLabels = { MILD: 'Leve', MODERATE: 'Moderada', SEVERE: 'Grave' }

export default function NewPatientPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'basic' | 'comorbidities' | 'allergies' | 'diagnoses' | 'labs'>('basic')

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      sex: 'MALE',
      isPregnant: false,
      isLactating: false,
      comorbidities: [],
      allergies: [],
      diagnoses: [],
      labResults: [],
    },
  })

  const comorbidities = useFieldArray({ control, name: 'comorbidities' })
  const allergies = useFieldArray({ control, name: 'allergies' })
  const diagnoses = useFieldArray({ control, name: 'diagnoses' })
  const labResults = useFieldArray({ control, name: 'labResults' })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          dateOfBirth: data.birthDate ? new Date(data.birthDate).toISOString() : undefined,
          sex: data.sex,
          weight: data.weight || undefined,
          height: data.height || undefined,
          isPregnant: data.isPregnant,
          isLactating: data.isLactating,
          observations: data.observations,
          comorbidities: data.comorbidities,
          allergies: data.allergies,
          diagnoses: data.diagnoses,
          labResults: data.labResults,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao criar paciente')
      router.push(`/patients/${json.data.id}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'basic', label: 'Dados básicos', icon: User, count: null },
    { id: 'comorbidities', label: 'Comorbidades', icon: Heart, count: comorbidities.fields.length },
    { id: 'allergies', label: 'Alergias', icon: AlertTriangle, count: allergies.fields.length },
    { id: 'diagnoses', label: 'Diagnósticos', icon: Stethoscope, count: diagnoses.fields.length },
    { id: 'labs', label: 'Exames', icon: FlaskConical, count: labResults.fields.length },
  ] as const

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/patients" className="text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Paciente</h1>
          <p className="text-sm text-gray-500 mt-0.5">Cadastre os dados do paciente para análise farmacoterapêutica</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex overflow-x-auto border-b border-gray-200">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== null && tab.count > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* ── Basic Tab ── */}
            {activeTab === 'basic' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome completo <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register('name')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Nome do paciente"
                    />
                    {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data de nascimento <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      {...register('birthDate')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                    {errors.birthDate && <p className="mt-1 text-xs text-red-600">{errors.birthDate.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
                    <select
                      {...register('sex')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="MALE">Masculino</option>
                      <option value="FEMALE">Feminino</option>
                      <option value="OTHER">Outro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      {...register('weight')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Ex: 70.5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Altura (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      {...register('height')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Ex: 170"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Creatinina sérica (mg/dL)
                      <span className="ml-1 text-xs text-gray-400">(para cálculo de TFG)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('creatinine')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Ex: 1.1"
                    />
                  </div>
                </div>

                {watch('sex') === 'FEMALE' && (
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" {...register('isPregnant')} className="rounded border-gray-300 text-blue-600" />
                      Gestante
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" {...register('isLactating')} className="rounded border-gray-300 text-blue-600" />
                      Lactante
                    </label>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações clínicas</label>
                  <textarea
                    {...register('observations')}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                    placeholder="Informações adicionais relevantes..."
                  />
                </div>
              </div>
            )}

            {/* ── Comorbidities Tab ── */}
            {activeTab === 'comorbidities' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Adicione as condições de saúde do paciente</p>
                  <button
                    type="button"
                    onClick={() => comorbidities.append({ name: '', icd10Code: '', isActive: true })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                </div>

                {comorbidities.fields.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Heart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma comorbidade adicionada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comorbidities.fields.map((field, idx) => (
                      <div key={field.id} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1 grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <input
                              {...register(`comorbidities.${idx}.name`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Ex: Hipertensão arterial"
                            />
                            {errors.comorbidities?.[idx]?.name && (
                              <p className="mt-1 text-xs text-red-600">{errors.comorbidities[idx]?.name?.message}</p>
                            )}
                          </div>
                          <input
                            {...register(`comorbidities.${idx}.icd10Code`)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="CID-10 (Ex: I10)"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => comorbidities.remove(idx)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Allergies Tab ── */}
            {activeTab === 'allergies' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Registre alergias e intolerâncias a medicamentos ou substâncias</p>
                  <button
                    type="button"
                    onClick={() => allergies.append({ substance: '', severity: 'MODERATE', reaction: '' })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
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
                            <input
                              {...register(`allergies.${idx}.substance`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Ex: Penicilina"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Gravidade</label>
                            <select
                              {...register(`allergies.${idx}.severity`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              {Object.entries(severityLabels).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Reação</label>
                            <input
                              {...register(`allergies.${idx}.reaction`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Ex: Urticária"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => allergies.remove(idx)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors mt-5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Diagnoses Tab ── */}
            {activeTab === 'diagnoses' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Diagnósticos atuais do paciente</p>
                  <button
                    type="button"
                    onClick={() => diagnoses.append({ description: '', icd10Code: '', isPrimary: false })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
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
                            <label className="block text-xs text-gray-500 mb-1">Descrição</label>
                            <input
                              {...register(`diagnoses.${idx}.description`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Ex: Insuficiência cardíaca congestiva"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">CID-10</label>
                            <input
                              {...register(`diagnoses.${idx}.icd10Code`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Ex: I50"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-2 pt-5">
                          <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
                            <input
                              type="checkbox"
                              {...register(`diagnoses.${idx}.isPrimary`)}
                              className="rounded border-gray-300 text-blue-600"
                            />
                            Principal
                          </label>
                          <button
                            type="button"
                            onClick={() => diagnoses.remove(idx)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Lab Results Tab ── */}
            {activeTab === 'labs' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Resultados de exames laboratoriais recentes</p>
                  <button
                    type="button"
                    onClick={() => labResults.append({ name: '', value: '', unit: '', referenceRange: '', collectedAt: '' })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                </div>

                {labResults.fields.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <FlaskConical className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum exame registrado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {labResults.fields.map((field, idx) => (
                      <div key={field.id} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Exame</label>
                            <input
                              {...register(`labResults.${idx}.name`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Ex: Creatinina"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Resultado</label>
                            <input
                              {...register(`labResults.${idx}.value`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Ex: 1.2"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Unidade</label>
                            <input
                              {...register(`labResults.${idx}.unit`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Ex: mg/dL"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Data coleta</label>
                            <input
                              type="date"
                              {...register(`labResults.${idx}.collectedAt`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div className="md:col-span-4">
                            <label className="block text-xs text-gray-500 mb-1">Valor de referência</label>
                            <input
                              {...register(`labResults.${idx}.referenceRange`)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Ex: 0.7–1.3 mg/dL"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => labResults.remove(idx)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors mt-5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between">
          <Link
            href="/patients"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
          <div className="flex items-center gap-3">
            {/* Quick nav between tabs */}
            <div className="flex gap-1">
              {tabs.map((tab, i) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-2 h-2 rounded-full transition-colors ${activeTab === tab.id ? 'bg-blue-600' : 'bg-gray-300'}`}
                  title={tab.label}
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {loading ? 'Salvando...' : 'Salvar paciente'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
