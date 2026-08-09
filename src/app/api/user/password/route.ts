import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { authLimiter } from '@/lib/rate-limit'

// PATCH /api/user/password
export async function PATCH(req: NextRequest) {
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

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }
  const { currentPassword, newPassword } = body

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: 'A nova senha deve ter pelo menos 8 caracteres' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  })

  // If user has a password, verify current one
  if (user?.password) {
    if (!currentPassword) {
      return NextResponse.json({ error: 'Senha atual obrigatória' }, { status: 400 })
    }
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
    }
  }

  const hashed = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashed },
  })

  return NextResponse.json({ success: true })
}
