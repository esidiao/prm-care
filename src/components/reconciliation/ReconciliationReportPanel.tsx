'use client'
import { useState } from 'react'
import { FileText, Printer, Copy, MessageCircle, Check, ShieldAlert, Loader2 } from 'lucide-react'

type Med = { name: string; dosage: string | null; frequency: string | null; isSelfMedication?: boolean; adherence?: string | null }
type Props = {
  patientId: string
  patientName: string
  patientAge: number | null
  pharmacist: string
  allergies: string[]
  meds: Med[]
}
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
        </div>
      )}
    </div>
  )
}
