import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

// ── PATCH /api/patients/[id]/notes/[noteId] ──────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; noteId: string } },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const note = await prisma.clinicalNote.findFirst({
    where: { id: params.noteId, patientId: params.id, userId: session.user.id },
  })
  if (!note) return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 })

  const body = await req.json()
  const updated = await prisma.clinicalNote.update({
    where: { id: params.noteId },
    data: {
      ...(body.content !== undefined && { content: body.content }),
      ...(body.isPinned !== undefined && { isPinned: body.isPinned }),
    },
    select: {
      id: true, content: true, isPinned: true, createdAt: true, updatedAt: true,
      user: { select: { name: true, email: true } },
    },
  })

  return NextResponse.json({ note: updated })
}

// ── DELETE /api/patients/[id]/notes/[noteId] ─────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; noteId: string } },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const note = await prisma.clinicalNote.findFirst({
    where: { id: params.noteId, patientId: params.id, userId: session.user.id },
  })
  if (!note) return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 })

  await prisma.clinicalNote.delete({ where: { id: params.noteId } })

  return NextResponse.json({ success: true })
}
