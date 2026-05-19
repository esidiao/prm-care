import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
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

  const data = packageSchema.parse(await req.json())
  const pkg = await prisma.tokenPackage.create({ data })
  return NextResponse.json({ success: true, data: pkg }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { id, ...data } = await req.json()
  const pkg = await prisma.tokenPackage.update({ where: { id }, data })
  return NextResponse.json({ success: true, data: pkg })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { id } = await req.json()
  // Soft delete — just deactivate
  await prisma.tokenPackage.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ success: true })
}
