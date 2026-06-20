'use client'
import { useState } from 'react'
import { Plus, X, Search, AlertTriangle, Copy, Loader2, Printer, Save, Check, Sparkles } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { PgxAlerts } from '@/components/pgx/PgxAlerts'
import { canonicalizeDrug } from '@/lib/drug-aliases'

type Explanation = { pair: string; evidenceLevel: string; warningSigns: string; alternatives: string; monitoring: string; patientMessage: string }

type Interaction = {
  drugs: [string, string]
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor'
  severityLabel: string
  mechanism: string
  clinicalEffect: string
  management: string
  contextFlags?: string[]
  source?: string
}
type CheckResp = {
  count: number
  notFound: boolean
  globalRisk: Interaction['severity'] | null
  globalLabel: string
  interactions: Interaction[]
  foodSupplements?: FoodSupp[]
  advisory: string
}
type FoodSupp = {
  agent: string; emoji: string; type: 'alimento' | 'álcool' | 'suplemento'
  severity: 'major' | 'moderate'; severityLabel: string; drugs: string[]
  mechanism: string; clinicalEffect: string; management: string; patientGuidance: string
}

const SEV = {
  contraindicated: { bar: 'bg-red-600', chip: 'bg-red-100 text-red-800', ring: 'border-red-200' },
  major: { bar: 'bg-orange-500', chip: 'bg-orange-100 text-orange-800', ring: 'border-orange-200' },
  moderate: { bar: 'bg-amber-500', chip: 'bg-amber-100 text-amber-800', ring: 'border-amber-200' },
  minor: { bar: 'bg-green-600', chip: 'bg-green-100 text-green-800', ring: 'border-green-200' },
} as const

