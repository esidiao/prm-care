/**
 * Token Service — gerencia créditos, consumo e histórico de tokens
 */

import prisma from '@/lib/prisma'
import { TransactionType, PlanType } from '@prisma/client'

export interface TokenOperation {
  success: boolean
  newBalance: number
  error?: string
}

export async function getTokenBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenBalance: true },
  })
  return user?.tokenBalance ?? 0
}

const UNLIMITED_PLANS: string[] = ['INSTITUTIONAL', 'PROFESSIONAL']

export async function hasEnoughTokens(userId: string, required: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenBalance: true, plan: true },
  })
  if (!user) return false
  // Planos institucionais/profissionais ilimitados nunca bloqueiam por tokens
  if (UNLIMITED_PLANS.includes(user.plan)) return true
  return user.tokenBalance >= required
}

export async function consumeTokens(
  userId: string,
  amount: number,
  description: string,
  referenceId?: string
): Promise<TokenOperation> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { tokenBalance: true, plan: true },
    })

    if (!user) return { success: false, newBalance: 0, error: 'Usuário não encontrado.' }

    // Planos ilimitados: registra log mas não desconta saldo
    if (UNLIMITED_PLANS.includes(user.plan)) {
      await tx.tokenTransaction.create({
        data: {
          userId,
          type: TransactionType.CONSUMPTION,
          amount: 0,
          balanceBefore: user.tokenBalance,
          balanceAfter: user.tokenBalance,
          description: `[Ilimitado] ${description}`,
          referenceId,
        },
      })
      return { success: true, newBalance: user.tokenBalance }
    }

    if (user.tokenBalance < amount) {
      return {
        success: false,
        newBalance: user.tokenBalance,
        error: `Saldo insuficiente. Você tem ${user.tokenBalance} token(s) e esta operação requer ${amount}.`,
      }
    }

    const newBalance = user.tokenBalance - amount
    await tx.user.update({
      where: { id: userId },
      data: { tokenBalance: newBalance },
    })

    await tx.tokenTransaction.create({
      data: {
        userId,
        type: TransactionType.CONSUMPTION,
        amount: -amount,
        balanceBefore: user.tokenBalance,
        balanceAfter: newBalance,
        description,
        referenceId,
      },
    })

    return { success: true, newBalance }
  })
}

export async function addTokens(
  userId: string,
  amount: number,
  type: TransactionType,
  description: string,
  packageId?: string,
  paymentId?: string,
  referenceId?: string
): Promise<TokenOperation> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { tokenBalance: true },
    })

    if (!user) return { success: false, newBalance: 0, error: 'Usuário não encontrado.' }

    const newBalance = user.tokenBalance + amount
    await tx.user.update({
      where: { id: userId },
      data: { tokenBalance: newBalance },
    })

    await tx.tokenTransaction.create({
      data: {
        userId,
        packageId,
        type,
        amount,
        balanceBefore: user.tokenBalance,
        balanceAfter: newBalance,
        description,
        paymentId,
        referenceId,
      },
    })

    return { success: true, newBalance }
  })
}

export async function getTransactionHistory(
  userId: string,
  limit = 20,
  offset = 0
) {
  return prisma.tokenTransaction.findMany({
    where: { userId },
    include: { package: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  })
}

export async function grantDemonstrationTokens(userId: string): Promise<TokenOperation> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tokenBalance: true, demonstrationUsed: true, plan: true },
  })

  if (!user) return { success: false, newBalance: 0, error: 'Usuário não encontrado.' }
  if (user.demonstrationUsed >= 2) {
    return { success: false, newBalance: user.tokenBalance, error: 'Tokens de demonstração já utilizados.' }
  }
  if (user.plan !== PlanType.FREE) {
    return { success: false, newBalance: user.tokenBalance, error: 'Tokens de demonstração apenas para plano gratuito.' }
  }

  return prisma.$transaction(async (tx) => {
    const newBalance = user.tokenBalance + 5 // 5 demo tokens
    await tx.user.update({
      where: { id: userId },
      data: { tokenBalance: newBalance, demonstrationUsed: user.demonstrationUsed + 1 },
    })

    await tx.tokenTransaction.create({
      data: {
        userId,
        type: TransactionType.BONUS,
        amount: 5,
        balanceBefore: user.tokenBalance,
        balanceAfter: newBalance,
        description: 'Tokens de demonstração gratuitos — bem-vindo ao PRM Care!',
      },
    })

    return { success: true, newBalance }
  })
}

export async function getActivePackages() {
  return prisma.tokenPackage.findMany({
    where: { isActive: true },
    orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
  })
}

export async function checkLowBalanceAlert(userId: string): Promise<boolean> {
  const balance = await getTokenBalance(userId)
  return balance <= 3 // alert when 3 or fewer tokens remain
}

// System config helpers for dynamic token costs
export async function getTokenCost(key: string, defaultValue: number): Promise<number> {
  const config = await prisma.systemConfig.findUnique({ where: { key } })
  if (!config) return defaultValue
  const parsed = parseInt(config.value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

export const TOKEN_COST_KEYS = {
  basicAnalysis: 'token_cost_basic_analysis',
  completeAnalysis: 'token_cost_complete_analysis',
  advancedAnalysis: 'token_cost_advanced_analysis',
  generateReport: 'token_cost_generate_report',
  reanalysis: 'token_cost_reanalysis',
  institutionalReport: 'token_cost_institutional_report',
} as const
