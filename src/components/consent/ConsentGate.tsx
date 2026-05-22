'use client'
import { useEffect, useState } from 'react'
import { Shield, Lock, FileText, AlertTriangle, Loader2 } from 'lucide-react'

/**
 * ConsentGate — blocks the UI until the user accepts all LGPD consents.
 * Renders children only after consent is confirmed.
 */
export function ConsentGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'required'>('loading')
  const [accepting, setAccepting] = useState(false)
  const [agreed, setAgreed] = useState(false)

  useEffect(() => {
    fetch('/api/consent')
      .then(r => r.json())
      .then(d => setStatus(d.allGiven ? 'ok' : 'required'))
      .catch(() => setStatus('ok')) // on error, don't block the app
  }, [])

  const accept = async () => {
    if (!agreed) return
    setAccepting(true)
    try {
      await fetch('/api/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      setStatus('ok')
    } catch {
      setStatus('ok') // fail open — don't block the app
    } finally {
      setAccepting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
      </div>
    )
  }

  if (status === 'ok') return <>{children}</>

  // ── Modal de consentimento ──────────────────────────────────────────────────
  return (
    <>
      {/* Blurred background */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-[#0f2744] px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Proteção de Dados — LGPD</h2>
                <p className="text-xs text-white/60">Lei 13.709/2018 · Versão 1.0</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-gray-700 leading-relaxed">
              O <strong>PRM Care</strong> processa dados de saúde de pacientes, que são dados sensíveis nos termos da LGPD.
              Antes de continuar, você precisa confirmar que está ciente de como seus dados e os dados de seus pacientes são tratados.
            </p>

            {/* Itens de consentimento */}
            <div className="space-y-2.5 rounded-xl bg-gray-50 p-4">
              {[
                { icon: FileText, label: 'Termos de Uso', desc: 'Regras de utilização da plataforma' },
                { icon: Lock, label: 'Política de Privacidade', desc: 'Como seus dados pessoais são coletados e tratados' },
                { icon: Shield, label: 'Tratamento de Dados Clínicos', desc: 'Finalidade: suporte à decisão farmacêutica. Base legal: Art. 7º, VIII e Art. 11, II, f da LGPD' },
                { icon: AlertTriangle, label: 'Disclaimer Clínico', desc: 'As análises são de apoio à decisão e não substituem o julgamento profissional' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#1e3a5f]/10">
                    <Icon className="h-3.5 w-3.5 text-[#1e3a5f]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Links para documentos */}
            <p className="text-xs text-gray-500">
              Leia os documentos completos:{' '}
              <a href="/terms" target="_blank" className="text-[#1e3a5f] underline">Termos de Uso</a>
              {' · '}
              <a href="/privacy" target="_blank" className="text-[#1e3a5f] underline">Política de Privacidade</a>
            </p>

            {/* Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border-2 border-blue-200 bg-blue-50 p-4 hover:bg-blue-100 transition-colors">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#1e3a5f]"
              />
              <span className="text-sm text-blue-900 font-medium leading-relaxed">
                Li e concordo com os Termos de Uso, Política de Privacidade, tratamento de dados clínicos e disclaimer clínico do PRM Care.
              </span>
            </label>

            {/* Botão */}
            <button
              onClick={accept}
              disabled={!agreed || accepting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1e3a5f] py-3 text-sm font-semibold text-white hover:bg-[#162d4a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {accepting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando…</>
                : <><Shield className="h-4 w-4" /> Confirmar e acessar</>
              }
            </button>

            <p className="text-center text-[10px] text-gray-400">
              Seu consentimento é registrado com data, hora e IP para fins de auditoria (LGPD Art. 7º).
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
