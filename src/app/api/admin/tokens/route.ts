import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

const packageSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  tokens: z.number().int().positive(),
  priceInCents: z.number().int().positive(),
  currency: z.string().default('BRL'),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().default(0),
})

export async function GET() {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const packages = await prisma.tokenPackage.findMany({
    include: { _count: { select: { transactions: true } } },
    orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }],
  })
  return NextResponse.json({ success: true, data: packages })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  try {
    const data = packageSchema.parse(await req.json())
    const pkg = await prisma.tokenPackage.create({ data })
    return NextResponse.json({ success: true, data: pkg }, { status: 201 })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos', details: err.errors }, { status: 400 })
    }
    console.error('[ADMIN_TOKENS_POST]', err)
    return NextResponse.json({ error: 'Erro ao criar pacote.' }, { status: 500 })
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  tokens: z.number().int().positive().optional(),
  priceInCents: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  try {
    const { id, ...data } = patchSchema.parse(await req.json())
    const pkg = await prisma.tokenPackage.update({ where: { id }, data })
    return NextResponse.json({ success: true, data: pkg })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos', details: err.errors }, { status: 400 })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Pacote não encontrado' }, { status: 404 })
    }
    console.error('[ADMIN_TOKENS_PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar pacote.' }, { status: 500 })
  }
}

const deleteSchema = z.object({ id: z.string().min(1) })

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  try {
    const { id } = deleteSchema.parse(await req.json())
    // Soft delete — just deactivate
    await prisma.tokenPackage.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Pacote não encontrado' }, { status: 404 })
    }
    console.error('[ADMIN_TOKENS_DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover pacote.' }, { status: 500 })
  }
}
