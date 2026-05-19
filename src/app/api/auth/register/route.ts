import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { addTokens } from '@/lib/token-service'
import { z } from 'zod'
import { TransactionType, ConsentType, UserRole } from '@prisma/client'

const schema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['PROFESSIONAL', 'STUDENT']),
  crfNumber: z.string().optional(),
  institution: z.string().optional(),
  consents: z.object({
    terms: z.boolean(),
    privacy: z.boolean(),
    clinical: z.boolean(),
  }),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = schema.parse(body)

    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) {
      return NextResponse.json({ error: 'Este email já está cadastrado.' }, { status: 409 })
    }

    const hashedPassword = await hashPassword(data.password)
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const ua = req.headers.get('user-agent') || ''

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role as UserRole,
        crfNumber: data.crfNumber,
        institution: data.institution,
        tokenBalance: 0,
      },
    })

    // Create consent records
    const consentData = [
      { type: ConsentType.TERMS_OF_USE, accepted: data.consents.terms },
      { type: ConsentType.PRIVACY_POLICY, accepted: data.consents.privacy },
      { type: ConsentType.CLINICAL_DISCLAIMER, accepted: data.consents.clinical },
    ]
    await prisma.consentRecord.createMany({
      data: consentData.map(c => ({
        userId: user.id,
        type: c.type,
        version: '1.0',
        accepted: c.accepted,
        ipAddress: ip,
        userAgent: ua,
      })),
    })

    // Grant welcome demo tokens
    await addTokens(
      user.id,
      5,
      TransactionType.BONUS,
      'Tokens de boas-vindas — 2 análises demonstrativas incluídas',
    )

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'REGISTER',
        resource: 'auth',
        ipAddress: ip,
        userAgent: ua,
      },
    })

    return NextResponse.json({ success: true, message: 'Conta criada com sucesso!' }, { status: 201 })
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: 'Dados inválidos.', details: err.errors }, { status: 400 })
    }
    console.error('[REGISTER]', err)
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
