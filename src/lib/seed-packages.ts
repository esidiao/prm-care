import prisma from '@/lib/prisma'

export const DEFAULT_PACKAGES = [
  {
    name: 'Starter',
    description: 'Ideal para experimentar a plataforma',
    tokens: 10,
    priceInCents: 2990,
    currency: 'BRL',
    isActive: true,
    isFeatured: false,
    sortOrder: 1,
  },
  {
    name: 'Básico',
    description: 'Para profissionais com uso moderado',
    tokens: 30,
    priceInCents: 6990,
    currency: 'BRL',
    isActive: true,
    isFeatured: false,
    sortOrder: 2,
  },
  {
    name: 'Profissional',
    description: 'Assinatura mensal com 50 tokens — melhor custo-benefício',
    tokens: 50,
    priceInCents: 9700,
    currency: 'BRL',
    isActive: true,
    isFeatured: true,
    sortOrder: 3,
  },
  {
    name: 'Institucional',
    description: 'Para clínicas e farmácias com alto volume',
    tokens: 200,
    priceInCents: 29700,
    currency: 'BRL',
    isActive: true,
    isFeatured: false,
    sortOrder: 4,
  },
]

export async function seedDefaultPackages() {
  const created = await prisma.$transaction(
    DEFAULT_PACKAGES.map((pkg) =>
      prisma.tokenPackage.upsert({
        where: {
          // upsert by name to avoid duplicates
          id: 'seed-' + pkg.name.toLowerCase().replace(/\s+/g, '-'),
        },
        update: {},
        create: {
          id: 'seed-' + pkg.name.toLowerCase().replace(/\s+/g, '-'),
          ...pkg,
        },
      })
    )
  )
  return created
}
