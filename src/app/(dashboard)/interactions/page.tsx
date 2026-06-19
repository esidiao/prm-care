'use client'
import { useState } from 'react'
import { Plus, X, Search, AlertTriangle, Copy, Loader2, Printer, Save, Check, Sparkles } from 'lucide-react'

type Explanation = { pair: string; evidenceLevel: string; warningSigns: string; alternatives: string; monitoring: string; patientMessage: string }

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
  const [savedId, setSavedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dec, setDec] = useState({ note: '', intervened: false, contactedMD: false, outcome: '' })
  const [decSaved, setDecSaved] = useState(false)
  const [explaining, setExplaining] = useState(false)
  const [expl, setExpl] = useState<Record<string, Explanation>>({})
  const [sources, setSources] = useState<string[]>([])

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
      setResp(data); setSavedId(null); setDecSaved(false); setExpl({}); setSources([])
      setDec({ note: '', intervened: false, contactedMD: false, outcome: '' })
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }

  const saveConsult = async () => {
    if (!resp) return
    setSaving(true)
    try {
      const r = await fetch('/api/interactions/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugs, globalRisk: resp.globalRisk, globalLabel: resp.globalLabel, interactions: resp.interactions }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Falha ao salvar')
      setSavedId(data.id)
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  const saveDecision = async () => {
    if (!savedId) return
    const r = await fetch(`/api/interactions/${savedId}/decision`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dec),
    })
    if (r.ok) setDecSaved(true)
  }

  const explain = async () => {
    if (!resp || resp.interactions.length === 0) return
    setExplaining(true)
    try {
      const r = await fetch('/api/interactions/explain', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interactions: resp.interactions }),
      })
      const data = await r.json()
      const map: Record<string, Explanation> = {}
      for (const e of (data.explanations || []) as Explanation[]) map[e.pair.toLowerCase()] = e
      setExpl(map); setSources(Array.from(new Set((data.sourcesUsed || []) as string[])))
    } catch { /* mantém base determinística */ }
    finally { setExplaining(false) }
  }

  const printConsult = () => {
    if (!resp) return
    const cor: Record<string, string> = { contraindicated: '#dc2626', major: '#ea580c', moderate: '#d97706', minor: '#16a34a' }
    const rows = resp.interactions.map(i => `
      <div style="border:1px solid #e2e8f0;border-left:5px solid ${cor[i.severity]};border-radius:8px;padding:10px 14px;margin:8px 0">
        <b style="color:${cor[i.severity]}">[${i.severityLabel}]</b> <b>${i.drugs[0]} + ${i.drugs[1]}</b>
        <div style="font-size:13px;margin-top:4px"><b>Mecanismo:</b> ${i.mechanism}</div>
        <div style="font-size:13px"><b>Efeito clínico:</b> ${i.clinicalEffect}</div>
        <div style="font-size:13px"><b>Conduta:</b> ${i.management}</div>
      </div>`).join('')
    const w = window.open('', '_blank'); if (!w) return
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Consulta de Interações — PRM Care</title>
      <body style="font-family:Segoe UI,Arial;max-width:760px;margin:24px auto;color:#1a202c">
      <h2 style="color:#1e3a5f">PRM Care — Consulta de Interações Medicamentosas</h2>
      <p style="color:#475569">Medicamentos: ${drugs.join(', ')}</p>
      <p><b>Risco global:</b> ${resp.globalLabel} · ${resp.count} interação(ões)</p>
      ${resp.notFound ? '<p>Nenhuma interação relevante na base disponível.</p>' : rows}
      <p style="font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:8px;margin-top:16px">${resp.advisory}</p>
      </body>`)
    w.document.close(); w.focus(); setTimeout(() => w.print(), 250)
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
              <div className="flex items-center gap-2">
                <button onClick={printConsult} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                  <Printer className="h-4 w-4" /> Imprimir / PDF
                </button>
                <button onClick={copySummary} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                  <Copy className="h-4 w-4" /> Copiar
                </button>
                <button onClick={explain} disabled={explaining || resp.notFound} className="flex items-center gap-1 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-100 disabled:opacity-50">
                  {explaining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Explicar com IA
                </button>
                <button onClick={saveConsult} disabled={saving || !!savedId} className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                  {savedId ? <Check className="h-4 w-4" /> : saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {savedId ? 'Salva' : 'Salvar consulta'}
                </button>
              </div>
            </div>
          )}

          {/* cards por interação */}
          <div className="mt-4 space-y-3">
            {resp.interactions.map((it, i) => {
              const s = SEV[it.severity]
              const e = expl[`${it.drugs[0]} + ${it.drugs[1]}`.toLowerCase()]
              return (
                <div key={i} className={`relative overflow-hidden rounded-xl border bg-white p-4 ${s.ring}`}>
                  <div className={`absolute left-0 top-0 h-full w-1.5 ${s.bar}`} />
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.chip}`}>{it.severityLabel}</span>
                    <span className="font-semibold text-slate-800">{it.drugs[0]} + {it.drugs[1]}</span>
                    {e?.evidenceLevel && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">Evidência: {e.evidenceLevel}</span>}
                  </div>
                  <dl className="mt-2 space-y-1.5 text-sm">
                    <div><dt className="inline font-semibold text-slate-600">Mecanismo: </dt><dd className="inline text-slate-700">{it.mechanism}</dd></div>
                    <div><dt className="inline font-semibold text-slate-600">Efeito clínico: </dt><dd className="inline text-slate-700">{it.clinicalEffect}</dd></div>
                    <div><dt className="inline font-semibold text-slate-600">Conduta farmacêutica: </dt><dd className="inline text-slate-700">{it.management}</dd></div>
                    {e?.warningSigns && <div><dt className="inline font-semibold text-slate-600">Sinais de alerta: </dt><dd className="inline text-slate-700">{e.warningSigns}</dd></div>}
                    {e?.monitoring && <div><dt className="inline font-semibold text-slate-600">Monitorar: </dt><dd className="inline text-slate-700">{e.monitoring}</dd></div>}
                    {e?.alternatives && e.alternatives !== '—' && <div><dt className="inline font-semibold text-slate-600">Alternativas: </dt><dd className="inline text-slate-700">{e.alternatives}</dd></div>}
                  </dl>
                  {e?.patientMessage && (
                    <div className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900"><b>Orientação ao paciente:</b> {e.patientMessage}</div>
                  )}
                </div>
              )
            })}
          </div>

          {sources.length > 0 && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <span className="font-semibold">Fontes consultadas:</span> {sources.join(' · ')}
            </div>
          )}

          <p className="mt-5 rounded-lg bg-teal-50 px-4 py-3 text-xs leading-relaxed text-teal-900">{resp.advisory}</p>

          {/* Decisão clínica — disponível após salvar a consulta */}
          {savedId && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-800">Decisão clínica do farmacêutico</h3>
              <textarea
                value={dec.note} onChange={e => setDec({ ...dec, note: e.target.value })}
                placeholder="Conduta adotada / observações clínicas…"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500" rows={3}
              />
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-700">
                <label className="flex items-center gap-2"><input type="checkbox" checked={dec.intervened} onChange={e => setDec({ ...dec, intervened: e.target.checked })} /> Houve intervenção farmacêutica</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={dec.contactedMD} onChange={e => setDec({ ...dec, contactedMD: e.target.checked })} /> Contato com prescritor</label>
              </div>
              <input
                value={dec.outcome} onChange={e => setDec({ ...dec, outcome: e.target.value })}
                placeholder="Desfecho da intervenção (opcional)"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
              />
              <div className="mt-3 flex items-center gap-3">
                <button onClick={saveDecision} className="flex items-center gap-1 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Registrar decisão</button>
                {decSaved && <span className="flex items-center gap-1 text-sm text-green-700"><Check className="h-4 w-4" /> Registrada</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
