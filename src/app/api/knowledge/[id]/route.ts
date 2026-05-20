import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const entry = await prisma.knowledgeBase.findUnique({
    where: { id: params.id },
    include: { createdBy: { select: { name: true, email: true } } },
  }).catch(() => null)

  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(entry)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  try {
    const updated = await prisma.knowledgeBase.update({
      where: { id: params.id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.validatedBy !== undefined && {
          validatedBy: body.validatedBy,
          validatedAt: body.status === 'VALIDATED' ? new Date() : undefined,
        }),
        ...(body.title && { title: body.title.trim() }),
        ...(body.content && { content: body.content.trim() }),
        ...(body.summary !== undefined && { summary: body.summary?.trim() || null }),
        ...(body.observations !== undefined && { observations: body.observations?.trim() || null }),
        ...(body.tags && { tags: body.tags }),
        ...(body.drugNames && { drugNames: body.drugNames }),
      },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.knowledgeBase.delete({ where: { id: params.id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
