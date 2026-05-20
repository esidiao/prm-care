'use client'
import React, { useState } from 'react'
import { Calculator, Activity, Heart, ClipboardList, Info, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type CalcTab = 'ckd-epi' | 'cockcroft' | 'charlson' | 'ascvd'

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, unit, value, onChange, min = 0, max = 999, step = 1, hint }: {
  label: string; unit?: string; value: string; onChange: (v: string) => void
  min?: number; max?: number; step?: number; hint?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-700">{label}{unit ? <span className="text-gray-400 font-normal"> ({unit})</span> : ''}</label>
      <input
        type="number" value={value} onChange={e => onChange(e.target.value)}
        min={min} max={max} step={step}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
      />
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
    </div>
  )
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-700">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function ResultBox({ label, value, unit, interpretation, color = 'blue', note }: {
  label: string; value: string | number; unit?: string; interpretation?: string
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'orange'; note?: string
}) {
  const colors = {
    blue:   'bg-blue-50 border-blue-200 text-blue-900',
    green:  'bg-green-50 border-green-200 text-green-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    red:    'bg-red-50 border-red-200 text-red-900',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-3xl font-bold">
        {value}{unit && <span className="text-lg font-normal opacity-60 ml-1">{unit}</span>}
      </p>
      {interpretation && <p className="text-sm font-semibold mt-1">{interpretation}</p>}
      {note && <p className="text-xs opacity-60 mt-1">{note}</p>}
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600 space-y-1">
      {children}
    </div>
  )
}

// ── CKD-EPI 2021 ─────────────────────────────────────────────────────────────

function CKDEPICalc() {
  const [creatinine, setCreatinine] = useState('')
  const [age, setAge]               = useState('')
  const [sex, setSex]               = useState('female')
  const [showDetail, setShowDetail] = useState(false)

  const calc = (): { gfr: number; stage: string; color: 'green' | 'yellow' | 'orange' | 'red'; desc: string } | null => {
    const scr = parseFloat(creatinine)
    const a   = parseInt(age)
    if (!scr || !a || scr <= 0 || a <= 0) return null

    // CKD-EPI 2021 (sem raça)
    const kappa = sex === 'female' ? 0.7 : 0.9
    const alpha = sex === 'female' ? -0.241 : -0.302
    const ratio = scr / kappa
    const gfr = 142 *
      Math.pow(Math.min(ratio, 1), alpha) *
      Math.pow(Math.max(ratio, 1), -1.200) *
      Math.pow(0.9938, a) *
      (sex === 'female' ? 1.012 : 1)

    const g = Math.round(gfr)
    if (g >= 90)     return { gfr: g, stage: 'G1', color: 'green',  desc: 'Normal ou elevada' }
    if (g >= 60)     return { gfr: g, stage: 'G2', color: 'green',  desc: 'Levemente reduzida' }
    if (g >= 45)     return { gfr: g, stage: 'G3a', color: 'yellow', desc: 'Leve a moderadamente reduzida' }
    if (g >= 30)     return { gfr: g, stage: 'G3b', color: 'orange', desc: 'Moderada a gravemente reduzida' }
    if (g >= 15)     return { gfr: g, stage: 'G4', color: 'red',    desc: 'Gravemente reduzida' }
    return           { gfr: g, stage: 'G5', color: 'red', desc: 'Insuficiência renal (considerar diálise)' }
  }

  const result = calc()

  const reset = () => { setCreatinine(''); setAge('') }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Creatinina sérica" unit="mg/dL" value={creatinine} onChange={setCreatinine} step={0.01} min={0.1} max={20} hint="Jejum preferível" />
        <Field label="Idade" unit="anos" value={age} onChange={setAge} min={18} max={120} />
        <Select label="Sexo biológico" value={sex} onChange={setSex}
          options={[{ value: 'female', label: 'Feminino' }, { value: 'male', label: 'Masculino' }]} />
      </div>

      {result ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ResultBox
            label="TFG estimada (CKD-EPI 2021)"
            value={result.gfr}
            unit="mL/min/1,73m²"
            interpretation={`Estágio ${result.stage} — ${result.desc}`}
            color={result.color}
          />
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Implicações clínicas</p>
            {[
              { cond: result.gfr >= 60, text: '✓ Metformina: segura (monitorar com TFG 45-60)', ok: true },
              { cond: result.gfr < 60,  text: `${result.gfr < 30 ? '🚫' : '⚠️'} Metformina: ${result.gfr < 30 ? 'contraindicada' : 'reduzir dose'}`, ok: false },
              { cond: result.gfr < 45,  text: '🚫 AINEs: evitar (risco de IRA)', ok: false },
              { cond: result.gfr < 30,  text: '🚫 Nitrofurantoína: contraindicada', ok: false },
              { cond: result.gfr < 30,  text: '⚠️ Digoxina: reduzir dose (acumulação)', ok: false },
              { cond: result.gfr < 60,  text: '⚠️ Alopurinol: iniciar com dose baixa (50 mg/dia)', ok: false },
              { cond: result.gfr < 35,  text: '🚫 Bisfosfonatos: contraindicados', ok: false },
            ].filter(i => i.cond).map((item, i) => (
              <p key={i} className={`text-xs ${item.ok ? 'text-green-700' : 'text-orange-800'}`}>{item.text}</p>
            ))}
            {result.gfr >= 60 && <p className="text-xs text-green-700">✓ Maioria dos medicamentos sem restrição renal</p>}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
          Preencha os campos para calcular a TFG
        </div>
      )}

      <div>
        <button onClick={() => setShowDetail(d => !d)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
          <Info className="h-3.5 w-3.5" />
          {showDetail ? 'Ocultar detalhes' : 'Sobre a equação CKD-EPI 2021'}
          {showDetail ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {showDetail && (
          <InfoBox>
            <p><strong>Equação CKD-EPI 2021 (sem raça)</strong> — Colaboração CKD-EPI / NEJM 2021</p>
            <p>Recomendada pela KDIGO 2024 para estimativa da TFG em adultos.</p>
            <p>Mais precisa que MDRD, especialmente com TFG &gt; 60 mL/min/1,73m².</p>
            <p><strong>Limitações:</strong> Não indicada em amputados, musculação intensa, gravidez, caquexia grave.</p>
            <p><strong>Referência:</strong> Inker LA et al. NEJM 2021;385:1737–1749.</p>
          </InfoBox>
        )}
      </div>

      <button onClick={reset} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
        <RotateCcw className="h-3 w-3" /> Limpar
      </button>
    </div>
  )
}

