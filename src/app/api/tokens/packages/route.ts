import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const packages = await prisma.tokenPackage.findMany({
    where: { isActive: true },
    orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
  })
  return NextResponse.json({ success: true, data: packages })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }
  const body = await req.json()
  const pkg = await prisma.tokenPackage.create({ data: body })
  return NextResponse.json({ success: true, data: pkg }, { status: 201 })
}
