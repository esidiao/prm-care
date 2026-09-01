'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex flex-shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors print:hidden"
    >
      <Printer className="h-4 w-4" />
      Imprimir / PDF
    </button>
  )
}
