import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

// PATCH /api/user/profile — update name, crfNumber, specialization, institution
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { name, crfNumber, specialization, institution } = body

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(name !== undefined && { name: name?.trim() || null }),
      ...(crfNumber !== undefined && { crfNumber: crfNumber?.trim() || null }),
      ...(specialization !== undefined && { specialization: specialization?.trim() || null }),
      ...(institution !== undefined && { institution: institution?.trim() || null }),
    },
    select: {
      id: true, name: true, email: true, crfNumber: true,
      specialization: true, institution: true, role: true, plan: true,
    },
  })

  return NextResponse.json({ user: updated })
}
