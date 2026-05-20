import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; reviewId: string } },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { status, completedNote, scheduledDate, title, notes, type } = body as {
    status?: string
    completedNote?: string
    scheduledDate?: string
    title?: string
    notes?: string
    type?: string
  }

  const review = await prisma.patientReview.findFirst({
    where: { id: params.reviewId, patientId: params.id, userId: session.user.id },
  })
  if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.patientReview.update({
    where: { id: params.reviewId },
    data: {
      ...(status && { status }),
      ...(status === 'COMPLETED' && { completedAt: new Date(), completedNote: completedNote?.trim() || null }),
      ...(scheduledDate && { scheduledDate: new Date(scheduledDate) }),
      ...(title && { title: title.trim() }),
      ...(notes !== undefined && { notes: notes?.trim() || null }),
      ...(type && { type }),
    },
  })

  return NextResponse.json({
    ...updated,
    scheduledDate: updated.scheduledDate.toISOString(),
    completedAt: updated.completedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  })
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; reviewId: string } },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const review = await prisma.patientReview.findFirst({
    where: { id: params.reviewId, patientId: params.id, userId: session.user.id },
  })
  if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.patientReview.delete({ where: { id: params.reviewId } })
  return NextResponse.json({ ok: true })
}
