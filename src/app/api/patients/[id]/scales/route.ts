import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

// ── GET /api/patients/[id]/scales ─────────────────────────────────────────────
export async function GET(
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

  const { searchParams } = new URL(req.url)
  const scaleType = searchParams.get('type') // optional filter

  const assessments = await prisma.scaleAssessment.findMany({
    where: {
      patientId: params.id,
      ...(scaleType ? { scaleType } : {}),
    },
    orderBy: { appliedAt: 'desc' },
    select: {
      id: true,
      scaleType: true,
      answers: true,
      totalScore: true,
      severity: true,
      notes: true,
      appliedAt: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  })

  return NextResponse.json({ assessments })
}

// ── POST /api/patients/[id]/scales ────────────────────────────────────────────
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

  const body = await req.json()
  const { scaleType, answers, totalScore, severity, notes, appliedAt } = body

  if (!scaleType) return NextResponse.json({ error: 'Tipo de escala não informado' }, { status: 400 })
  if (!answers || !Array.isArray(answers)) return NextResponse.json({ error: 'Respostas inválidas' }, { status: 400 })
  if (totalScore === undefined || totalScore === null) return NextResponse.json({ error: 'Score total não informado' }, { status: 400 })
  if (!severity) return NextResponse.json({ error: 'Classificação de severidade não informada' }, { status: 400 })

  try {
    const assessment = await prisma.scaleAssessment.create({
      data: {
        patientId: params.id,
        userId: session.user.id,
        scaleType,
        answers,
        totalScore: Number(totalScore),
        severity,
        notes: notes?.trim() || null,
        appliedAt: appliedAt ? new Date(appliedAt) : new Date(),
      },
      select: {
        id: true,
        scaleType: true,
        answers: true,
        totalScore: true,
        severity: true,
        notes: true,
        appliedAt: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    })
    return NextResponse.json({ assessment }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /scales]', msg)
    const detail = process.env.NODE_ENV === 'development' ? msg : 'Erro ao salvar avaliação'
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