// ── Cockcroft-Gault ───────────────────────────────────────────────────────────

function CockcroftGaultCalc() {
  const [creatinine, setCreatinine] = useState('')
  const [age, setAge]               = useState('')
  const [weight, setWeight]         = useState('')
  const [sex, setSex]               = useState('male')
  const [showDetail, setShowDetail] = useState(false)

  const calc = (): { clcr: number; color: 'green' | 'yellow' | 'orange' | 'red'; stage: string } | null => {
    const scr = parseFloat(creatinine)
    const a   = parseInt(age)
    const w   = parseFloat(weight)
    if (!scr || !a || !w || scr <= 0 || a <= 0 || w <= 0) return null

    const sexFactor = sex === 'female' ? 0.85 : 1
    const clcr = ((140 - a) * w * sexFactor) / (72 * scr)
    const c = Math.round(clcr)

    if (c >= 90) return { clcr: c, color: 'green',  stage: 'Normal' }
    if (c >= 60) return { clcr: c, color: 'green',  stage: 'Levemente reduzido' }
    if (c >= 30) return { clcr: c, color: 'yellow', stage: 'Moderadamente reduzido' }
    if (c >= 15) return { clcr: c, color: 'orange', stage: 'Gravemente reduzido' }
    return       { clcr: c, color: 'red',    stage: 'Insuficiência renal terminal' }
  }

  const result = calc()
  const reset = () => { setCreatinine(''); setAge(''); setWeight('') }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Creatinina sérica" unit="mg/dL" value={creatinine} onChange={setCreatinine} step={0.01} min={0.1} max={20} />
        <Field label="Idade" unit="anos" value={age} onChange={setAge} min={18} max={120} />
        <Field label="Peso" unit="kg" value={weight} onChange={setWeight} step={0.1} min={20} max={300} hint="Usar peso ideal em obesos" />
        <Select label="Sexo biológico" value={sex} onChange={setSex}
          options={[{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Feminino' }]} />
      </div>

      {result ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ResultBox
            label="Clearance de creatinina (Cockcroft-Gault)"
            value={result.clcr}
            unit="mL/min"
            interpretation={result.stage}
            color={result.color}
          />
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Ajuste de dose sugerido</p>
            {[
              { cond: result.clcr >= 50,   text: '✓ Maioria dos medicamentos: dose normal', ok: true },
              { cond: result.clcr < 50 && result.clcr >= 30, text: '⚠️ Metformina: dose máx. 1500 mg/dia. Monitorar', ok: false },
              { cond: result.clcr < 30,    text: '🚫 Metformina: contraindicada', ok: false },
              { cond: result.clcr < 50,    text: '⚠️ Sitagliptina: reduzir para 50 mg/dia', ok: false },
              { cond: result.clcr < 30,    text: '⚠️ Sitagliptina: reduzir para 25 mg/dia', ok: false },
              { cond: result.clcr < 50,    text: '⚠️ Gabapentina/Pregabalina: ajustar dose', ok: false },
              { cond: result.clcr < 45,    text: '🚫 Nitrofurantoína: contraindicada', ok: false },
              { cond: result.clcr < 60,    text: '⚠️ Digoxina: reduzir dose, monitorar nível', ok: false },
              { cond: result.clcr < 30,    text: '⚠️ IECA/BRA: iniciar com metade da dose', ok: false },
            ].filter(i => i.cond).map((item, i) => (
              <p key={i} className={`text-xs ${item.ok ? 'text-green-700' : 'text-orange-800'}`}>{item.text}</p>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
          Preencha os campos para calcular o ClCr
        </div>
      )}

      <div>
        <button onClick={() => setShowDetail(d => !d)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
          <Info className="h-3.5 w-3.5" />
          {showDetail ? 'Ocultar detalhes' : 'Sobre Cockcroft-Gault'}
          {showDetail ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {showDetail && (
          <InfoBox>
            <p><strong>Equação de Cockcroft-Gault (1976)</strong></p>
            <p>Fórmula: ClCr = [(140 - idade) × peso × (0,85 se feminino)] / (72 × creatinina)</p>
            <p>Ainda amplamente usada para ajuste de dose de medicamentos (maioria das bulas usa esta equação).</p>
            <p><strong>Atenção:</strong> Em obesos, use o peso ideal. Em amputados, ajuste o peso. Não aplicável em IRA.</p>
            <p>Peso ideal: Homem = 50 + 0,91 × (altura cm - 152,4) | Mulher = 45,5 + 0,91 × (altura cm - 152,4)</p>
          </InfoBox>
        )}
      </div>

      <button onClick={reset} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
        <RotateCcw className="h-3 w-3" /> Limpar
      </button>
    </div>
  )
}

// ── Escore de Charlson ────────────────────────────────────────────────────────

const CHARLSON_CONDITIONS = [
  { key: 'mi',            label: 'Infarto agudo do miocárdio (história)',     points: 1 },
  { key: 'chf',           label: 'Insuficiência cardíaca congestiva',          points: 1 },
  { key: 'pvd',           label: 'Doença vascular periférica',                 points: 1 },
  { key: 'cva',           label: 'AVC / TIA (história)',                       points: 1 },
  { key: 'dementia',      label: 'Demência',                                   points: 1 },
  { key: 'copd',          label: 'DPOC / Doença pulmonar crônica',             points: 1 },
  { key: 'ctd',           label: 'Doença reumatológica / tecido conjuntivo',   points: 1 },
  { key: 'pud',           label: 'Úlcera péptica',                             points: 1 },
  { key: 'mild_liver',    label: 'Doença hepática leve (sem hipertensão portal)', points: 1 },
  { key: 'dm_no_comp',    label: 'Diabetes mellitus sem complicações',          points: 1 },
  { key: 'dm_comp',       label: 'Diabetes com lesão de órgão-alvo',           points: 2 },
  { key: 'hemiplegia',    label: 'Hemiplegia / paraplegia',                    points: 2 },
  { key: 'ckd',           label: 'DRC moderada/grave (creatinina > 3)',        points: 2 },
  { key: 'tumor_solid',   label: 'Tumor sólido sem metástase',                 points: 2 },
  { key: 'leukemia',      label: 'Leucemia',                                   points: 2 },
  { key: 'lymphoma',      label: 'Linfoma',                                    points: 2 },
  { key: 'sev_liver',     label: 'Doença hepática moderada/grave (cirrose, HTP)', points: 3 },
  { key: 'tumor_meta',    label: 'Tumor sólido com metástase',                 points: 6 },
  { key: 'aids',          label: 'AIDS (não apenas HIV positivo)',             points: 6 },
]

function CharlsonCalc() {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [age, setAge]           = useState('')

  const toggle = (key: string) => {
    // Exclusividade DM com/sem complicação
    setSelected(prev => {
      const n = new Set(prev)
      if (key === 'dm_comp' && n.has('dm_no_comp')) n.delete('dm_no_comp')
      if (key === 'dm_no_comp' && n.has('dm_comp')) n.delete('dm_comp')
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  const a = parseInt(age) || 0
  const agePoints = a >= 80 ? 4 : a >= 70 ? 3 : a >= 60 ? 2 : a >= 50 ? 1 : 0
  const condPoints = CHARLSON_CONDITIONS.filter(c => selected.has(c.key)).reduce((s, c) => s + c.points, 0)
  const total = agePoints + condPoints

  const mortality10y = Math.round((1 - Math.pow(0.983, Math.exp(total * 0.9))) * 100)

  const riskLabel = total === 0 ? { label: 'Baixo risco', color: 'green' as const }
    : total <= 2   ? { label: 'Risco baixo-moderado', color: 'yellow' as const }
    : total <= 5   ? { label: 'Risco moderado-alto', color: 'orange' as const }
    :                { label: 'Alto risco', color: 'red' as const }

  const reset = () => { setSelected(new Set()); setAge('') }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Field label="Idade" unit="anos" value={age} onChange={setAge} min={18} max={120}
            hint="A idade pontua: 50-59=1, 60-69=2, 70-79=3, ≥80=4" />
          {a > 0 && <p className="text-xs text-blue-600 mt-1">Pontos pela idade: {agePoints}</p>}
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-500">
          <p className="font-semibold text-gray-700 mb-1">Como usar</p>
          <p>Marque as condições presentes. O escore prediz mortalidade em 10 anos e complexidade clínica.</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-700 mb-2">Comorbidades</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {CHARLSON_CONDITIONS.map(c => (
            <label key={c.key}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-all text-sm ${
                selected.has(c.key)
                  ? 'border-[#1e3a5f] bg-[#1e3a5f]/5 text-[#1e3a5f]'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}>
              <input type="checkbox" checked={selected.has(c.key)} onChange={() => toggle(c.key)}
                className="accent-[#1e3a5f] h-3.5 w-3.5 flex-shrink-0" />
              <span className="flex-1 leading-tight">{c.label}</span>
              <span className={`text-xs font-bold flex-shrink-0 ${selected.has(c.key) ? 'text-[#1e3a5f]' : 'text-gray-400'}`}>
                +{c.points}
              </span>
            </label>
          ))}
        </div>
      </div>

      {(total > 0 || a > 0) && (
        <div className="grid gap-3 sm:grid-cols-3">
          <ResultBox label="Escore de Charlson" value={total} unit="pts"
            interpretation={riskLabel.label} color={riskLabel.color} />
          <ResultBox label="Mortalidade estimada" value={`${mortality10y}`} unit="%"
            interpretation="em 10 anos" color={total >= 4 ? 'red' : total >= 2 ? 'orange' : 'green'}
            note="Estimativa baseada em coortes originais" />
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-1.5">
            <p className="text-xs font-semibold text-gray-700">Interpretação clínica</p>
            <p className="text-xs text-gray-600">
              {total === 0 ? 'Sem comorbidades significativas. Baixa complexidade farmacoterapêutica esperada.'
               : total <= 2 ? 'Comorbidades leves. Considerar interações medicamentosas e ajuste de doses.'
               : total <= 5 ? 'Alta carga de comorbidades. Risco elevado de PRMs, polifarmácia e interações.'
               : 'Comorbidades graves/múltiplas. Acompanhamento farmacêutico intensivo recomendado.'}
            </p>
            {total >= 3 && (
              <p className="text-xs text-orange-700 font-medium">
                ⚠️ Paciente de alta complexidade — priorizar reconciliação medicamentosa
              </p>
            )}
          </div>
        </div>
      )}

      <button onClick={reset} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
        <RotateCcw className="h-3 w-3" /> Limpar
      </button>
    </div>
  )
}

// ── Risco Cardiovascular (Framingham simplificado / ESC SCORE2) ───────────────

function CardiovascularRiskCalc() {
  const [age, setAge]           = useState('')
  const [sex, setSex]           = useState('male')
  const [sbp, setSbp]           = useState('')
  const [totalChol, setTotalChol] = useState('')
  const [hdl, setHdl]           = useState('')
  const [smoker, setSmoker]     = useState('no')
  const [diabetic, setDiabetic] = useState('no')
  const [treated, setTreated]   = useState('no')
  const [showDetail, setShowDetail] = useState(false)

  // Framingham Risk Score (simplified, 10-year CVD)
  const calc = () => {
    const a = parseInt(age)
    const s = parseInt(sbp)
    const tc = parseFloat(totalChol)
    const h = parseFloat(hdl)
    if (!a || !s || !tc || !h) return null

    // Pontuação simplificada por faixas (versão ATP III)
    let pts = 0

    // Idade
    if (sex === 'male') {
      if (a < 35) pts += -9
      else if (a < 40) pts += -4
      else if (a < 45) pts += 0
      else if (a < 50) pts += 3
      else if (a < 55) pts += 6
      else if (a < 60) pts += 8
      else if (a < 65) pts += 10
      else if (a < 70) pts += 11
      else pts += 12
    } else {
      if (a < 35) pts += -7
      else if (a < 40) pts += -3
      else if (a < 45) pts += 0
      else if (a < 50) pts += 3
      else if (a < 55) pts += 6
      else if (a < 60) pts += 8
      else if (a < 65) pts += 10
      else if (a < 70) pts += 12
      else pts += 14
    }

    // Colesterol total (mg/dL)
    if (tc < 160) pts += 0
    else if (tc < 200) pts += sex === 'male' ? 4 : 4
    else if (tc < 240) pts += sex === 'male' ? 7 : 8
    else if (tc < 280) pts += sex === 'male' ? 9 : 11
    else pts += sex === 'male' ? 11 : 13

    // HDL
    if (h >= 60) pts += -1
    else if (h >= 50) pts += 0
    else if (h >= 40) pts += 1
    else pts += 2

    // PAS
    const sGrp = treated === 'yes'
    if (s < 120) pts += 0
    else if (s < 130) pts += sGrp ? (sex === 'male' ? 1 : 3) : 0
    else if (s < 140) pts += sGrp ? (sex === 'male' ? 2 : 4) : (sex === 'male' ? 1 : 1)
    else if (s < 160) pts += sGrp ? (sex === 'male' ? 2 : 5) : (sex === 'male' ? 1 : 2)
    else pts += sGrp ? (sex === 'male' ? 3 : 6) : (sex === 'male' ? 2 : 3)

    // Tabagismo
    if (smoker === 'yes') pts += sex === 'male' ? 8 : 9

    // Diabetes
    if (diabetic === 'yes') pts += sex === 'male' ? 11 : 7

    // Converter pontos para risco (tabela ATP III simplificada)
    const riskTable: Record<string, number[]> = {
      male:   [1,1,1,1,1,2,2,3,4,5,6,8,10,12,16,20,25,30,35,40],
      female: [1,1,1,1,1,1,1,1,1,1,2,3, 4, 5, 7, 8,11,14,18,22],
    }
    const table = riskTable[sex]
    const idx = Math.max(0, Math.min(pts - 0, table.length - 1))
    const risk = table[Math.max(0, Math.min(idx, table.length - 1))]

    return { pts, risk: risk || 1 }
  }

  const result = calc()
  const riskColor = !result ? 'blue' as const
    : result.risk < 10 ? 'green' as const
    : result.risk < 20 ? 'yellow' as const
    : 'red' as const

  const riskLabel = !result ? ''
    : result.risk < 10 ? 'Baixo risco'
    : result.risk < 20 ? 'Risco intermediário'
    : 'Alto risco'

  const reset = () => { setAge(''); setSbp(''); setTotalChol(''); setHdl('') }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Idade" unit="anos" value={age} onChange={setAge} min={30} max={79} hint="30–79 anos" />
        <Select label="Sexo biológico" value={sex} onChange={setSex}
          options={[{ value: 'male', label: 'Masculino' }, { value: 'female', label: 'Feminino' }]} />
        <Field label="PAS" unit="mmHg" value={sbp} onChange={setSbp} min={90} max={200} />
        <Field label="Colesterol total" unit="mg/dL" value={totalChol} onChange={setTotalChol} min={100} max={400} />
        <Field label="HDL-colesterol" unit="mg/dL" value={hdl} onChange={setHdl} min={20} max={120} />
        <Select label="Tabagismo atual" value={smoker} onChange={setSmoker}
          options={[{ value: 'no', label: 'Não fumante' }, { value: 'yes', label: 'Fumante' }]} />
        <Select label="Diabetes mellitus" value={diabetic} onChange={setDiabetic}
          options={[{ value: 'no', label: 'Não' }, { value: 'yes', label: 'Sim' }]} />
        <Select label="Trata HAS?" value={treated} onChange={setTreated}
          options={[{ value: 'no', label: 'Não trata' }, { value: 'yes', label: 'Em tratamento' }]} />
      </div>

      {result ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ResultBox label="Risco cardiovascular" value={`${result.risk}`} unit="%"
            interpretation={`${riskLabel} — em 10 anos`} color={riskColor}
            note="Framingham Risk Score (Eventos coronarianos maiores)" />
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Implicações terapêuticas</p>
            {result.risk >= 20 && <p className="text-xs text-red-700">🚨 Alto risco — estatina indicada independente do LDL</p>}
            {result.risk >= 20 && <p className="text-xs text-red-700">🚨 AAS 75-100 mg/dia se sem contraindicação</p>}
            {result.risk >= 10 && result.risk < 20 && <p className="text-xs text-orange-700">⚠️ Risco intermediário — discutir estatina com prescritor</p>}
            {result.risk < 10 && <p className="text-xs text-green-700">✓ Baixo risco — foco em mudanças de estilo de vida</p>}
            <p className="text-xs text-gray-500 mt-2">
              Meta LDL: {result.risk >= 20 ? '< 70 mg/dL (alto risco)' : result.risk >= 10 ? '< 100 mg/dL (int.)' : '< 130 mg/dL (baixo)'}
            </p>
            <p className="text-xs text-gray-500">Meta PA: &lt;130/80 mmHg (ACC/AHA 2017)</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
          Preencha os campos para calcular o risco cardiovascular
        </div>
      )}

      <div>
        <button onClick={() => setShowDetail(d => !d)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
          <Info className="h-3.5 w-3.5" />
          {showDetail ? 'Ocultar' : 'Sobre o Escore de Framingham'}
          {showDetail ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {showDetail && (
          <InfoBox>
            <p><strong>Framingham Risk Score</strong> — Wilson et al. JAMA 1998 / ATP III 2001</p>
            <p>Estima risco de evento coronariano maior (IAM fatal/não fatal, angina) em 10 anos.</p>
            <p><strong>Limitações:</strong> Desenvolvido em população norte-americana. Para populações latino-americanas, pode superestimar o risco. Não inclui PCR, histórico familiar, TFG.</p>
            <p>Para risco mais preciso, considerar escore ASCVD 2013 (ACC/AHA) ou SCORE2 (ESC).</p>
          </InfoBox>
        )}
      </div>

      <button onClick={reset} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
        <RotateCcw className="h-3 w-3" /> Limpar
      </button>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

const TABS: { id: CalcTab; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'ckd-epi',   label: 'CKD-EPI',          icon: Activity,      description: 'TFG estimada (2021)' },
  { id: 'cockcroft', label: 'Cockcroft-Gault',   icon: Calculator,    description: 'Clearance de creatinina' },
  { id: 'charlson',  label: 'Charlson',          icon: ClipboardList, description: 'Escore de comorbidades' },
  { id: 'ascvd',     label: 'Risco Cardiovascular', icon: Heart,      description: 'Framingham 10 anos' },
]

export function ClinicalCalculators() {
  const [tab, setTab] = useState<CalcTab>('ckd-epi')

  const current = TABS.find(t => t.id === tab)!

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calculadoras Clínicas</h1>
        <p className="text-sm text-gray-500 mt-0.5">Ferramentas de suporte à decisão farmacêutica — resultados não substituem avaliação clínica</p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                active
                  ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-md'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}>
              <Icon className={`h-5 w-5 ${active ? 'text-white' : 'text-[#1e3a5f]'}`} />
              <div>
                <p className="text-xs font-semibold leading-tight">{t.label}</p>
                <p className={`text-[10px] leading-tight mt-0.5 ${active ? 'text-white/70' : 'text-gray-400'}`}>{t.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Calculadora ativa */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          {React.createElement(current.icon, { className: 'h-5 w-5 text-[#1e3a5f]' })}
          <div>
            <h2 className="font-semibold text-gray-900">{current.label}</h2>
            <p className="text-xs text-gray-500">{current.description}</p>
          </div>
        </div>

        {tab === 'ckd-epi'   && <CKDEPICalc />}
        {tab === 'cockcroft' && <CockcroftGaultCalc />}
        {tab === 'charlson'  && <CharlsonCalc />}
        {tab === 'ascvd'     && <CardiovascularRiskCalc />}
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <strong>Aviso:</strong> As calculadoras são ferramentas de apoio clínico e não substituem julgamento profissional.
        Resultados devem ser interpretados no contexto clínico completo do paciente.
        Equações baseadas em populações de referência que podem diferir da brasileira.
      </div>
    </div>
  )
}
