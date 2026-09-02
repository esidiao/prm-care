/**
 * Popula o banco de TESTE com o mínimo para os fluxos rodarem (lacuna 20).
 *
 * ⚠️ RECUSA rodar contra qualquer banco que não seja local e com "teste" no nome.
 * Este script APAGA dados antes de semear; apontado para produção, destruiria
 * registro clínico. A guarda é a mesma de scripts/preparar-banco-teste.mjs, e
 * está aqui de novo de propósito — proteção que depende de o chamador lembrar
 * não é proteção.
 *
 * A senha de teste é fixa e pública por natureza: é credencial de um banco
 * descartável, não segredo. Nunca reaproveitar em outro ambiente.
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

export const CONTA_TESTE = {
  email: 'farmaceutico.teste@prmcare.local',
  senha: 'Teste@12345',
  nome: 'Ana Paula Souza',
  crf: 'CRF-GO 99999',
}

export const CONTA_ADMIN = {
  email: 'admin.teste@prmcare.local',
  senha: 'Teste@12345',
  nome: 'Administrador Teste',
}

function exigirBancoDeTeste(url: string | undefined): string {
  if (!url) throw new Error('DATABASE_URL não definida — aponte para o banco de teste.')
  const u = new URL(url)
  if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname)) {
    throw new Error(`RECUSADO: o seed só roda em localhost, e a URL aponta para "${u.hostname}".`)
  }
  if (!/teste|test/i.test(u.pathname)) {
    throw new Error(`RECUSADO: o banco "${u.pathname.slice(1)}" não tem "teste" no nome.`)
  }
  return url
}

export async function semear() {
  exigirBancoDeTeste(process.env.DATABASE_URL)
  const prisma = new PrismaClient()

  try {
    // Ordem importa: filhos antes dos pais, por causa das FKs.
    await prisma.adverseEventReport.deleteMany()
    await prisma.pRMFinding.deleteMany()
    await prisma.sOAPRecord.deleteMany()
    await prisma.pRMAnalysis.deleteMany()
    await prisma.medication.deleteMany()
    await prisma.patient.deleteMany()
    await prisma.auditLog.deleteMany()
    await prisma.refApresentacao.deleteMany()
    await prisma.user.deleteMany()

    const hash = await bcrypt.hash(CONTA_TESTE.senha, 10)

    const farmaceutico = await prisma.user.create({
      data: {
        email: CONTA_TESTE.email,
        password: hash,
        name: CONTA_TESTE.nome,
        crfNumber: CONTA_TESTE.crf,
        specialization: 'Farmácia Clínica',
        role: 'PROFESSIONAL',
        plan: 'INSTITUTIONAL',
        isActive: true,
        emailVerified: new Date(),
      },
    })

    await prisma.user.create({
      data: {
        email: CONTA_ADMIN.email,
        password: hash,
        name: CONTA_ADMIN.nome,
        role: 'ADMIN',
        plan: 'INSTITUTIONAL',
        isActive: true,
        emailVerified: new Date(),
      },
    })

    // Paciente com dose registrada: sem dose não há comparação de preço, e o
    // bloco de oportunidade não aparece — o teste ficaria verde por ausência.
    const paciente = await prisma.patient.create({
      data: {
        userId: farmaceutico.id,
        code: 'PT-0001',
        name: 'Maria da Silva Santos',
        sex: 'FEMALE',
        dateOfBirth: new Date('1958-04-12T00:00:00Z'),
        isActive: true,
        medications: {
          create: [
            { activeIngredient: 'Sinvastatina', dose: 20, doseUnit: 'mg', route: 'ORAL', isActive: true, isPrescribed: true },
            { activeIngredient: 'Varfarina', dose: 5, doseUnit: 'mg', route: 'ORAL', isActive: true, isPrescribed: true },
          ],
        },
      },
    })

    // Apresentações mínimas para a busca e a comparação de preço funcionarem.
    // Duas doses e faixas de preço distintas, para o teste distinguir sinal de
    // acaso: dentro de 20 MG há diferença real; 40 MG existe e não se mistura.
    await prisma.refApresentacao.createMany({
      data: [
        { ggrem: 'T001', substancia: 'SINVASTATINA', substanciaNorm: 'sinvastatina', produto: 'SINVASTATINA',
          apresentacao: '20 MG COM REV CT BL AL PLAS TRANS X 30', laboratorio: 'LAB GENERICO',
          tipoProduto: 'Genérico', tarja: 'Tarja Vermelha', classeTerapeutica: 'HIPOLIPEMIANTES',
          pmcSemImpostosCents: 1558, pfSemImpostosCents: 1100, restricaoHospitalar: false },
        { ggrem: 'T002', substancia: 'SINVASTATINA', substanciaNorm: 'sinvastatina', produto: 'SINVASMARCA',
          apresentacao: '20 MG COM REV CT BL AL PLAS TRANS X 30', laboratorio: 'LAB MARCA',
          tipoProduto: 'Referência', tarja: 'Tarja Vermelha', classeTerapeutica: 'HIPOLIPEMIANTES',
          pmcSemImpostosCents: 6083, pfSemImpostosCents: 4300, restricaoHospitalar: false },
        { ggrem: 'T003', substancia: 'SINVASTATINA', substanciaNorm: 'sinvastatina', produto: 'SINVASTATINA',
          apresentacao: '40 MG COM REV CT BL AL PLAS TRANS X 30', laboratorio: 'LAB GENERICO',
          tipoProduto: 'Genérico', tarja: 'Tarja Vermelha', classeTerapeutica: 'HIPOLIPEMIANTES',
          pmcSemImpostosCents: 3088, pfSemImpostosCents: 2200, restricaoHospitalar: false },
        // Associação: não pode aparecer como alternativa do monofármaco.
        { ggrem: 'T004', substancia: 'EZETIMIBA;SINVASTATINA', substanciaNorm: 'ezetimiba;sinvastatina',
          produto: 'EZE+SINVA', apresentacao: '10 MG + 20 MG COM CT BL AL PLAS X 30',
          laboratorio: 'LAB COMBO', tipoProduto: 'Referência', tarja: 'Tarja Vermelha',
          classeTerapeutica: 'HIPOLIPEMIANTES', pmcSemImpostosCents: 10908, restricaoHospitalar: false },
      ],
    })

    return { farmaceuticoId: farmaceutico.id, pacienteId: paciente.id }
  } finally {
    await prisma.$disconnect()
  }
}

// Execução direta: `npx tsx e2e/seed.ts`
if (process.argv[1]?.replace(/\\/g, '/').endsWith('e2e/seed.ts')) {
  semear()
    .then(r => console.log('Banco de teste semeado:', r))
    .catch(e => { console.error(e.message); process.exit(1) })
}
