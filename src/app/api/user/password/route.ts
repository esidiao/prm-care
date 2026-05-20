import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// PATCH /api/user/password
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json()

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
