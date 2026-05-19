import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const medicationSchema = z.object({
  // activeIngredient is required in the DB schema
  activeIngredient: z.string().min(1, 'Princípio ativo obrigatório'),
  tradeName: z.string().optional(),
  dose: z.union([z.string(), z.number()]).optional().transform(v => v !== undefined && v !== '' ? String(v) : undefined),
  doseUnit: z.string().optional(),
  pharmaceuticalForm: z.string().optional(),
  route: z.string().default('ORAL'),
  frequency: z.string().optional(),
  frequencyHours: z.number().optional(),
  schedule: z.string().optional(),
  indication: z.string().optional(),
  isPrescribed: z.boolean().default(true),
  isSelfMedication: z.boolean().default(false),
  durationOfUse: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  adherence: z.string().default('UNKNOWN'),
  adverseEffects: z.string().optional(),
  prescriber: z.string().optional(),
  observations: z.string().optional(),
  isActive: z.boolean().default(true),
})

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const patient = await prisma.patient.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const medications = await prisma.medication.findMany({
    where: { patientId: params.id },
    orderBy: [{ isActive: 'desc' }, { activeIngredient: 'asc' }],
  })

  return NextResponse.json({ success: true, data: medications })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const patient = await prisma.patient.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  try {
    const body = await req.json()
    const data = medicationSchema.parse(body)

    const medication = await prisma.medication.create({
      data: {
        activeIngredient: data.activeIngredient,
        tradeName: data.tradeName,
        dose: data.dose !== undefined && data.dose !== '' ? parseFloat(String(data.dose)) || null : null,
        doseUnit: data.doseUnit,
        pharmaceuticalForm: data.pharmaceuticalForm,
        route: data.route as any,
        frequency: data.frequency,
        frequencyHours: data.frequencyHours,
        schedule: data.schedule,
        indication: data.indication,
        isPrescribed: data.isPrescribed,
        isSelfMedication: data.isSelfMedication,
        durationOfUse: data.durationOfUse,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        adherence: data.adherence as any,
        adverseEffects: data.adverseEffects,
        prescriber: data.prescriber,
        observations: data.observations,
        isActive: data.isActive,
        patientId: params.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_MEDICATION',
        resource: 'medication',
        resourceId: medication.id,
        details: { patientId: params.id, activeIngredient: data.activeIngredient },
      },
    })

    return NextResponse.json({ success: true, data: medication }, { status: 201 })
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: 'Dados inválidos', details: err.errors }, { status: 400 })
    }
    console.error('[CREATE_MEDICATION]', err)
    return NextResponse.json({ error: 'Erro interno ao salvar medicamento.' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const patient = await prisma.patient.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const { medicationId, ...data } = await req.json()
  if (!medicationId) return NextResponse.json({ error: 'medicationId obrigatório' }, { status: 400 })

  const medication = await prisma.medication.update({
    where: { id: medicationId, patientId: params.id },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
  })

  return NextResponse.json({ success: true, data: medication })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const patient = await prisma.patient.findFirst({
    where: { id: params.id, userId: session.user.id },
  })
  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const { medicationId } = await req.json()
  if (!medicationId) return NextResponse.json({ error: 'medicationId obrigatório' }, { status: 400 })

  // Soft delete — mark as inactive
  await prisma.medication.update({
    where: { id: medicationId, patientId: params.id },
    data: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
