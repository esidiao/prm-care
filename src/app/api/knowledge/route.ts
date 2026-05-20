import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const type = searchParams.get('type') ?? ''
  const status = searchParams.get('status') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = 20

  const where: Record<string, unknown> = {}
  if (type) where.type = type
  if (status) where.status = status
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { content: { contains: q, mode: 'insensitive' } },
      { drugNames: { has: q } },
    ]
  }

  try {
    const [entries, total] = await Promise.all([
      prisma.knowledgeBase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          createdBy: { select: { name: true, email: true } },
        },
      }),
      prisma.knowledgeBase.count({ where }),
    ])

    return NextResponse.json({ entries, total, page, pages: Math.ceil(total / limit) })
  } catch {
    return NextResponse.json({ entries: [], total: 0, page: 1, pages: 0 })
  }
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    title, type, content, summary, source, sourceUrl,
    tags, drugNames, icd10Codes, observations,
  } = body as {
    title: string
    type: string
    content: string
    summary?: string
    source: string
    sourceUrl?: string
    tags?: string[]
    drugNames?: string[]
    icd10Codes?: string[]
    observations?: string
  }

  if (!title?.trim() || !type || !content?.trim() || !source?.trim()) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  try {
    const entry = await prisma.knowledgeBase.create({
      data: {
        title: title.trim(),
        type: type as never,
        content: content.trim(),
        summary: summary?.trim() || null,
        source: source.trim(),
        sourceUrl: sourceUrl?.trim() || null,
        tags: tags ?? [],
        drugNames: drugNames ?? [],
        icd10Codes: icd10Codes ?? [],
        observations: observations?.trim() || null,
        status: 'PENDING',
        createdById: session.user.id,
      },
    })
    return NextResponse.json(entry, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro ao criar entrada' }, { status: 500 })
  }
}
