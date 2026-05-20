'use client'
export function ReferralPrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-[#162d4a] transition-colors"
    >
      🖨️ Imprimir / Salvar PDF
    </button>
  )
}
