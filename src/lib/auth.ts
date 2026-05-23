import { NextAuthOptions, getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8 hours — saúde = dados sensíveis
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const identifier = credentials.email.toLowerCase().trim()

        const user = await prisma.user.findUnique({
          where: { email: identifier },
        })

        // SECURITY: executar bcrypt.compare sempre, mesmo quando usuário não existe,
        // para evitar timing attack que revelaria quais e-mails estão cadastrados
        const dummyHash = '$2b$12$LTqNvGDNlH6vFPSAcRnk3u8k2YVFXgDVGQVm2KLxNBw0KXNZJ9IqG'
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user?.password ?? dummyHash,
        )

        if (!user || !user.password || !isPasswordValid) return null
        if (!user.isActive) throw new Error('Conta desativada. Entre em contato com o suporte.')

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        // Audit log
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'LOGIN',
            resource: 'auth',
            details: { method: 'credentials' },
          },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
          tokenBalance: user.tokenBalance,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.plan = (user as any).plan
        token.tokenBalance = (user as any).tokenBalance
        token.image = (user as any).image ?? null
      }
      // Refresh token data on update trigger
      if (trigger === 'update' && session) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { tokenBalance: true, plan: true, role: true, name: true, image: true },
        })
        if (dbUser) {
          token.tokenBalance = dbUser.tokenBalance
          token.plan = dbUser.plan
          token.role = dbUser.role
          token.name = dbUser.name
          token.image = dbUser.image ?? null
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.plan = token.plan as string
        session.user.tokenBalance = token.tokenBalance as number
        if (token.image !== undefined) {
          session.user.image = token.image as string | null
        }
      }
      return session
    },
  },
}

export async function getSession() {
  return getServerSession(authOptions)
}

export async function getCurrentUser() {
  const session = await getSession()
  if (!session?.user?.id) return null

  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      plan: true,
      tokenBalance: true,
      crfNumber: true,
      specialization: true,
      institution: true,
      isActive: true,
      createdAt: true,
    },
  })
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export function isAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN
}

export function isManager(role: UserRole): boolean {
  return role === UserRole.INSTITUTIONAL_MANAGER || role === UserRole.ADMIN
}

// NextAuth type augmentation
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: UserRole
      plan: string
      tokenBalance: number
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
    plan: string
    tokenBalance: number
    image?: string | null
  }
}