export default function InteractionsPage() {
  const { data: session } = useSession()
  const pharmacist = session?.user?.name || 'Farmacêutico(a)'
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
  const [ctx, setCtx] = useState({ age: '', tfg: '', pregnant: false })

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
        body: JSON.stringify({ drugs, context: { age: ctx.age ? Number(ctx.age) : null, tfg: ctx.tfg ? Number(ctx.tfg) : null, pregnant: ctx.pregnant } }),
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
    const today = new Date().toLocaleDateString('pt-BR')
    const e = expl
    const rows = resp.interactions.map(i => {
      const ex = e[`${i.drugs[0]} + ${i.drugs[1]}`.toLowerCase()]
      return `
      <div style="border:1px solid #e2e8f0;border-left:5px solid ${cor[i.severity]};border-radius:8px;padding:10px 14px;margin:8px 0">
        <b style="color:${cor[i.severity]}">[${i.severityLabel}]</b> <b>${i.drugs[0]} + ${i.drugs[1]}</b>${ex?.evidenceLevel ? ` <span style="font-size:11px;color:#64748b">(Evidência: ${ex.evidenceLevel})</span>` : ''}
        <div style="font-size:13px;margin-top:4px"><b>Mecanismo:</b> ${i.mechanism}</div>
        <div style="font-size:13px"><b>Efeito clínico:</b> ${i.clinicalEffect}</div>
        <div style="font-size:13px"><b>Conduta:</b> ${i.management}</div>
        ${ex?.monitoring ? `<div style="font-size:13px"><b>Monitorar:</b> ${ex.monitoring}</div>` : ''}
        ${(i.contextFlags || []).map(f => `<div style="font-size:12px;color:#92400e">⚠ Ajuste ao paciente: ${f}</div>`).join('')}
      </div>`
    }).join('')
    const fs = (resp.foodSupplements || []).map(f => `
      <div style="border:1px solid #e2e8f0;border-left:5px solid ${cor[f.severity]};border-radius:8px;padding:8px 14px;margin:6px 0">
        <b>${f.emoji} ${f.agent}</b> <span style="font-size:11px;color:#475569">[${f.type} · ${f.severityLabel}]</span>
        <div style="font-size:12px">Afeta: ${f.drugs.join(', ')} — ${f.clinicalEffect}. <b>Conduta:</b> ${f.management}</div>
      </div>`).join('')
    const ctxLine = [ctx.age && `${ctx.age} anos`, ctx.tfg && `TFG ${ctx.tfg} mL/min`, ctx.pregnant && 'gestante'].filter(Boolean).join(' · ')
    const w = window.open('', '_blank'); if (!w) return
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Consulta de Interações — PRM Care</title>
      <body style="font-family:Segoe UI,Arial;max-width:760px;margin:24px auto;color:#1a202c;line-height:1.5">
      <div style="border-bottom:3px solid #1e3a5f;padding-bottom:8px;margin-bottom:14px">
        <h2 style="color:#1e3a5f;margin:0">PRM Care — Consulta de Interações Medicamentosas</h2>
        <div style="color:#475569;font-size:13px">Método Dáder · ${today}</div>
      </div>
      <p style="margin:4px 0"><b>Medicamentos:</b> ${drugs.join(', ')}${ctxLine ? ` &nbsp;·&nbsp; <b>Contexto:</b> ${ctxLine}` : ''}</p>
      <p style="margin:4px 0"><b>Farmacêutico(a):</b> ${pharmacist}</p>
      <p style="margin:8px 0"><b>Risco global:</b> ${resp.globalLabel}${resp.count ? ` · ${resp.count} interação(ões)` : ''}</p>
      ${resp.interactions.length ? `<h3 style="color:#1e3a5f;font-size:15px;margin:14px 0 4px">Interações medicamentosas</h3>${rows}` : ''}
      ${fs ? `<h3 style="color:#1e3a5f;font-size:15px;margin:14px 0 4px">Alimentos, álcool e suplementos</h3>${fs}` : ''}
      ${resp.notFound ? '<p>Nenhuma interação relevante (fármaco, alimento ou suplemento) na base disponível.</p>' : ''}
      <p style="margin-top:22px">_______________________________________<br><b>${pharmacist}</b> — Farmacêutico(a) responsável (CRF)</p>
      <p style="font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:8px;margin-top:10px">${resp.advisory}</p>
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Interações Medicamentosas</h1>
        <a href="/interactions/history" className="text-sm font-medium text-teal-700 hover:underline">Histórico →</a>
      </div>
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
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-xs font-semibold text-slate-500">Contexto (opcional):</span>
          <label className="flex items-center gap-1 text-slate-600">Idade <input type="number" value={ctx.age} onChange={e => setCtx({ ...ctx, age: e.target.value })} className="w-16 rounded border border-slate-300 px-2 py-1" /></label>
          <label className="flex items-center gap-1 text-slate-600">TFG <input type="number" value={ctx.tfg} onChange={e => setCtx({ ...ctx, tfg: e.target.value })} className="w-16 rounded border border-slate-300 px-2 py-1" /> mL/min</label>
          <label className="flex items-center gap-1 text-slate-600"><input type="checkbox" checked={ctx.pregnant} onChange={e => setCtx({ ...ctx, pregnant: e.target.checked })} /> Gestante</label>
        </div>
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
          {resp.notFound && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              Nenhuma interação relevante (fármaco, alimento ou suplemento) encontrada na base disponível para os itens informados.
              <span className="mt-1 block text-slate-500">Ausência de evidência não significa ausência de risco — mantenha o julgamento clínico.</span>
            </div>
          )}
          {resp.interactions.length > 0 && (
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
                    {it.source && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] text-violet-800">DDInter</span>}
                  </div>
                  <dl className="mt-2 space-y-1.5 text-sm">
                    <div><dt className="inline font-semibold text-slate-600">Mecanismo: </dt><dd className="inline text-slate-700">{it.mechanism}</dd></div>
                    <div><dt className="inline font-semibold text-slate-600">Efeito clínico: </dt><dd className="inline text-slate-700">{it.clinicalEffect}</dd></div>
                    <div><dt className="inline font-semibold text-slate-600">Conduta farmacêutica: </dt><dd className="inline text-slate-700">{it.management}</dd></div>
                    {e?.warningSigns && <div><dt className="inline font-semibold text-slate-600">Sinais de alerta: </dt><dd className="inline text-slate-700">{e.warningSigns}</dd></div>}
                    {e?.monitoring && <div><dt className="inline font-semibold text-slate-600">Monitorar: </dt><dd className="inline text-slate-700">{e.monitoring}</dd></div>}
                    {e?.alternatives && e.alternatives !== '—' && <div><dt className="inline font-semibold text-slate-600">Alternativas: </dt><dd className="inline text-slate-700">{e.alternatives}</dd></div>}
                  </dl>
                  {it.contextFlags && it.contextFlags.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {it.contextFlags.map((f, k) => (
                        <div key={k} className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-900">⚠ <b>Ajuste ao paciente:</b> {f}</div>
                      ))}
                    </div>
                  )}
                  {e?.patientMessage && (
                    <div className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900"><b>Orientação ao paciente:</b> {e.patientMessage}</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Alimentos, álcool e suplementos */}
          {resp.foodSupplements && resp.foodSupplements.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-sm font-bold text-slate-700">Alimentos, álcool e suplementos ({resp.foodSupplements.length})</h3>
              <div className="space-y-3">
                {resp.foodSupplements.map((f, i) => {
                  const c = SEV[f.severity]
                  const typeChip = f.type === 'suplemento' ? 'bg-emerald-100 text-emerald-800' : f.type === 'álcool' ? 'bg-rose-100 text-rose-800' : 'bg-sky-100 text-sky-800'
                  return (
                    <div key={i} className={`relative overflow-hidden rounded-xl border bg-white p-4 ${c.ring}`}>
                      <div className={`absolute left-0 top-0 h-full w-1.5 ${c.bar}`} />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg">{f.emoji}</span>
                        <span className="font-semibold text-slate-800">{f.agent}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeChip}`}>{f.type}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${c.chip}`}>{f.severityLabel}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Afeta: {f.drugs.join(', ')}</p>
                      <dl className="mt-2 space-y-1.5 text-sm">
                        <div><dt className="inline font-semibold text-slate-600">Mecanismo: </dt><dd className="inline text-slate-700">{f.mechanism}</dd></div>
                        <div><dt className="inline font-semibold text-slate-600">Efeito: </dt><dd className="inline text-slate-700">{f.clinicalEffect}</dd></div>
                        <div><dt className="inline font-semibold text-slate-600">Conduta: </dt><dd className="inline text-slate-700">{f.management}</dd></div>
                      </dl>
                      <div className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900"><b>Orientação ao paciente:</b> {f.patientGuidance}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Farmacogenômica (CPIC) dos fármacos consultados — unifica a checagem */}
          <div className="mt-5">
            <PgxAlerts drugs={drugs.map(canonicalizeDrug)} />
          </div>

          {sources.length > 0 && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <span className="font-semibold">Fontes consultadas:</span> {sources.join(' · ')}
            </div>
          )}

          <p className="mt-5 rounded-lg bg-teal-50 px-4 py-3 text-xs leading-relaxed text-teal-900">{resp.advisory}</p>

          {resp.interactions.some(i => i.source) && (
            <p className="mt-2 text-[11px] text-slate-400">Parte das interações provém da base <b>DDInter 2.0</b> (ddinter.scbdd.com), licença CC BY-NC-SA 4.0 — uso não-comercial/assistencial, com atribuição.</p>
          )}

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
