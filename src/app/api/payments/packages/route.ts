import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { seedDefaultPackages } from '@/lib/seed-packages'

export async function GET() {
  // Único chamador é /tokens (dashboard autenticado). Sem a sessão, um GET
  // anônimo chegava a disparar seedDefaultPackages() — uma escrita no banco.
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    let packages = await prisma.tokenPackage.findMany({
      where: { isActive: true },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
    })

    if (packages.length === 0) {
      await seedDefaultPackages()
      packages = await prisma.tokenPackage.findMany({
        where: { isActive: true },
        orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
      })
    }

    return NextResponse.json({ success: true, data: packages })
  } catch (err) {
    console.error('[PAYMENTS_PACKAGES_GET]', err)
    return NextResponse.json({ error: 'Erro ao buscar pacotes.' }, { status: 500 })
  }
}
