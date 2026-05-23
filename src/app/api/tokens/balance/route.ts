import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getTokenBalance } from '@/lib/token-service'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const balance = await getTokenBalance(session.user.id)
  return NextResponse.json({ balance })
}
