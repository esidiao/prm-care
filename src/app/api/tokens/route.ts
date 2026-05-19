import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getTransactionHistory } from '@/lib/token-service'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get('limit') || '30')
  const offset = parseInt(url.searchParams.get('offset') || '0')

  const history = await getTransactionHistory(session.user.id, limit, offset)
  return NextResponse.json({ success: true, data: history })
}
