import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

// ── GET /api/patients/[id]/notes ─────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Verify patient belongs to user
  const patient = await prisma.patient.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  })
  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const notes = await prisma.clinicalNote.findMany({
    where: { patientId: params.id },
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      content: true,
      isPinned: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { name: true, email: true } },
    },
  })

  return NextResponse.json({ notes })
}

// ── POST /api/patients/[id]/notes ────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const patient = await prisma.patient.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  })
  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const { content } = await req.json()
  if (!content?.trim()) {
    return NextResponse.json({ error: 'Conteúdo obrigatório' }, { status: 400 })
  }

  const note = await prisma.clinicalNote.create({
    data: {
      patientId: params.id,
      userId: session.user.id,
      content: content.trim(),
    },
    select: {
      id: true, content: true, isPinned: true, createdAt: true, updatedAt: true,
      user: { select: { name: true, email: true } },
    },
  })

  return NextResponse.json({ note }, { status: 201 })
}
