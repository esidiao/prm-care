'use client'
import { useState } from 'react'
import { Download, Shield, AlertTriangle, X } from 'lucide-react'

interface Props {
  href: string
  label?: string
  filename?: string
  className?: string
}

/**
 * Wraps a CSV/data export link with a LGPD consent modal.
 * User must confirm they understand data sensitivity before download starts.
 */
export function ExportWithWarning({ href, label = 'Exportar CSV', filename, className }: Props) {
  const [open, setOpen] = useState(false)

  const proceed = () => {
    setOpen(false)
    // Trigger download via hidden link
    const a = document.createElement('a')
    a.href = href
    if (filename) a.download = filename
    a.click()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className ?? 'flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors'}
      >
        <Download className="h-4 w-4" />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h3 className="font-semibold text-amber-900">Aviso — Dados Sensíveis</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                O arquivo que será gerado contém <strong>dados pessoais e de saúde de pacientes</strong>,
                classificados como dados sensíveis pela LGPD (Art. 11).
              </p>

              <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-2 text-xs text-red-800">
                <p className="font-semibold flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Sua responsabilidade como controlador de dados:
                </p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Mantenha o arquivo em local seguro com acesso restrito</li>
                  <li>Não compartilhe sem finalidade clínica e base legal definida</li>
                  <li>Exclua o arquivo quando não for mais necessário</li>
                  <li>O download fica registrado nos logs de auditoria</li>
                </ul>
              </div>

              <p className="text-xs text-gray-500">
                Esta exportação é registrada com data, hora e usuário nos logs do sistema (LGPD Art. 37).
              </p>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={proceed}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#1e3a5f] py-2.5 text-sm font-semibold text-white hover:bg-[#162d4a] transition-colors"
                >
                  <Download className="h-4 w-4" /> Entendido — Exportar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
