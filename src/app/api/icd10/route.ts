import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { searchICD10 } from '@/lib/icd10-data'

// Busca CID-10. Hoje o ICD10Combobox resolve tudo no cliente a partir de
// `@/lib/icd10-data`, então esta rota não tem chamador — mas continuava
// exposta sem autenticação. Fica atrás da sessão até termos um consumidor.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q') ?? ''
  const results = searchICD10(q, 10)
  return NextResponse.json(results)
}
