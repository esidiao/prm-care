import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { writeLimiter } from '@/lib/rate-limit'
import prisma from '@/lib/prisma'
import { z } from 'zod'

// `type` e `status` são String no schema (os valores válidos vivem só num
// comentário do Prisma), então nada impede a persistência de um valor
// arbitrário — que depois quebra os mapas de ícone/rótulo da UI. O enum abaixo
// espelha exatamente as opções do seletor em components/patients/PatientReviews.
const REVIEW_TYPES = ['MEDICATION_REVIEW', 'FOLLOW_UP', 'LAB_CHECK', 'ADHERENCE', 'CUSTOM'] as const

const createSchema = z.object({
  scheduledDate: z.string().refine(s => !isNaN(new Date(s).getTime()), 'Data agendada inválida'),
  type: z.enum(REVIEW_TYPES),
  title: z.string().trim().min(1, 'Título obrigatório').max(200),
  notes: z.string().trim().max(5000).optional(),
})

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

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
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rl = await writeLimiter(session.user.id)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas operações em pouco tempo. Aguarde alguns instantes.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    )
  }

  // Verify patient belongs to user
  const patient = await prisma.patient.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  })
  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos.', details: parsed.error.errors },
      { status: 400 },
    )
  }
  const { scheduledDate, type, title, notes } = parsed.data

  try {
    const review = await prisma.patientReview.create({
      data: {
        patientId: params.id,
        userId: session.user.id,
        scheduledDate: new Date(scheduledDate),
        type,
        title,
        notes: notes || null,
        status: 'PENDING',
      },
    })

    return NextResponse.json({
      ...review,
      scheduledDate: review.scheduledDate.toISOString(),
      completedAt: null,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
    }, { status: 201 })
  } catch (err) {
    console.error('[REVIEWS_POST]', err)
    return NextResponse.json({ error: 'Erro ao criar agendamento.' }, { status: 500 })
  }
}
