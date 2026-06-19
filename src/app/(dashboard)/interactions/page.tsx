'use client'
import { useState } from 'react'
import { Plus, X, Search, AlertTriangle, Copy, Loader2 } from 'lucide-react'

type Interaction = {
  drugs: [string, string]
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor'
  severityLabel: string
  mechanism: string
  clinicalEffect: string
  management: string
}
type CheckResp = {
  count: number
  notFound: boolean
  globalRisk: Interaction['severity'] | null
  globalLabel: string
  interactions: Interaction[]
  advisory: string
}

const SEV = {
  contraindicated: { bar: 'bg-red-600', chip: 'bg-red-100 text-red-800', ring: 'border-red-200' },
  major: { bar: 'bg-orange-500', chip: 'bg-orange-100 text-orange-800', ring: 'border-orange-200' },
  moderate: { bar: 'bg-amber-500', chip: 'bg-amber-100 text-amber-800', ring: 'border-amber-200' },
  minor: { bar: 'bg-green-600', chip: 'bg-green-100 text-green-800', ring: 'border-green-200' },
} as const

export default function InteractionsPage() {
  const [input, setInput] = useState('')
  const [drugs, setDrugs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [resp, setResp] = useState<CheckResp | null>(null)
  const [error, setError] = useState('')

  const addDrug = () => {
    const v = input.trim()
    if (v && !drugs.some(d => d.toLowerCase() === v.toLowerCase())) setDrugs([...drugs, v])
    setInput('')
  }
  const removeDrug = (i: number) => setDrugs(drugs.filter((_, x) => x !== i))

  const check = async () => {
    setError(''); setResp(null); setLoading(true)
    try {
      const r = await fetch('/api/interactions/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugs }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Falha na consulta')
      setResp(data)
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }

  const copySummary = () => {
    if (!resp) return
    const txt = [
      `Consulta de interações — risco global: ${resp.globalLabel}`,
      ...resp.interactions.map(i => `• [${i.severityLabel}] ${i.drugs[0]} + ${i.drugs[1]}: ${i.clinicalEffect}. Conduta: ${i.management}`),
      '', resp.advisory,
    ].join('\n')
    navigator.clipboard?.writeText(txt)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-800">Interações Medicamentosas</h1>
      <p className="mt-1 text-sm text-slate-500">Cruze dois ou mais medicamentos e veja as interações da base clínica do PRM Care.</p>

      {/* entrada de medicamentos */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex gap-2">
          <input
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDrug() } }}
            placeholder="Princípio ativo (ex.: varfarina) e Enter"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
          <button onClick={addDrug} className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>
        {drugs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {drugs.map((d, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-800">
                {d}<button onClick={() => removeDrug(i)} className="text-teal-500 hover:text-teal-700"><X className="h-3.5 w-3.5" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button onClick={check} disabled={drugs.length < 2 || loading}
            className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Verificar interações
          </button>
          {drugs.length < 2 && <span className="text-xs text-slate-400">Adicione ao menos 2 medicamentos.</span>}
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {resp && (
        <div className="mt-6">
          {/* síntese de risco global */}
          {resp.notFound ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              Nenhuma interação relevante encontrada na base disponível para os medicamentos informados.
              <span className="mt-1 block text-slate-500">Ausência de evidência não significa ausência de risco — mantenha o julgamento clínico.</span>
            </div>
          ) : (
            <div className={`flex items-center justify-between rounded-xl border bg-white px-4 py-3 ${resp.globalRisk ? SEV[resp.globalRisk].ring : ''}`}>
              <div className="flex items-center gap-3">
                <AlertTriangle className={`h-5 w-5 ${resp.globalRisk === 'contraindicated' || resp.globalRisk === 'major' ? 'text-red-600' : 'text-amber-500'}`} />
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">Risco global da combinação</div>
                  <div className="text-lg font-bold text-slate-800">{resp.globalLabel} · {resp.count} interação(ões)</div>
                </div>
              </div>
              <button onClick={copySummary} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                <Copy className="h-4 w-4" /> Copiar resumo
              </button>
            </div>
          )}

          {/* cards por interação */}
          <div className="mt-4 space-y-3">
            {resp.interactions.map((it, i) => {
              const s = SEV[it.severity]
              return (
                <div key={i} className={`relative overflow-hidden rounded-xl border bg-white p-4 ${s.ring}`}>
                  <div className={`absolute left-0 top-0 h-full w-1.5 ${s.bar}`} />
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.chip}`}>{it.severityLabel}</span>
                    <span className="font-semibold text-slate-800">{it.drugs[0]} + {it.drugs[1]}</span>
                  </div>
                  <dl className="mt-2 space-y-1.5 text-sm">
                    <div><dt className="inline font-semibold text-slate-600">Mecanismo: </dt><dd className="inline text-slate-700">{it.mechanism}</dd></div>
                    <div><dt className="inline font-semibold text-slate-600">Efeito clínico: </dt><dd className="inline text-slate-700">{it.clinicalEffect}</dd></div>
                    <div><dt className="inline font-semibold text-slate-600">Conduta farmacêutica: </dt><dd className="inline text-slate-700">{it.management}</dd></div>
                  </dl>
                </div>
              )
            })}
          </div>

          <p className="mt-5 rounded-lg bg-teal-50 px-4 py-3 text-xs leading-relaxed text-teal-900">{resp.advisory}</p>
        </div>
      )}
    </div>
  )
}
