import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { seedDefaultPackages } from '@/lib/seed-packages'

export async function GET() {
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
