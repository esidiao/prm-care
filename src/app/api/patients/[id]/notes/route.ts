import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { writeLimiter } from '@/lib/rate-limit'
import prisma from '@/lib/prisma'
import { z } from 'zod'

// `content` é @db.Text (sem limite no banco); o teto abaixo evita que uma nota
// gigante trave a renderização Markdown no cliente e a geração de relatório.
const createSchema = z.object({
  content: z.string().trim().min(1, 'Conteúdo obrigatório').max(20000),
})

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
    // Teto defensivo: as notas de um paciente crescem indefinidamente ao longo
    // do acompanhamento e são carregadas inteiras a cada abertura do prontuário.
    // A ordenação garante que fixadas e mais recentes vêm primeiro.
    take: 200,
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

  const rl = await writeLimiter(session.user.id)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas operações em pouco tempo. Aguarde alguns instantes.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    )
  }

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

  try {
    const note = await prisma.clinicalNote.create({
      data: {
        patientId: params.id,
        userId: session.user.id,
        content: parsed.data.content,
      },
      select: {
        id: true, content: true, isPinned: true, createdAt: true, updatedAt: true,
        user: { select: { name: true, email: true } },
      },
    })

    return NextResponse.json({ note }, { status: 201 })
  } catch (err) {
    console.error('[NOTES_POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar a nota.' }, { status: 500 })
  }
}
