import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { seedDefaultPackages } from '@/lib/seed-packages'
import { z } from 'zod'

const packageSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  tokens: z.number().int().positive(),
  priceInCents: z.number().int().nonnegative(),
  currency: z.string().length(3).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export async function GET() {
  let packages = await prisma.tokenPackage.findMany({
    where: { isActive: true },
    orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
  })

  if (packages.length === 0) {
    await seedDefaultPackages()
    packages = await prisma.tokenPackage.findMany({
      where: { isActive: true },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
    })
  }

  return NextResponse.json({ success: true, data: packages })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }
  const body = await req.json().catch(() => null)
  const parsed = packageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', issues: parsed.error.flatten() }, { status: 400 })
  }
  const pkg = await prisma.tokenPackage.create({ data: parsed.data })
  return NextResponse.json({ success: true, data: pkg }, { status: 201 })
}
