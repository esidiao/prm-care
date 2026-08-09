'use client'
export function ReferralPrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-brand-900 transition-colors"
    >
      🖨️ Imprimir / Salvar PDF
    </button>
  )
}
