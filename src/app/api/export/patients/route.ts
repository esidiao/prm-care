import { NextResponse, NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logAudit, getClientIp } from '@/lib/audit'
import { escCsv, csvRow } from '@/lib/csv-export'
import { calculateAge } from '@/lib/utils'
import { exportLimiter } from '@/lib/rate-limit'

// ── GET /api/export/patients ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Exportação em massa de dados clínicos — limita exfiltração por conta comprometida
  const rl = await exportLimiter(session.user.id)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas exportações em pouco tempo. Aguarde alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  // Audit: record who downloaded patient data and when
  await logAudit({
    userId:    session.user.id,
    action:    'EXPORT_PATIENTS',
    resource:  'patients',
    ipAddress: getClientIp(req),
    details:   { format: 'csv' },
  })

  const patients = await prisma.patient.findMany({
    where: { userId: session.user.id, isActive: true },
    include: {
      medications: { where: { isActive: true }, select: { activeIngredient: true } },
      comorbidities: { select: { name: true } },
      diagnoses: { select: { name: true } },
      analyses: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          createdAt: true,
          totalPRMs: true,
          urgentPRMs: true,
          highRiskPRMs: true,
          moderatePRMs: true,
        },
      },
      _count: { select: { analyses: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const headers = [
    'Código',
    'Nome',
    'Sexo',
    'Idade',
    'Data de Nascimento',
    'Peso (kg)',
    'Altura (cm)',
    'Diagnósticos',
    'Comorbidades',
    'Medicamentos ativos',
    'Total de análises',
    'Data última análise',
    'Total PRMs (última análise)',
    'PRMs urgentes',
    'PRMs alto risco',
    'PRMs moderados',
  ]

  const lines: string[] = [headers.map(escCsv).join(',')]

  for (const p of patients) {
    const age = p.dateOfBirth ? calculateAge(p.dateOfBirth) : p.age
    const last = p.analyses[0]
    lines.push(csvRow([
      p.code,
      p.name ?? '',
      p.sex === 'MALE' ? 'Masculino' : p.sex === 'FEMALE' ? 'Feminino' : p.sex ?? '',
      age ?? '',
      p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : '',
      p.weight ?? '',
      p.height ?? '',
      p.diagnoses.map(d => d.name).join('; '),
      p.comorbidities.map(c => c.name).join('; '),
      p.medications.map(m => m.activeIngredient).join('; '),
      p._count.analyses,
      last ? last.createdAt.toISOString().slice(0, 10) : '',
      last?.totalPRMs ?? '',
      last?.urgentPRMs ?? '',
      last?.highRiskPRMs ?? '',
      last?.moderatePRMs ?? '',
    ]))
  }

  // BOM UTF-8 so Excel opens with correct encoding
  const csv = '﻿' + lines.join('\r\n')
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pacientes_${date}.csv"`,
    },
  })
}
