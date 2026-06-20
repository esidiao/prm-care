'use client'
import { useState, useRef } from 'react'
import { toPng } from 'html-to-image'
import { FileText, Printer, Copy, MessageCircle, Check, ShieldAlert, Loader2, Image as ImageIcon, AlertTriangle, Search } from 'lucide-react'

type Med = { name: string; dosage: string | null; frequency: string | null; isSelfMedication?: boolean; adherence?: string | null }
type Props = {
  patientId: string
  patientName: string
  patientAge: number | null
  pharmacist: string
  allergies: string[]
  meds: Med[]
}
type DetInt = {
  drugs: [string, string]; severity: string; severityLabel: string; severityRank: number
  mechanism: string; clinicalEffect: string; management: string
  monitoring?: string; evidenceLevel?: string; references?: string[]; source?: string; contextFlags?: string[]
}
type DetFood = { agent: string; emoji: string; type: string; severityLabel: string; drugs: string[]; clinicalEffect: string; management: string }
const SEV_COLOR: Record<string, string> = { contraindicated: '#dc2626', major: '#ea580c', moderate: '#d97706', minor: '#16a34a' }
const DISCLAIMER = 'Este documento é um instrumento de cuidado farmacêutico e não substitui a avaliação médica.'

export function ReconciliationReportPanel(p: Props) {
  const [open, setOpen] = useState(false)
  const [variant, setVariant] = useState<'TECNICA' | 'SIMPLIFICADA'>('TECNICA')
  const [notes, setNotes] = useState({ riscos: '', intervencoes: '', orientacoes: '', recomendacoes: '', plano: '' })
  const [recId, setRecId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  // WhatsApp
  const [phone, setPhone] = useState('')
  const [anon, setAnon] = useState(false)
  const [consent, setConsent] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  // Detecção automática de riscos (mesmo motor do módulo de interações)
  const [detected, setDetected] = useState<DetInt[]>([])
  const [detFood, setDetFood] = useState<DetFood[]>([])
  const [detRisk, setDetRisk] = useState<string>('')
  const [detecting, setDetecting] = useState(false)
  const [detDone, setDetDone] = useState(false)

  const detectRisks = async () => {
    setDetecting(true); setMsg('')
    try {
      // Usa o princípio ativo limpo (remove a marca entre parênteses) p/ casar a base externa
      const drugs = p.meds.map(m => m.name.replace(/\s*\([^)]*\)\s*/g, ' ').trim()).filter(Boolean)
      if (drugs.length < 2) { setMsg('São necessários ao menos 2 medicamentos para detectar interações.'); return }
      const r = await fetch('/api/interactions/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugs, context: { age: p.patientAge } }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Falha na verificação')
      setDetected((data.interactions || []) as DetInt[])
      setDetFood((data.foodSupplements || []) as DetFood[])
      setDetRisk(data.globalLabel || '')
      setDetDone(true)
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Erro na detecção') }
    finally { setDetecting(false) }
  }

  // Pré-preenche as notas clínicas a partir dos riscos detectados.
  const draftFromDetected = () => {
    const join = (a: string, b: string) => [a, b].filter(Boolean).join('\n')
    const riscos = detected.map(i => `• [${i.severityLabel}] ${i.drugs[0]} + ${i.drugs[1]}: ${i.clinicalEffect}`).join('\n')
    const fsRiscos = detFood.map(f => `• [${f.severityLabel}] ${f.agent} × ${f.drugs.join(', ')}: ${f.clinicalEffect}`).join('\n')
    const interv = detected.filter(i => i.severityRank >= 2).map(i => `• ${i.drugs[0]} + ${i.drugs[1]}: ${i.management}`).join('\n')
    const monit = detected.filter(i => i.monitoring).map(i => `• ${i.drugs[0]} + ${i.drugs[1]}: ${i.monitoring}`).join('\n')
    setNotes(n => ({
      ...n,
      riscos: join(n.riscos, [riscos, fsRiscos].filter(Boolean).join('\n')),
      intervencoes: join(n.intervencoes, interv),
      plano: join(n.plano, monit ? `Monitorização:\n${monit}` : ''),
    }))
  }

  const genPng = async () => {
    if (!cardRef.current) return
    try {
      const url = await toPng(cardRef.current, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true })
      const a = document.createElement('a'); a.href = url; a.download = 'conciliacao-prm-care.png'; a.click()
    } catch { setMsg('Não foi possível gerar a imagem.') }
  }

  const today = new Date().toLocaleDateString('pt-BR')
  const displayName = (a: boolean) => (a ? (p.patientName || '')
    .split(/\s+/).filter(Boolean).map(w => w[0]?.toUpperCase()).join('.') + '.' : p.patientName)

  const persist = async () => {
    if (recId) return recId
    const r = await fetch('/api/reconciliation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: p.patientId, snapshot: { meds: p.meds, allergies: p.allergies }, ...notes }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error || 'Falha ao salvar')
    setRecId(data.id); return data.id as string
  }

  const reportHtml = (v: 'TECNICA' | 'SIMPLIFICADA', anonymize = false) => {
    const tech = v === 'TECNICA'
    const medRows = p.meds.map(m => `<li>${m.name}${m.dosage ? ' — ' + m.dosage : ''}${m.frequency ? ' · ' + m.frequency : ''}${m.isSelfMedication ? ' <i>(automedicação)</i>' : ''}</li>`).join('')
    const block = (t: string, c: string) => c ? `<h3>${t}</h3><p>${c.replace(/\n/g, '<br>')}</p>` : ''
    return `<!doctype html><meta charset="utf-8"><title>Conciliação — PRM Care</title>
    <body style="font-family:Segoe UI,Arial;max-width:760px;margin:24px auto;color:#1a202c;line-height:1.5">
      <div style="border-bottom:3px solid #1e3a5f;padding-bottom:8px;margin-bottom:14px">
        <h2 style="color:#1e3a5f;margin:0">PRM Care — Relatório de Conciliação Medicamentosa</h2>
        <div style="color:#475569;font-size:13px">${tech ? 'Versão técnica' : 'Versão para o paciente'} · Método Dáder</div>
      </div>
      <p><b>Paciente:</b> ${displayName(anonymize)}${p.patientAge != null ? ` · ${p.patientAge} anos` : ''}<br>
         <b>Data:</b> ${today} &nbsp; <b>Farmacêutico(a):</b> ${p.pharmacist}</p>
      <h3>Medicamentos em uso</h3><ul>${medRows || '<li>—</li>'}</ul>
      ${p.allergies.length ? `<h3>Alergias</h3><p>${p.allergies.join(', ')}</p>` : ''}
      ${tech && detected.length ? `<h3>Interações detectadas automaticamente</h3><ul>${detected.map(i =>
        `<li><b style="color:${SEV_COLOR[i.severity] || '#475569'}">[${i.severityLabel}]</b> ${i.drugs[0]} + ${i.drugs[1]} — ${i.clinicalEffect}. <i>Conduta:</i> ${i.management}${i.monitoring ? ` <i>Monitorar:</i> ${i.monitoring}` : ''}${i.references && i.references.length ? ` <i>Fonte:</i> ${i.references.join(', ')}` : ''}</li>`).join('')}</ul>` : ''}
      ${tech && detFood.length ? `<h3>Alimentos/álcool/suplementos</h3><ul>${detFood.map(f =>
        `<li><b>[${f.severityLabel}]</b> ${f.agent} × ${f.drugs.join(', ')} — ${f.clinicalEffect}. <i>Conduta:</i> ${f.management}</li>`).join('')}</ul>` : ''}
      ${block('Riscos identificados', notes.riscos)}
      ${block('Intervenções farmacêuticas', notes.intervencoes)}
      ${block('Orientações ao paciente', notes.orientacoes)}
      ${tech ? block('Recomendações ao prescritor', notes.recomendacoes) : ''}
      ${block('Plano de acompanhamento', notes.plano)}
      <p style="margin-top:24px">_______________________________________<br><b>${p.pharmacist}</b> — Farmacêutico(a) responsável (CRF)</p>
      <p style="font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:8px;margin-top:14px">${DISCLAIMER}</p>
    </body>`
  }

  const printReport = () => {
    const w = window.open('', '_blank'); if (!w) return
    w.document.write(reportHtml(variant)); w.document.close(); w.focus(); setTimeout(() => w.print(), 250)
  }

  const whatsappText = () => {
    const meds = p.meds.map(m => `• ${m.name}${m.dosage ? ' ' + m.dosage : ''}${m.frequency ? ' (' + m.frequency + ')' : ''}`).join('\n')
    return [
      `Olá, ${displayName(anon)}. Segue o resumo do seu acompanhamento farmacêutico (${today}):`,
      ``, `Seus medicamentos:`, meds,
      notes.orientacoes ? `\nOrientações:\n${notes.orientacoes}` : '',
      notes.plano ? `\nAcompanhamento:\n${notes.plano}` : '',
      ``, `${DISCLAIMER}`, `— ${p.pharmacist}`,
    ].filter(Boolean).join('\n')
  }

  const sendWhatsApp = async () => {
    setMsg('')
    if (!consent) { setMsg('Marque o consentimento do paciente antes de enviar.'); return }
    setBusy(true)
    try {
      const id = await persist()
      const r = await fetch(`/api/reconciliation/${id}/share`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'WHATSAPP', variant: 'SIMPLIFICADA', anonymized: anon, consent: true }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Falha') }
      const digits = phone.replace(/\D/g, '')
      const url = `https://wa.me/${digits ? '55' + digits.replace(/^55/, '') : ''}?text=${encodeURIComponent(whatsappText())}`
      window.open(url, '_blank')
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Erro') } finally { setBusy(false) }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 print:hidden">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><FileText className="h-5 w-5 text-[#2c7a7b]" /> Relatório de conciliação</h2>
        <button onClick={() => setOpen(!open)} className="rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-sm font-medium text-white">{open ? 'Fechar' : 'Gerar relatório'}</button>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          {/* variante */}
          <div className="flex gap-2">
            {(['TECNICA', 'SIMPLIFICADA'] as const).map(v => (
              <button key={v} onClick={() => setVariant(v)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${variant === v ? 'bg-[#2c7a7b] text-white' : 'bg-gray-100 text-gray-600'}`}>
                {v === 'TECNICA' ? 'Versão técnica' : 'Versão paciente'}
              </button>
            ))}
          </div>

          {/* detecção automática de riscos */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-amber-900"><AlertTriangle className="h-4 w-4" /> Detecção automática de riscos</div>
              <button onClick={detectRisks} disabled={detecting} className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Detectar nos medicamentos
              </button>
            </div>
            {detDone && (
              <div className="mt-3">
                {detected.length === 0 && detFood.length === 0 ? (
                  <p className="text-sm text-emerald-700">Nenhuma interação relevante detectada na base disponível.</p>
                ) : (
                  <>
                    {detRisk && <p className="mb-2 text-sm text-amber-900">Risco global: <b>{detRisk}</b> · {detected.length} interação(ões){detFood.length ? ` · ${detFood.length} alimento/suplemento` : ''}</p>}
                    <div className="space-y-1.5">
                      {detected.slice(0, 12).map((i, k) => (
                        <div key={k} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs">
                          <span className="font-semibold" style={{ color: SEV_COLOR[i.severity] }}>[{i.severityLabel}]</span>{' '}
                          <b>{i.drugs[0]} + {i.drugs[1]}</b>
                          {i.evidenceLevel && <span className="ml-1 text-gray-400">(Evid.: {i.evidenceLevel}{i.source ? ', DDInter' : ''})</span>}
                          <div className="text-gray-600">{i.clinicalEffect}</div>
                          {i.monitoring && <div className="text-gray-500">👁 {i.monitoring}</div>}
                          {i.references && i.references.length > 0 && <div className="text-gray-400">Fonte: {i.references.join(' · ')}</div>}
                        </div>
                      ))}
                    </div>
                    <button onClick={draftFromDetected} className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100">
                      Inserir nas notas (riscos/intervenções/plano)
                    </button>
                  </>
                )}
              </div>
            )}
            {!detDone && <p className="mt-2 text-xs text-amber-700">Cruza os medicamentos do paciente pela base (interações + alimentos/suplementos), já com contexto de idade.</p>}
          </div>

          {/* notas clínicas */}
          <div className="grid gap-3 sm:grid-cols-2">
            {([['riscos', 'Riscos identificados'], ['intervencoes', 'Intervenções farmacêuticas'], ['orientacoes', 'Orientações ao paciente'], ['recomendacoes', 'Recomendações ao prescritor'], ['plano', 'Plano de acompanhamento']] as const).map(([k, label]) => (
              <label key={k} className="text-sm">
                <span className="text-gray-600">{label}</span>
                <textarea value={notes[k]} onChange={e => setNotes({ ...notes, [k]: e.target.value })} rows={2}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#2c7a7b]" />
              </label>
            ))}
          </div>

          {/* ações */}
          <div className="flex flex-wrap gap-2">
            <button onClick={printReport} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Printer className="h-4 w-4" /> Imprimir / PDF</button>
            <button onClick={genPng} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><ImageIcon className="h-4 w-4" /> Gerar imagem (PNG)</button>
            <button onClick={() => navigator.clipboard?.writeText(whatsappText())} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"><Copy className="h-4 w-4" /> Copiar texto</button>
            <button onClick={persist} className="flex items-center gap-1 rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white">{recId ? <Check className="h-4 w-4" /> : null} {recId ? 'Anexada ao prontuário' : 'Anexar ao prontuário'}</button>
          </div>

          {/* WhatsApp seguro */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center gap-2 font-semibold text-emerald-800"><MessageCircle className="h-4 w-4" /> Enviar ao paciente (WhatsApp)</div>
            <p className="mt-1 flex items-start gap-1 text-xs text-amber-700"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Envia a <b>versão simplificada</b>. Não exponha dados sensíveis desnecessários; o CPF nunca é enviado.</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Telefone com DDD" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={anon} onChange={e => setAnon(e.target.checked)} /> Anonimizar nome (iniciais)</label>
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-800"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> O paciente <b>consentiu</b> em receber o relatório por WhatsApp.</label>
            <button onClick={sendWhatsApp} disabled={busy} className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Enviar ao paciente
            </button>
            {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
          </div>

          {/* Card compacto (off-screen) usado para gerar a imagem PNG do WhatsApp */}
          <div ref={cardRef} style={{ position: 'absolute', left: -99999, top: 0, width: 480, background: '#fff', padding: 24, fontFamily: 'Segoe UI, Arial', color: '#1a202c' }}>
            <div style={{ borderBottom: '3px solid #1e3a5f', paddingBottom: 8, marginBottom: 12 }}>
              <div style={{ color: '#1e3a5f', fontSize: 20, fontWeight: 800 }}>PRM Care</div>
              <div style={{ color: '#475569', fontSize: 12 }}>Conciliação medicamentosa · {today}</div>
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}><b>Paciente:</b> {displayName(anon)}{p.patientAge != null ? ` · ${p.patientAge} anos` : ''}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2c7a7b', marginBottom: 4 }}>Seus medicamentos</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {p.meds.map((m, i) => <li key={i} style={{ marginBottom: 2 }}>{m.name}{m.dosage ? ` — ${m.dosage}` : ''}{m.frequency ? ` (${m.frequency})` : ''}</li>)}
            </ul>
            {notes.orientacoes && <><div style={{ fontSize: 13, fontWeight: 700, color: '#2c7a7b', margin: '8px 0 2px' }}>Orientações</div><div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{notes.orientacoes}</div></>}
            {notes.plano && <><div style={{ fontSize: 13, fontWeight: 700, color: '#2c7a7b', margin: '8px 0 2px' }}>Acompanhamento</div><div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{notes.plano}</div></>}
            <div style={{ fontSize: 10, color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: 6, marginTop: 12 }}>{DISCLAIMER} — {p.pharmacist}</div>
          </div>
        </div>
      )}
    </div>
  )
}
