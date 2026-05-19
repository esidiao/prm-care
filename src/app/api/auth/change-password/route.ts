import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

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

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

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

    const newHash = await bcrypt.hash(body.newPassword, 12)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: newHash },
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
