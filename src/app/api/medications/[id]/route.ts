import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  activeIngredient: z.string().min(1).optional(),
  tradeName: z.string().nullable().optional(),
  dose: z.number().nullable().optional(),
  doseUnit: z.string().nullable().optional(),
  pharmaceuticalForm: z.string().nullable().optional(),
  route: z.string().optional(),
  frequency: z.string().nullable().optional(),
  indication: z.string().nullable().optional(),
  adherence: z.string().optional(),
  isSelfMedication: z.boolean().optional(),
  adverseEffects: z.string().nullable().optional(),
})

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Verificar se o medicamento pertence a um paciente do usuário
  const medication = await prisma.medication.findFirst({
    where: {
      id: params.id,
      patient: { userId: session.user.id },
    },
  })

  if (!medication) {
    return NextResponse.json({ error: 'Medicamento não encontrado' }, { status: 404 })
  }

  await prisma.medication.delete({ where: { id: params.id } })

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'DELETE_MEDICATION',
      resource: 'medication',
      resourceId: params.id,
    },
  })

  return NextResponse.json({ success: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const medication = await prisma.medication.findFirst({
    where: {
      id: params.id,
      patient: { userId: session.user.id },
    },
  })

  if (!medication) {
    return NextResponse.json({ error: 'Medicamento não encontrado' }, { status: 404 })
  }

  let data: z.infer<typeof patchSchema>
  try {
    data = patchSchema.parse(await req.json())
  } catch (err: any) {
    return NextResponse.json({ error: 'Dados inválidos', details: err.errors }, { status: 400 })
  }

  const updated = await prisma.medication.update({
    where: { id: params.id },
    data: {
      isActive: data.isActive ?? medication.isActive,
      ...(data.activeIngredient !== undefined && { activeIngredient: data.activeIngredient }),
      ...(data.tradeName !== undefined && { tradeName: data.tradeName }),
      ...(data.dose !== undefined && { dose: data.dose }),
      ...(data.doseUnit !== undefined && { doseUnit: data.doseUnit }),
      ...(data.pharmaceuticalForm !== undefined && { pharmaceuticalForm: data.pharmaceuticalForm }),
      ...(data.route !== undefined && { route: data.route as any }),
      ...(data.frequency !== undefined && { frequency: data.frequency }),
      ...(data.indication !== undefined && { indication: data.indication }),
      ...(data.adherence !== undefined && { adherence: data.adherence as any }),
      ...(data.isSelfMedication !== undefined && { isSelfMedication: data.isSelfMedication }),
      ...(data.adverseEffects !== undefined && { adverseEffects: data.adverseEffects }),
    },
  })

  return NextResponse.json({ success: true, data: updated })
}
