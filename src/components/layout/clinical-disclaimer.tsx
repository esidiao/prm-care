'use client'
import { useState, useEffect } from 'react'
import { Info, X } from 'lucide-react'

const STORAGE_KEY = 'prm-disclaimer-dismissed'

export function ClinicalDisclaimer() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (!dismissed) setVisible(true)
  }, [])

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="mb-5 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2.5 text-xs text-blue-700">
      <Info className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
      <p className="flex-1 leading-relaxed">
        <strong className="font-semibold">Apoio técnico e educacional.</strong>{' '}
        As análises não substituem avaliação profissional. Não ajuste medicamentos sem orientação de farmacêutico ou médico.
      </p>
      <button
        onClick={dismiss}
        className="flex-shrink-0 rounded-md p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-600 transition-colors"
        title="Dispensar">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
