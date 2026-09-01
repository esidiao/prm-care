import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      plan: true,
      tokenBalance: true,
      institution: true,
      crfNumber: true,
      specialization: true,
      createdAt: true,
      _count: {
        select: {
          patients: true,
          analyses: true,
        },
      },
    },
  })

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  return NextResponse.json(user)
}

// Teto do avatar em base64. `token.image` é copiado para o JWT do NextAuth, que
// viaja no cookie de sessão (~4 KB de limite no browser): uma data URL grande
// aqui estoura o cookie e derruba o login do usuário no próximo acesso.
// Mesmo teto de /api/user/avatar — as duas rotas gravam o mesmo campo.
const MAX_IMAGE_BYTES = 200 * 1024

// Campos de texto livre do perfil. Sem teto, um PATCH forjado grava strings
// arbitrariamente longas que depois aparecem em relatórios e PDFs.
const MAX_TEXT_LEN = 200

function normalizeText(value: unknown, field: string): { value: string | null } | { error: string } {
  if (value === null) return { value: null }
  if (typeof value !== 'string') return { error: `Campo "${field}" inválido` }
  const trimmed = value.trim()
  if (trimmed.length > MAX_TEXT_LEN) {
    return { error: `Campo "${field}" excede ${MAX_TEXT_LEN} caracteres` }
  }
  return { value: trimmed || null }
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }
  const { name, institution, crfNumber, specialization, image } = body as Record<string, unknown>

  const data: Record<string, string | null> = {}
  for (const [field, raw] of [
    ['name', name],
    ['institution', institution],
    ['crfNumber', crfNumber],
    ['specialization', specialization],
  ] as const) {
    if (raw === undefined) continue
    const result = normalizeText(raw, field)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
    data[field] = result.value
  }

  if (image !== undefined) {
    if (image === null || image === '') {
      data.image = null
    } else if (typeof image !== 'string') {
      return NextResponse.json({ error: 'Imagem inválida' }, { status: 400 })
    } else if (!image.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Formato de imagem inválido' }, { status: 400 })
    } else if (image.length > MAX_IMAGE_BYTES * 1.4) {
      // ~33% de overhead do base64
      return NextResponse.json({ error: 'Imagem muito grande (máximo 200 KB)' }, { status: 400 })
    } else {
      data.image = image
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        institution: true,
        crfNumber: true,
        specialization: true,
      },
    })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PROFILE_PATCH]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erro ao salvar perfil' }, { status: 500 })
  }
}
