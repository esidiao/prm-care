import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

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

  const body = await req.json()

  const updated = await prisma.medication.update({
    where: { id: params.id },
    data: {
      isActive: body.isActive ?? medication.isActive,
      ...(body.activeIngredient !== undefined && { activeIngredient: body.activeIngredient }),
      ...(body.tradeName !== undefined && { tradeName: body.tradeName }),
      ...(body.dose !== undefined && { dose: body.dose }),
      ...(body.doseUnit !== undefined && { doseUnit: body.doseUnit }),
      ...(body.pharmaceuticalForm !== undefined && { pharmaceuticalForm: body.pharmaceuticalForm }),
      ...(body.route !== undefined && { route: body.route }),
      ...(body.frequency !== undefined && { frequency: body.frequency }),
      ...(body.indication !== undefined && { indication: body.indication }),
      ...(body.adherence !== undefined && { adherence: body.adherence }),
      ...(body.isSelfMedication !== undefined && { isSelfMedication: body.isSelfMedication }),
      ...(body.adverseEffects !== undefined && { adverseEffects: body.adverseEffects }),
    },
  })

  return NextResponse.json({ success: true, data: updated })
}
