import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reviews = await prisma.patientReview.findMany({
    where: { patientId: params.id, userId: session.user.id },
    orderBy: { scheduledDate: 'asc' },
  }).catch(() => [])

  // Mark overdue
  const now = new Date()
  const updated = reviews.map((r) => ({
    ...r,
    status: r.status === 'PENDING' && new Date(r.scheduledDate) < now ? 'OVERDUE' : r.status,
    scheduledDate: r.scheduledDate.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))

  return NextResponse.json(updated)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify patient belongs to user
  const patient = await prisma.patient.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  })
  if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 })

  const body = await req.json()
  const { scheduledDate, type, title, notes } = body as {
    scheduledDate: string
    type: string
    title: string
    notes?: string
  }

  if (!scheduledDate || !type || !title?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const review = await prisma.patientReview.create({
    data: {
      patientId: params.id,
      userId: session.user.id,
      scheduledDate: new Date(scheduledDate),
      type,
      title: title.trim(),
      notes: notes?.trim() || null,
      status: 'PENDING',
    },
  })

  return NextResponse.json({
    ...review,
    scheduledDate: review.scheduledDate.toISOString(),
    completedAt: null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  })
}
