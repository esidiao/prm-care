import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      plan: true,
      tokenBalance: true,
      institution: true,
      crfNumber: true,
      specialization: true,
      createdAt: true,
      _count: {
        select: {
          patients: true,
          analyses: true,
        },
      },
    },
  })

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  return NextResponse.json(user)
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }
  const { name, institution, crfNumber, specialization, image } = body as {
    name?: string
    institution?: string
    crfNumber?: string
    specialization?: string
    image?: string
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(name !== undefined && { name: name.trim() || null }),
      ...(institution !== undefined && { institution: institution.trim() || null }),
      ...(crfNumber !== undefined && { crfNumber: crfNumber.trim() || null }),
      ...(specialization !== undefined && { specialization: specialization.trim() || null }),
      ...(image !== undefined && { image: image.trim() || null }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      institution: true,
      crfNumber: true,
      specialization: true,
    },
  })

  return NextResponse.json(updated)
}
