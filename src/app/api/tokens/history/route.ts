import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getTransactionHistory } from '@/lib/token-service'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const history = await getTransactionHistory(session.user.id, 30, 0)
  return NextResponse.json({ success: true, data: history })
}
