import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ patients: [], prms: [], medications: [] })

  const userId = session.user.id

  const [patients, prms, medications] = await Promise.all([
    // Patients — match name or code
    prisma.patient.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 6,
      select: {
        id: true,
        name: true,
        code: true,
        age: true,
        dateOfBirth: true,
        sex: true,
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { urgentPRMs: true, highRiskPRMs: true, totalPRMs: true },
        },
      },
    }),

    // PRMs — match title or description
    prisma.pRMFinding.findMany({
      where: {
        analysis: { userId },
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
        isResolved: false,
      },
      take: 5,
      orderBy: { riskLevel: 'asc' },
      select: {
        id: true,
        title: true,
        riskLevel: true,
        category: true,
        analysisId: true,
        analysis: {
          select: {
            patient: { select: { name: true, code: true } },
          },
        },
      },
    }),

    // Medications — match active ingredient or trade name
    prisma.medication.findMany({
      where: {
        patient: { userId },
        isActive: true,
        OR: [
          { activeIngredient: { contains: q, mode: 'insensitive' } },
          { tradeName: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 4,
      select: {
        id: true,
        activeIngredient: true,
        tradeName: true,
        dose: true,
        doseUnit: true,
        patientId: true,
        patient: { select: { name: true, code: true } },
      },
      distinct: ['activeIngredient'],
    }),
  ])

  // Calculate age server-side
  function calcAge(dob: Date | null, age: number | null): number | null {
    if (dob) {
      const today = new Date()
      let a = today.getFullYear() - dob.getFullYear()
      const m = today.getMonth() - dob.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) a--
      return a
    }
    return age
  }

  return NextResponse.json({
    patients: patients.map(p => ({
      id: p.id,
      name: p.name,
      code: p.code,
      age: calcAge(p.dateOfBirth, p.age),
      sex: p.sex,
      lastAnalysis: p.analyses[0] ?? null,
    })),
    prms,
    medications,
  })
}
