import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const url = new URL(req.url)
  const page = parseInt(url.searchParams.get('page') ?? '1')
  const perPage = 20
  const skip = (page - 1) * perPage

  const [
    totalRevenue,
    revenueThisMonth,
    revenueThisWeek,
    totalPayments,
    paymentsThisMonth,
    pendingPayments,
    tokensSold,
    tokensConsumed,
    tokensThisMonth,
    recentPayments,
    totalPaymentsCount,
    topPackages,
    dailyRevenueLast30d,
  ] = await Promise.all([
    // Receita total aprovada
    prisma.payment.aggregate({
      where: { status: 'completed' },
      _sum: { amountInCents: true },
    }),
    // Receita mês atual
    prisma.payment.aggregate({
      where: { status: 'completed', paidAt: { gte: thirtyDaysAgo } },
      _sum: { amountInCents: true },
    }),
    // Receita semana
    prisma.payment.aggregate({
      where: { status: 'completed', paidAt: { gte: sevenDaysAgo } },
      _sum: { amountInCents: true },
    }),
    // Total de pagamentos aprovados
    prisma.payment.count({ where: { status: 'completed' } }),
    // Pagamentos este mês
    prisma.payment.count({ where: { status: 'completed', paidAt: { gte: thirtyDaysAgo } } }),
    // Pagamentos pendentes
    prisma.payment.count({ where: { status: 'pending' } }),
    // Tokens vendidos total
    prisma.tokenTransaction.aggregate({
      where: { type: 'PURCHASE' },
      _sum: { amount: true },
    }),
    // Tokens consumidos total
    prisma.tokenTransaction.aggregate({
      where: { type: 'CONSUMPTION' },
      _sum: { amount: true },
    }),
    // Tokens vendidos no mês
    prisma.tokenTransaction.aggregate({
      where: { type: 'PURCHASE', createdAt: { gte: thirtyDaysAgo } },
      _sum: { amount: true },
    }),
    // Pagamentos recentes (paginado)
    prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: perPage,
      select: {
        id: true,
        amountInCents: true,
        status: true,
        method: true,
        gateway: true,
        externalId: true,
        paidAt: true,
        createdAt: true,
        metadata: true,
        userId: true,
      },
    }),
    // Total de pagamentos para paginação
    prisma.payment.count(),
    // Top pacotes mais vendidos
    prisma.tokenTransaction.groupBy({
      by: ['packageId'],
      where: { type: 'PURCHASE', packageId: { not: null } },
      _count: { id: true },
      _sum: { amount: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
    // Receita diária últimos 30 dias
    prisma.payment.findMany({
      where: { status: 'completed', paidAt: { gte: thirtyDaysAgo } },
      select: { amountInCents: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    }),
  ])

  // Enriquecer pagamentos com dados do usuário
  const userIds = Array.from(new Set(recentPayments.map(p => p.userId).filter(Boolean) as string[]))
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const userMap = Object.fromEntries(users.map(u => [u.id, u]))

  // Enriquecer com nome do pacote
  const packageIds = Array.from(new Set(topPackages.map(p => p.packageId).filter(Boolean) as string[]))
  const pkgs = packageIds.length > 0
    ? await prisma.tokenPackage.findMany({
        where: { id: { in: packageIds } },
        select: { id: true, name: true, tokens: true, priceInCents: true },
      })
    : []
  const pkgMap = Object.fromEntries(pkgs.map(p => [p.id, p]))

  // Agrupar receita por dia
  const dailyMap: Record<string, number> = {}
  for (const p of dailyRevenueLast30d) {
    if (!p.paidAt) continue
    const day = p.paidAt.toISOString().slice(0, 10)
    dailyMap[day] = (dailyMap[day] ?? 0) + p.amountInCents
  }

  return NextResponse.json({
    summary: {
      totalRevenueCents: totalRevenue._sum.amountInCents ?? 0,
      revenueThisMonthCents: revenueThisMonth._sum.amountInCents ?? 0,
      revenueThisWeekCents: revenueThisWeek._sum.amountInCents ?? 0,
      totalPayments,
      paymentsThisMonth,
      pendingPayments,
      tokensSold: tokensSold._sum.amount ?? 0,
      tokensConsumed: Math.abs(tokensConsumed._sum.amount ?? 0),
      tokensThisMonth: tokensThisMonth._sum.amount ?? 0,
    },
    recentPayments: recentPayments.map(p => ({
      ...p,
      user: p.userId ? (userMap[p.userId] ?? null) : null,
    })),
    totalPaymentsCount,
    currentPage: page,
    totalPages: Math.ceil(totalPaymentsCount / perPage),
    topPackages: topPackages.map(tp => ({
      ...tp,
      package: tp.packageId ? (pkgMap[tp.packageId] ?? null) : null,
    })),
    dailyRevenue: dailyMap,
  })
}
