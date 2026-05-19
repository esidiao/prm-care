import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { Sex } from '@prisma/client'
import { calculateBMI } from '@/lib/utils'

const updateSchema = z.object({
  name: z.string().optional(),
  dateOfBirth: z.string().optional(),
  age: z.number().optional(),
  sex: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  weight: z.number().optional(),
  height: z.number().optional(),
  isPregnant: z.boolean().optional(),
  gestationalAge: z.number().optional(),
  isLactating: z.boolean().optional(),
  isAnonymized: z.boolean().optional(),
  chiefComplaint: z.string().optional(),
  clinicalHistory: z.string().optional(),
  renalFunction: z.string().optional(),
  creatinineClearance: z.number().optional(),
  hepaticFunction: z.string().optional(),
  observations: z.string().optional(),
  comorbidities: z.array(z.object({ name: z.string(), icd10Code: z.string().optional() })).optional(),
  allergies: z.array(z.object({ substance: z.string(), reaction: z.string().optional(), severity: z.string().optional() })).optional(),
  diagnoses: z.array(z.object({ name: z.string(), icd10Code: z.string().optional(), isPrimary: z.boolean().default(false) })).optional(),
  labResults: z.array(z.object({
    examName: z.string(), value: z.string(), unit: z.string().optional(),
    referenceMin: z.number().optional(), referenceMax: z.number().optional(),
    isAbnormal: z.boolean().default(false), collectedAt: z.string().optional(),
  })).optional(),
})

// GET /api/patients/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const patient = await prisma.patient.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      comorbidities: true,
      allergies: true,
      diagnoses: true,
      medications: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
      labResults: { orderBy: { collectedAt: 'desc' } },
      analyses: {
        include: { findings: { select: { riskLevel: true, category: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })

  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })
  return NextResponse.json({ success: true, data: patient })
}

// PUT /api/patients/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const existing = await prisma.patient.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const age = data.dateOfBirth
      ? new Date().getFullYear() - new Date(data.dateOfBirth).getFullYear()
      : data.age
    const bmi = data.weight && data.height ? calculateBMI(data.weight, data.height) : undefined

    const updated = await prisma.$transaction(async (tx) => {
      // Replace related collections if provided
      if (data.comorbidities !== undefined) {
        await tx.comorbidity.deleteMany({ where: { patientId: params.id } })
        if (data.comorbidities.length > 0)
          await tx.comorbidity.createMany({ data: data.comorbidities.map(c => ({ ...c, patientId: params.id })) })
      }
      if (data.allergies !== undefined) {
        await tx.allergy.deleteMany({ where: { patientId: params.id } })
        if (data.allergies.length > 0)
          await tx.allergy.createMany({ data: data.allergies.map(a => ({ ...a, patientId: params.id })) })
      }
      if (data.diagnoses !== undefined) {
        await tx.diagnosis.deleteMany({ where: { patientId: params.id } })
        if (data.diagnoses.length > 0)
          await tx.diagnosis.createMany({ data: data.diagnoses.map(d => ({ ...d, patientId: params.id })) })
      }
      if (data.labResults !== undefined && data.labResults.length > 0) {
        await tx.labResult.createMany({
          data: data.labResults.map(l => ({
            ...l, patientId: params.id,
            collectedAt: l.collectedAt ? new Date(l.collectedAt) : null,
          })),
        })
      }

      return tx.patient.update({
        where: { id: params.id },
        data: {
          name: data.isAnonymized ? null : (data.name ?? existing.name),
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : existing.dateOfBirth,
          age: age ?? existing.age,
          sex: (data.sex as Sex | undefined) ?? existing.sex,
          weight: data.weight ?? existing.weight,
          height: data.height ?? existing.height,
          bmi: bmi ?? existing.bmi,
          isPregnant: data.isPregnant ?? existing.isPregnant,
          gestationalAge: data.gestationalAge ?? existing.gestationalAge,
          isLactating: data.isLactating ?? existing.isLactating,
          isAnonymized: data.isAnonymized ?? existing.isAnonymized,
          chiefComplaint: data.chiefComplaint ?? existing.chiefComplaint,
          clinicalHistory: data.clinicalHistory ?? existing.clinicalHistory,
          renalFunction: data.renalFunction ?? existing.renalFunction,
          creatinineClearance: data.creatinineClearance ?? existing.creatinineClearance,
          hepaticFunction: data.hepaticFunction ?? existing.hepaticFunction,
          isElderly: (age ?? existing.age ?? 0) >= 60,
          observations: data.observations ?? existing.observations,
        },
      })
    })

    await prisma.auditLog.create({
      data: { userId: session.user.id, action: 'UPDATE_PATIENT', resource: 'patient', resourceId: params.id },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err: any) {
    if (err.name === 'ZodError') return NextResponse.json({ error: 'Dados inválidos', details: err.errors }, { status: 400 })
    console.error('[UPDATE_PATIENT]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE /api/patients/[id]  — soft delete
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const existing = await prisma.patient.findFirst({ where: { id: params.id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  await prisma.patient.update({ where: { id: params.id }, data: { isActive: false } })
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: 'DELETE_PATIENT', resource: 'patient', resourceId: params.id },
  })

  return NextResponse.json({ success: true, message: 'Paciente removido.' })
}
