import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const url = new URL(req.url)
  const search = url.searchParams.get('search') || ''
  const action = url.searchParams.get('action') || ''
  const resource = url.searchParams.get('resource') || ''
  const userId = url.searchParams.get('userId') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = 50

  const where = {
    ...(search ? {
      OR: [
        { action: { contains: search, mode: 'insensitive' as const } },
        { resource: { contains: search, mode: 'insensitive' as const } },
        { user: { name: { contains: search, mode: 'insensitive' as const } } },
        { user: { email: { contains: search, mode: 'insensitive' as const } } },
      ],
    } : {}),
    ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}),
    ...(resource ? { resource } : {}),
    ...(userId ? { userId } : {}),
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: logs,
    total,
    pages: Math.ceil(total / limit),
  })
}
