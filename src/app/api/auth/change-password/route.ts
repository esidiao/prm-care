import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { authLimiter } from '@/lib/rate-limit'

const schema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatória'),
  newPassword: z.string()
    .min(8, 'Nova senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Deve conter ao menos uma letra maiúscula')
    .regex(/[0-9]/, 'Deve conter ao menos um número'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

// Quantas senhas anteriores ficam bloqueadas para reuso
const PASSWORD_HISTORY_LIMIT = 5

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // A rota confere a senha atual — sem limite, vira oráculo de força bruta
  const rl = await authLimiter(session.user.id)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas tentativas de troca de senha. Aguarde alguns instantes.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  try {
    const body = schema.parse(await req.json())

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    })

    if (!user?.password) {
      return NextResponse.json({ error: 'Usuário sem senha definida (login social?)' }, { status: 400 })
    }

    const isValid = await bcrypt.compare(body.currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 400 })
    }

    if (body.currentPassword === body.newPassword) {
      return NextResponse.json({ error: 'A nova senha não pode ser igual à atual.' }, { status: 400 })
    }

    // Bloqueia reuso de qualquer uma das últimas N senhas do usuário
    const history = await prisma.passwordHistory.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: PASSWORD_HISTORY_LIMIT,
      select: { passwordHash: true },
    })
    for (const h of history) {
      if (await bcrypt.compare(body.newPassword, h.passwordHash)) {
        return NextResponse.json(
          { error: `A nova senha não pode repetir uma das últimas ${PASSWORD_HISTORY_LIMIT} senhas usadas.` },
          { status: 400 }
        )
      }
    }

    const newHash = await bcrypt.hash(body.newPassword, 12)
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: { password: newHash },
      })
      // Registra a senha SUBSTITUÍDA no histórico (não a nova) — a nova só entra
      // no histórico na próxima troca, quando ela mesma for a "substituída".
      await tx.passwordHistory.create({
        data: { userId: session.user.id, passwordHash: user.password! },
      })
      // Poda: mantém só as últimas N entradas do usuário
      const stale = await tx.passwordHistory.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        skip: PASSWORD_HISTORY_LIMIT,
        select: { id: true },
      })
      if (stale.length) {
        await tx.passwordHistory.deleteMany({ where: { id: { in: stale.map(s => s.id) } } })
      }
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CHANGE_PASSWORD',
        resource: 'user',
        resourceId: session.user.id,
        details: { method: 'self-service' },
      },
    })

    return NextResponse.json({ success: true, message: 'Senha alterada com sucesso.' })
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return NextResponse.json({ error: err.errors[0]?.message || 'Dados inválidos' }, { status: 400 })
    }
    console.error('[CHANGE_PASSWORD]', err)
    return NextResponse.json({ error: 'Erro interno ao alterar senha.' }, { status: 500 })
  }
}
