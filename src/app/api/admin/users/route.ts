import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { addTokens } from '@/lib/token-service'
import { TransactionType, UserRole, PlanType } from '@prisma/client'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const url = new URL(req.url)
  const search = url.searchParams.get('search') || ''
  const role = url.searchParams.get('role')
  const plan = url.searchParams.get('plan')
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = 20

  const where = {
    ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] } : {}),
    ...(role ? { role: role as UserRole } : {}),
    ...(plan ? { plan: plan as PlanType } : {}),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, role: true, plan: true,
        tokenBalance: true, isActive: true, createdAt: true, lastLoginAt: true,
        crfNumber: true, institution: true, _count: { select: { patients: true, analyses: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json({ success: true, data: users, total, pages: Math.ceil(total / limit) })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const schema = z.object({
    userId: z.string(),
    action: z.enum(['toggle_active', 'change_plan', 'change_role', 'add_tokens']),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  })

  const body = schema.parse(await req.json())
  const { userId, action, value } = body

  if (userId === session.user.id && action === 'toggle_active') {
    return NextResponse.json({ error: 'Não pode desativar a própria conta.' }, { status: 400 })
  }

  let updated

  if (action === 'toggle_active') {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } })
    updated = await prisma.user.update({ where: { id: userId }, data: { isActive: !user?.isActive } })
  } else if (action === 'change_plan') {
    updated = await prisma.user.update({ where: { id: userId }, data: { plan: value as PlanType } })
  } else if (action === 'change_role') {
    updated = await prisma.user.update({ where: { id: userId }, data: { role: value as UserRole } })
  } else if (action === 'add_tokens') {
    const amount = parseInt(String(value))
    await addTokens(userId, amount, TransactionType.BONUS, `Tokens adicionados pelo administrador`, undefined, undefined, session.user.id)
    updated = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, tokenBalance: true } })
  }

  await prisma.auditLog.create({
    data: { userId: session.user.id, action: `ADMIN_${action.toUpperCase()}`, resource: 'user', resourceId: userId, details: { value } },
  })

  return NextResponse.json({ success: true, data: updated })
}
