import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

const MAX_SIZE_BYTES = 200 * 1024 // 200 KB after base64

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }
  const { image } = body as { image: string | null }

  // Allow removal (null)
  if (image !== null) {
    if (typeof image !== 'string') {
      return NextResponse.json({ error: 'Imagem inválida' }, { status: 400 })
    }
    if (!image.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Formato de imagem inválido' }, { status: 400 })
    }
    if (image.length > MAX_SIZE_BYTES * 1.4) {
      // base64 encoding overhead ~33%
      return NextResponse.json({ error: 'Imagem muito grande (máximo 200 KB)' }, { status: 400 })
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image },
  })

  return NextResponse.json({ ok: true })
}
