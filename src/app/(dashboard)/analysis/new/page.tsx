'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  FlaskConical, Loader2, AlertTriangle, Coins,
  ChevronRight, ChevronLeft, Plus, Trash2, Info,
  CheckCircle2, Pill, PackageCheck
} from 'lucide-react'

type Step = 'patient' | 'medications' | 'clinical' | 'confirm'

interface MedRow {
  id: string           // temp id for react key
  existingId?: string  // real DB id if from patient profile
  fromDB: boolean
  activeIngredient: string
  tradeName: string
  dose: string
  doseUnit: string
  pharmaceuticalForm: string
  route: string
  frequency: string
  indication: string
  isPrescribed: boolean
  isSelfMedication: boolean
  adherence: string
  adverseEffects: string
  selected: boolean    // whether included in this analysis
}

export default function NewAnalysisPage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const params = useSearchParams()
  const preselectedPatientId = params.get('patientId')

  const [step, setStep] = useState<Step>('patient')
  const [patients, setPatients] = useState<any[]>([])
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [medications, setMedications] = useState<MedRow[]>([])
  const [loadingMeds, setLoadingMeds] = useState(false)
  const [clinicalData, setClinicalData] = useState<any>({})
  const [tokenCost, setTokenCost] = useState<{ cost: number; label: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const steps: { id: Step; label: string }[] = [
    { id: 'patient', label: 'Paciente' },
    { id: 'medications', label: 'Medicamentos' },
    { id: 'clinical', label: 'Dados Clínicos' },
    { id: 'confirm', label: 'Confirmar' },
  ]
  const stepIndex = steps.findIndex(s => s.id === step)

  // Load patients list
  useEffect(() => {
    fetch('/api/patients').then(r => r.json()).then(d => {
      setPatients(d.data || [])
      if (preselectedPatientId) {
        const found = (d.data || []).find((p: any) => p.id === preselectedPatientId)
        if (found) selectPatient(found)
      }
    })
  }, [preselectedPatientId]) // eslint-disable-line

  // Load patient medications from DB when patient is selected
  async function selectPatient(patient: any) {
    setSelectedPatient(patient)
    setLoadingMeds(true)
    try {
      const res = await fetch(`/api/patients/${patient.id}`)
      const data = await res.json()
      if (data.success && data.data.medications?.length > 0) {
        const dbMeds: MedRow[] = data.data.medications.map((m: any) => ({
          id: `db-${m.id}`,
          existingId: m.id,
          fromDB: true,
          activeIngredient: m.activeIngredient || '',
          tradeName: m.tradeName || '',
          dose: m.dose ? String(m.dose) : '',
          doseUnit: m.doseUnit || 'mg',
          pharmaceuticalForm: m.pharmaceuticalForm || '',
          route: m.route || 'ORAL',
          frequency: m.frequency || '',
          indication: m.indication || '',
          isPrescribed: m.isPrescribed ?? true,
          isSelfMedication: m.isSelfMedication ?? false,
          adherence: m.adherence || 'UNKNOWN',
          adverseEffects: m.adverseEffects || '',
          selected: true,
        }))
        setMedications(dbMeds)
      } else {
        setMedications([])
      }
      // Pre-fill clinical data from patient profile
      setClinicalData((prev: any) => ({
        ...prev,
        renalFunction: data.data?.renalFunction || '',
        creatinineClearance: data.data?.creatinineClearance || '',
        hepaticFunction: data.data?.hepaticFunction || '',
      }))
    } catch {
      setMedications([])
    } finally {
      setLoadingMeds(false)
    }
  }

  // Token cost calc
  useEffect(() => {
    const activeMeds = medications.filter(m => m.selected)
    if (selectedPatient || activeMeds.length > 0) {
      const hasLabs = clinicalData.labResults && clinicalData.labResults.length > 0
      const medCount = activeMeds.length
      let cost = 1, label = 'Análise Básica'
      if (hasLabs || medCount > 10) { cost = 5; label = 'Análise Avançada (com exames)' }
      else if (medCount > 3) { cost = 3; label = 'Análise Completa' }
      setTokenCost({ cost, label })
    }
  }, [selectedPatient, medications, clinicalData])

  function addMedication() {
    setMedications(prev => [...prev, {
      id: Date.now().toString(),
      fromDB: false,
      activeIngredient: '',
      tradeName: '',
      dose: '',
      doseUnit: 'mg',
      pharmaceuticalForm: '',
      route: 'ORAL',
      frequency: '',
      indication: '',
      isPrescribed: true,
      isSelfMedication: false,
      adherence: 'UNKNOWN',
      adverseEffects: '',
      selected: true,
    }])
  }

  function updateMedication(id: string, field: string, value: any) {
    setMedications(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  function removeMedication(id: string) {
    setMedications(prev => prev.filter(m => m.id !== id))
  }

  function toggleSelected(id: string) {
    setMedications(prev => prev.map(m => m.id === id ? { ...m, selected: !m.selected } : m))
  }

  async function runAnalysis() {
    if (!selectedPatient || !session) return
    setIsLoading(true)
    setError('')
    try {
      const activeMeds = medications.filter(m => m.selected && m.activeIngredient.trim())
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          medications: activeMeds.map(m => ({
            existingId: m.existingId,
            activeIngredient: m.activeIngredient,
            tradeName: m.tradeName,
            dose: m.dose,
            doseUnit: m.doseUnit,
            pharmaceuticalForm: m.pharmaceuticalForm,
            route: m.route,
            frequency: m.frequency,
            indication: m.indication,
            isPrescribed: m.isPrescribed,
            isSelfMedication: m.isSelfMedication,
            adherence: m.adherence,
            adverseEffects: m.adverseEffects,
          })),
          clinicalData,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Erro ao realizar análise.')
      await update()
      router.push(`/analysis/${result.data.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const balance = session?.user?.tokenBalance ?? 0
  const activeMeds = medications.filter(m => m.selected)
  const dbMedsCount = medications.filter(m => m.fromDB).length

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="page-header">
        <h1 className="text-2xl font-bold text-foreground">Nova análise PRM</h1>
        <p className="text-muted-foreground">Seguimento farmacoterapêutico — Método Dáder</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
              i < stepIndex ? 'bg-green-500 text-white' :
              i === stepIndex ? 'bg-brand-800 text-white' :
              'bg-muted text-muted-foreground'}`}>
              {i < stepIndex ? '✓' : i + 1}
            </div>
            <span className={`text-sm font-medium ${i === stepIndex ? 'text-brand-800' : 'text-muted-foreground'}`}>{s.label}</span>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Step: Patient */}
      {step === 'patient' && (
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">Selecionar paciente</h2>
          {patients.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center">
              <p className="text-muted-foreground">Nenhum paciente cadastrado.</p>
              <a href="/patients/new" className="mt-2 block text-sm text-brand-800 hover:underline">
                + Cadastrar primeiro paciente
              </a>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {patients.map((p: any) => (
                <button key={p.id} onClick={() => selectPatient(p)}
                  className={`w-full flex items-center justify-between rounded-lg border p-4 text-left transition-all ${
                    selectedPatient?.id === p.id ? 'border-brand-800 bg-[#eff6ff]' : 'hover:border-border hover:bg-muted'
                  }`}>
                  <div>
                    <p className="font-medium text-foreground">{p.name || p.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.code} · {p.age || (p.dateOfBirth ? new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear() : null)} anos
                    </p>
                  </div>
                  {selectedPatient?.id === p.id && (
                    <CheckCircle2 className="h-5 w-5 text-brand-800" />
                  )}
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-between pt-2">
            <a href="/patients/new" className="text-sm text-brand-800 hover:underline">+ Novo paciente</a>
            <button
              onClick={() => selectedPatient && setStep('medications')}
              disabled={!selectedPatient || loadingMeds}
              className="flex items-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-40 transition-colors">
              {loadingMeds ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Próximo <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step: Medications */}
      {step === 'medications' && (
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Medicamentos em uso</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeMeds.length} de {medications.length} selecionado(s) para análise
              </p>
            </div>
            <button onClick={addMedication}
              className="flex items-center gap-1.5 rounded-lg border border-brand-800 px-3 py-1.5 text-sm font-medium text-brand-800 hover:bg-[#eff6ff] transition-colors">
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </div>

          {/* Banner: medications loaded from profile */}
          {dbMedsCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
              <PackageCheck className="h-4 w-4 flex-shrink-0" />
              <span>
                <strong>{dbMedsCount} medicamento(s)</strong> carregado(s) do cadastro do paciente.
                Desmarque os que não deseja incluir nesta análise.
              </span>
            </div>
          )}

          {medications.length === 0 ? (
            <div className="rounded-lg border border-dashed py-10 text-center">
              <Pill className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-muted-foreground">Nenhum medicamento cadastrado para este paciente.</p>
              <button onClick={addMedication} className="mt-2 text-sm text-brand-800 hover:underline">
                + Adicionar medicamento
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {medications.map((med, i) => (
                <MedicationCard
                  key={med.id}
                  med={med}
                  index={i}
                  onUpdate={(field, value) => updateMedication(med.id, field, value)}
                  onRemove={() => removeMedication(med.id)}
                  onToggle={() => toggleSelected(med.id)}
                />
              ))}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep('patient')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <button
              onClick={() => setStep('clinical')}
              disabled={activeMeds.filter(m => m.activeIngredient.trim()).length === 0}
              className="flex items-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-40 transition-colors">
              Próximo <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step: Clinical data */}
      {step === 'clinical' && (
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">Dados clínicos complementares</h2>
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-brand-800">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            Dados clínicos adicionais aumentam a precisão da análise. Campos opcionais.
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor="clinicaldata-renalfunction">Função renal</label>
              <select id="clinicaldata-renalfunction"
                value={clinicalData.renalFunction || ''}
                onChange={e => setClinicalData((p: any) => ({ ...p, renalFunction: e.target.value }))}
                className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="">Não informada</option>
                <option value="normal">Normal</option>
                <option value="mild_impairment">Leve (ClCr 60-89)</option>
                <option value="moderate_impairment">Moderada (ClCr 30-59)</option>
                <option value="severe_impairment">Grave (ClCr 15-29)</option>
                <option value="failure">Insuficiência (&lt;15)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor="clinicaldata-creatinineclearance">ClCr (mL/min)</label>
              <input id="clinicaldata-creatinineclearance"
                type="number"
                value={clinicalData.creatinineClearance || ''}
                onChange={e => setClinicalData((p: any) => ({ ...p, creatinineClearance: parseFloat(e.target.value) }))}
                className="w-full rounded-md border px-3 py-2 text-sm focus:border-brand-800 focus:outline-none"
                placeholder="Ex: 45" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor="clinicaldata-hepaticfunction">Função hepática</label>
              <select id="clinicaldata-hepaticfunction"
                value={clinicalData.hepaticFunction || ''}
                onChange={e => setClinicalData((p: any) => ({ ...p, hepaticFunction: e.target.value }))}
                className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="">Não informada</option>
                <option value="normal">Normal</option>
                <option value="mild_impairment">Leve (Child-Pugh A)</option>
                <option value="moderate_impairment">Moderada (Child-Pugh B)</option>
                <option value="severe_impairment">Grave (Child-Pugh C)</option>
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-muted-foreground">Exames laboratoriais</label>
              <button
                onClick={() => setClinicalData((p: any) => ({ ...p, labResults: [...(p.labResults || []), { examName: '', value: '', unit: '', isAbnormal: false }] }))}
                className="text-xs text-brand-800 hover:underline">
                + Adicionar exame
              </button>
            </div>
            {(clinicalData.labResults || []).map((lab: any, i: number) => (
              <div key={i} className="mb-2 flex gap-2 items-center">
                <input value={lab.examName} onChange={e => {
                  const labs = [...(clinicalData.labResults || [])]
                  labs[i] = { ...labs[i], examName: e.target.value }
                  setClinicalData((p: any) => ({ ...p, labResults: labs }))
                }} className="flex-1 rounded-md border px-2 py-1.5 text-sm" placeholder="Exame (ex: creatinina)" />
                <input value={lab.value} onChange={e => {
                  const labs = [...(clinicalData.labResults || [])]
                  labs[i] = { ...labs[i], value: e.target.value }
                  setClinicalData((p: any) => ({ ...p, labResults: labs }))
                }} className="w-24 rounded-md border px-2 py-1.5 text-sm" placeholder="Resultado" />
                <input value={lab.unit} onChange={e => {
                  const labs = [...(clinicalData.labResults || [])]
                  labs[i] = { ...labs[i], unit: e.target.value }
                  setClinicalData((p: any) => ({ ...p, labResults: labs }))
                }} className="w-16 rounded-md border px-2 py-1.5 text-sm" placeholder="Unid." />
                <label className="flex items-center gap-1 text-xs text-red-600">
                  <input type="checkbox" checked={lab.isAbnormal} onChange={e => {
                    const labs = [...(clinicalData.labResults || [])]
                    labs[i] = { ...labs[i], isAbnormal: e.target.checked }
                    setClinicalData((p: any) => ({ ...p, labResults: labs }))
                  }} className="h-3 w-3" /> Alterado
                </label>
                <button onClick={() => setClinicalData((p: any) => ({
                  ...p, labResults: p.labResults.filter((_: any, j: number) => j !== i)
                }))} className="text-red-400 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep('medications')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <button onClick={() => setStep('confirm')}
              className="flex items-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-900 transition-colors">
              Revisar e confirmar <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-foreground">Resumo da análise</h2>
            <div className="rounded-lg bg-muted p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paciente</span>
                <span className="font-medium">{selectedPatient?.name || selectedPatient?.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Medicamentos selecionados</span>
                <span className="font-medium">{activeMeds.filter(m => m.activeIngredient.trim()).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exames laboratoriais</span>
                <span className="font-medium">{clinicalData.labResults?.length || 0}</span>
              </div>
            </div>

            {/* Medication list preview */}
            {activeMeds.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Medicamentos incluídos</p>
                <ul className="space-y-1.5">
                  {activeMeds.filter(m => m.activeIngredient.trim()).map(m => (
                    <li key={m.id} className="flex items-center gap-2 text-sm">
                      <Pill className="h-3.5 w-3.5 text-brand-800 flex-shrink-0" />
                      <span className="font-medium text-foreground">{m.activeIngredient}</span>
                      {m.tradeName && <span className="text-muted-foreground text-xs">({m.tradeName})</span>}
                      {m.dose && <span className="text-muted-foreground text-xs">· {m.dose} {m.doseUnit}</span>}
                      {m.frequency && <span className="text-muted-foreground text-xs">· {m.frequency}</span>}
                      {m.fromDB && <span className="text-xs rounded-full bg-green-100 text-green-700 px-1.5 py-0.5">cadastro</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Token cost */}
          {tokenCost && (
            <div className="rounded-xl border-2 border-brand-800 bg-[#eff6ff] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-brand-800">{tokenCost.label}</p>
                  <p className="text-sm text-blue-700">Custo desta análise</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-3xl font-bold text-brand-800">
                    <Coins className="h-6 w-6" /> {tokenCost.cost}
                  </div>
                  <p className="text-xs text-blue-600">token(s)</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-blue-200 flex justify-between text-sm">
                <span className="text-blue-700">Saldo atual:</span>
                <span className={`font-semibold ${balance < tokenCost.cost ? 'text-red-600' : 'text-brand-800'}`}>
                  {balance} token(s) {balance < tokenCost.cost ? '— INSUFICIENTE' : ''}
                </span>
              </div>
            </div>
          )}

          {balance < (tokenCost?.cost ?? 0) && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Saldo insuficiente</p>
                <p className="text-sm text-red-600">Você precisa de {tokenCost?.cost} token(s) e possui apenas {balance}.</p>
                <a href="/tokens" className="mt-1 inline-block text-sm font-medium text-red-700 underline">Comprar tokens</a>
              </div>
            </div>
          )}

          <div className="clinical-disclaimer">
            <strong>Lembrete:</strong> Esta análise é de apoio técnico e não substitui avaliação profissional. As recomendações geradas devem ser validadas por farmacêutico ou médico habilitado.
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep('clinical')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <button onClick={runAnalysis}
              disabled={isLoading || balance < (tokenCost?.cost ?? 0) || activeMeds.filter(m => m.activeIngredient.trim()).length === 0}
              className="flex items-center gap-2 rounded-lg bg-brand-800 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50 transition-colors">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              {isLoading ? 'Analisando...' : `Realizar análise — ${tokenCost?.cost ?? 0} token(s)`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Medication card component ──────────────────────────────────────────────

function MedicationCard({ med, index, onUpdate, onRemove, onToggle }: {
  med: MedRow
  index: number
  onUpdate: (field: string, value: any) => void
  onRemove: () => void
  onToggle: () => void
}) {
  const [expanded, setExpanded] = useState(!med.fromDB)

  return (
    <div className={`rounded-lg border transition-all ${med.selected ? 'border-border' : 'border-border opacity-50'}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* checkbox */}
        <input
          type="checkbox"
          checked={med.selected}
          onChange={onToggle}
          title={med.selected ? 'Remover desta análise' : 'Incluir na análise'}
          className="h-4 w-4 rounded border-border text-brand-800 cursor-pointer"
        />

        <button
          onClick={() => setExpanded(e => !e)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <Pill className="h-4 w-4 text-brand-800 flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-foreground text-sm truncate">
              {med.activeIngredient || <span className="text-muted-foreground italic">Medicamento {index + 1}</span>}
              {med.tradeName && <span className="text-muted-foreground font-normal ml-1 text-xs">({med.tradeName})</span>}
            </p>
            {!expanded && (
              <p className="text-xs text-muted-foreground truncate">
                {[med.dose && `${med.dose}${med.doseUnit}`, med.frequency].filter(Boolean).join(' · ')}
                {med.fromDB && ' · do cadastro'}
              </p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          {med.fromDB && (
            <span className="text-xs rounded-full bg-green-100 text-green-700 px-2 py-0.5">cadastro</span>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
          >
            {expanded ? 'Recolher' : 'Editar'}
          </button>
          {!med.fromDB && (
            <button onClick={onRemove} className="text-red-400 hover:text-red-600 p-1">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div className="border-t px-4 py-4 space-y-3 bg-muted rounded-b-lg">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor="med-activeingredient">Princípio ativo *</label>
              <input id="med-activeingredient" value={med.activeIngredient}
                onChange={e => onUpdate('activeIngredient', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:border-brand-800 focus:outline-none bg-card"
                placeholder="Ex: metformina" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor="med-tradename">Nome comercial</label>
              <input id="med-tradename" value={med.tradeName}
                onChange={e => onUpdate('tradeName', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:border-brand-800 focus:outline-none bg-card"
                placeholder="Ex: Glifage" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Dose</label>
              <div className="flex gap-1">
                <input type="number" value={med.dose}
                  onChange={e => onUpdate('dose', e.target.value)}
                  className="w-24 rounded-md border px-3 py-2 text-sm focus:border-brand-800 focus:outline-none bg-card"
                  placeholder="500" />
                <select value={med.doseUnit}
                  onChange={e => onUpdate('doseUnit', e.target.value)}
                  className="flex-1 rounded-md border px-2 py-2 text-sm bg-card">
                  {['mg', 'mcg', 'g', 'mL', 'UI', 'mg/mL', '%'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor="med-route">Via de administração</label>
              <select id="med-route" value={med.route}
                onChange={e => onUpdate('route', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-card">
                {[['ORAL', 'Oral'], ['SUBLINGUAL', 'Sublingual'], ['INHALED', 'Inalatória'],
                  ['INTRAVENOUS', 'Intravenosa'], ['INTRAMUSCULAR', 'Intramuscular'],
                  ['TOPICAL', 'Tópica'], ['TRANSDERMAL', 'Transdérmica'], ['OTHER', 'Outra']]
                  .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor={`med-${index}-frequency`}>Frequência</label>
              <select id={`med-${index}-frequency`} value={med.frequency}
                onChange={e => onUpdate('frequency', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-card">
                <option value="">Selecionar</option>
                {['1x ao dia', '2x ao dia', '3x ao dia', '4x ao dia', 'Dose única', 'Conforme necessário', 'Semanal', 'Quinzenal', 'Mensal']
                  .map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor={`med-${index}-adherence`}>Adesão</label>
              <select id={`med-${index}-adherence`} value={med.adherence}
                onChange={e => onUpdate('adherence', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-card">
                {[['UNKNOWN', 'Não avaliada'], ['EXCELLENT', 'Excelente (>95%)'],
                  ['GOOD', 'Boa (80-95%)'], ['MODERATE', 'Moderada (50-79%)'], ['POOR', 'Baixa (<50%)']]
                  .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor={`med-${index}-indication`}>Indicação / motivo do uso</label>
              <input id={`med-${index}-indication`} value={med.indication}
                onChange={e => onUpdate('indication', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:border-brand-800 focus:outline-none bg-card"
                placeholder="Ex: diabetes tipo 2, hipertensão..." />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor={`med-${index}-adverseEffects`}>Efeitos adversos relatados</label>
              <input id={`med-${index}-adverseEffects`} value={med.adverseEffects}
                onChange={e => onUpdate('adverseEffects', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:border-brand-800 focus:outline-none bg-card"
                placeholder="Ex: náusea, tontura..." />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={med.isSelfMedication}
                  onChange={e => onUpdate('isSelfMedication', e.target.checked)}
                  className="h-4 w-4 rounded" />
                Automedicação
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={med.isPrescribed}
                  onChange={e => onUpdate('isPrescribed', e.target.checked)}
                  className="h-4 w-4 rounded" />
                Prescrito
              </label>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => setExpanded(false)}
              className="text-xs text-muted-foreground hover:text-foreground underline">
              Recolher
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
