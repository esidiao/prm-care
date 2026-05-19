import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { generatePatientCode, calculateBMI } from '@/lib/utils'
import { Sex } from '@prisma/client'

const createSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  dateOfBirth: z.string().optional(),
  age: z.number().optional(),
  sex: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  weight: z.number().optional(),
  height: z.number().optional(),
  isPregnant: z.boolean().default(false),
  gestationalAge: z.number().optional(),
  isLactating: z.boolean().default(false),
  isAnonymized: z.boolean().default(false),
  chiefComplaint: z.string().optional(),
  clinicalHistory: z.string().optional(),
  renalFunction: z.string().optional(),
  creatinineClearance: z.number().optional(),
  hepaticFunction: z.string().optional(),
  observations: z.string().optional(),
  comorbidities: z.array(z.object({ name: z.string(), icd10Code: z.string().optional(), isActive: z.boolean().default(true) })).default([]),
  allergies: z.array(z.object({ substance: z.string(), reaction: z.string().optional(), severity: z.string().optional() })).default([]),
  diagnoses: z.array(z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    icd10Code: z.string().optional(),
    isPrimary: z.boolean().default(false),
  })).default([]),
  labResults: z.array(z.object({
    name: z.string(),
    value: z.string(),
    unit: z.string().optional(),
    referenceRange: z.string().optional(),
    collectedAt: z.string().optional(),
  })).default([]),
})

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const patients = await prisma.patient.findMany({
    where: { userId: session.user.id, isActive: true },
    include: {
      _count: { select: { analyses: true } },
      analyses: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { urgentPRMs: true, highRiskPRMs: true, totalPRMs: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: patients })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const age = data.dateOfBirth
      ? new Date().getFullYear() - new Date(data.dateOfBirth).getFullYear()
      : data.age

    const bmi = data.weight && data.height ? calculateBMI(data.weight, data.height) : undefined

    const patient = await prisma.patient.create({
      data: {
        userId: session.user.id,
        code: data.code || generatePatientCode(),
        name: data.isAnonymized ? undefined : data.name,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        age,
        sex: data.sex as Sex | undefined,
        weight: data.weight,
        height: data.height,
        bmi,
        isPregnant: data.isPregnant,
        gestationalAge: data.gestationalAge,
        isLactating: data.isLactating,
        isAnonymized: data.isAnonymized,
        chiefComplaint: data.chiefComplaint,
        clinicalHistory: data.clinicalHistory,
        renalFunction: data.renalFunction,
        creatinineClearance: data.creatinineClearance,
        hepaticFunction: data.hepaticFunction,
        isElderly: (age || 0) >= 60,
        observations: data.observations,
        comorbidities: { createMany: { data: data.comorbidities } },
        allergies: { createMany: { data: data.allergies } },
        diagnoses: {
          createMany: {
            data: data.diagnoses.map(d => ({
              name: d.name || d.description || '',
              icd10Code: d.icd10Code,
              isPrimary: d.isPrimary,
            })),
          },
        },
        ...(data.labResults.length > 0 && {
          labResults: {
            createMany: {
              data: data.labResults.map(lr => ({
                name: lr.name,
                value: lr.value,
                unit: lr.unit,
                referenceRange: lr.referenceRange,
                collectedAt: lr.collectedAt ? new Date(lr.collectedAt) : new Date(),
              })),
            },
          },
        }),
      },
    })

    await prisma.auditLog.create({
      data: { userId: session.user.id, action: 'CREATE_PATIENT', resource: 'patient', resourceId: patient.id },
    })

    return NextResponse.json({ success: true, data: patient }, { status: 201 })
  } catch (err: any) {
    if (err.name === 'ZodError') return NextResponse.json({ error: 'Dados inválidos', details: err.errors }, { status: 400 })
    console.error('[CREATE_PATIENT]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
