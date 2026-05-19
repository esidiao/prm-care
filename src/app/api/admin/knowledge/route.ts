import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { KnowledgeType, KnowledgeStatus } from '@prisma/client'

const createSchema = z.object({
  title: z.string().min(3),
  type: z.nativeEnum(KnowledgeType),
  content: z.string().min(10),
  summary: z.string().optional(),
  source: z.string().min(2),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  publishedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  status: z.nativeEnum(KnowledgeStatus).default(KnowledgeStatus.PENDING),
  tags: z.array(z.string()).default([]),
  drugNames: z.array(z.string()).default([]),
  icd10Codes: z.array(z.string()).default([]),
  observations: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const type = url.searchParams.get('type')
  const search = url.searchParams.get('search')

  const entries = await prisma.knowledgeBase.findMany({
    where: {
      ...(status ? { status: status as KnowledgeStatus } : {}),
      ...(type ? { type: type as KnowledgeType } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { drugNames: { has: search } }] } : {}),
    },
    include: { createdBy: { select: { name: true, email: true } } },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 100,
  })

  return NextResponse.json({ success: true, data: entries })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const entry = await prisma.knowledgeBase.create({
      data: {
        ...data,
        sourceUrl: data.sourceUrl || null,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        createdById: session.user.id,
        lastReviewedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, data: entry }, { status: 201 })
  } catch (err: any) {
    if (err.name === 'ZodError') return NextResponse.json({ error: 'Dados inválidos', details: err.errors }, { status: 400 })
    console.error('[CREATE_KNOWLEDGE]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const body = await req.json()
  const { id, ...data } = body

  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const updated = await prisma.knowledgeBase.update({
    where: { id },
    data: {
      ...data,
      sourceUrl: data.sourceUrl || null,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : undefined,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      validatedBy: data.status === KnowledgeStatus.VALIDATED ? (data.validatedBy || session.user.email) : undefined,
      validatedAt: data.status === KnowledgeStatus.VALIDATED ? new Date() : undefined,
      lastReviewedAt: new Date(),
    },
  })

  return NextResponse.json({ success: true, data: updated })
}
