/**
 * PRM Care — Seed de dados demonstrativos
 * Execute: npx tsx prisma/seed.ts
 */

import { PrismaClient, UserRole, PlanType, KnowledgeType, KnowledgeStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do PRM Care...')

  // ─── Admin user ─────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@123456', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@prmcare.com.br' },
    update: {},
    create: {
      name: 'Administrador PRM Care',
      email: 'admin@prmcare.com.br',
      password: adminPassword,
      role: UserRole.ADMIN,
      plan: PlanType.PROFESSIONAL,
      tokenBalance: 999,
    },
  })
  console.log('✅ Admin criado:', admin.email)

  // ─── Demo professional user ──────────────────────────────────────────────────
  const profPassword = await bcrypt.hash('Demo@123456', 12)
  const professional = await prisma.user.upsert({
    where: { email: 'farmaceutico@demo.com' },
    update: {},
    create: {
      name: 'Dra. Ana Paula Souza',
      email: 'farmaceutico@demo.com',
      password: profPassword,
      role: UserRole.PROFESSIONAL,
      plan: PlanType.PROFESSIONAL,
      tokenBalance: 50,
      crfNumber: 'CRF/SP 12345',
      specialization: 'Farmácia Clínica',
    },
  })
  console.log('✅ Farmacêutico demo criado:', professional.email)

  // ─── Token packages ──────────────────────────────────────────────────────────
  await prisma.tokenPackage.deleteMany()
  await prisma.tokenPackage.createMany({
    data: [
      { name: 'Inicial', description: '10 análises básicas', tokens: 10, priceInCents: 2990, sortOrder: 1 },
      { name: 'Essencial', description: 'Para uso regular', tokens: 30, priceInCents: 6990, isFeatured: true, sortOrder: 2 },
      { name: 'Profissional', description: 'Ideal para clínicas', tokens: 100, priceInCents: 18990, sortOrder: 3 },
      { name: 'Clínica', description: 'Para equipes e instituições', tokens: 300, priceInCents: 47990, sortOrder: 4 },
    ],
  })
  console.log('✅ Pacotes de tokens criados')

  // ─── System config (token costs) ─────────────────────────────────────────────
  const configs = [
    { key: 'token_cost_basic_analysis', value: '1', description: 'Custo de análise básica (até 3 medicamentos)' },
    { key: 'token_cost_complete_analysis', value: '3', description: 'Custo de análise completa (até 10 medicamentos)' },
    { key: 'token_cost_advanced_analysis', value: '5', description: 'Custo de análise avançada (com exames laboratoriais)' },
    { key: 'token_cost_generate_report', value: '2', description: 'Custo de geração de relatório PDF' },
    { key: 'token_cost_reanalysis', value: '1', description: 'Custo de reanálise após atualização' },
    { key: 'token_cost_institutional_report', value: '5', description: 'Custo de relatório institucional' },
  ]
  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    })
  }
  console.log('✅ Configurações de sistema criadas')

  // ─── Demo patient ─────────────────────────────────────────────────────────────
  const patient = await prisma.patient.upsert({
    where: { userId_code: { userId: professional.id, code: 'PAC-DEMO-001' } },
    update: {},
    create: {
      userId: professional.id,
      code: 'PAC-DEMO-001',
      name: 'João da Silva (Demo)',
      age: 68,
      sex: 'MALE',
      weight: 82,
      height: 172,
      bmi: 27.7,
      isElderly: true,
      isPregnant: false,
      isLactating: false,
      renalFunction: 'mild_impairment',
      creatinineClearance: 58,
      hepaticFunction: 'normal',
      chiefComplaint: 'Controle de glicemia e pressão arterial. Refere tonturas frequentes.',
      clinicalHistory: 'Hipertensão arterial há 10 anos. Diabetes mellitus tipo 2 há 5 anos. Dislipidemia.',
      comorbidities: {
        createMany: {
          data: [
            { name: 'Hipertensão arterial sistêmica', icd10Code: 'I10' },
            { name: 'Diabetes mellitus tipo 2', icd10Code: 'E11' },
            { name: 'Dislipidemia', icd10Code: 'E78' },
          ],
        },
      },
      diagnoses: {
        createMany: {
          data: [
            { name: 'Hipertensão arterial sistêmica', icd10Code: 'I10', isPrimary: true },
            { name: 'Diabetes mellitus tipo 2', icd10Code: 'E11', isPrimary: false },
          ],
        },
      },
      labResults: {
        createMany: {
          data: [
            { examName: 'HbA1c', value: '8.2', unit: '%', referenceMin: 4, referenceMax: 5.7, isAbnormal: true },
            { examName: 'Glicemia de jejum', value: '165', unit: 'mg/dL', referenceMin: 70, referenceMax: 99, isAbnormal: true },
            { examName: 'Creatinina', value: '1.4', unit: 'mg/dL', referenceMin: 0.6, referenceMax: 1.2, isAbnormal: true },
            { examName: 'Potássio', value: '5.2', unit: 'mEq/L', referenceMin: 3.5, referenceMax: 5.0, isAbnormal: true },
            { examName: 'LDL-colesterol', value: '142', unit: 'mg/dL', referenceMin: 0, referenceMax: 100, isAbnormal: true },
          ],
        },
      },
    },
  })

  // Medications for demo patient
  await prisma.medication.deleteMany({ where: { patientId: patient.id } })
  await prisma.medication.createMany({
    data: [
      {
        patientId: patient.id,
        activeIngredient: 'metformina',
        tradeName: 'Glifage',
        dose: 850,
        doseUnit: 'mg',
        pharmaceuticalForm: 'Comprimido',
        route: 'ORAL',
        frequency: '2x ao dia',
        frequencyHours: 12,
        indication: 'Diabetes mellitus tipo 2',
        isPrescribed: true,
        isSelfMedication: false,
        adherence: 'MODERATE',
      },
      {
        patientId: patient.id,
        activeIngredient: 'enalapril',
        tradeName: 'Renitec',
        dose: 10,
        doseUnit: 'mg',
        pharmaceuticalForm: 'Comprimido',
        route: 'ORAL',
        frequency: '1x ao dia',
        frequencyHours: 24,
        indication: 'Hipertensão arterial',
        isPrescribed: true,
        isSelfMedication: false,
        adherence: 'GOOD',
      },
      {
        patientId: patient.id,
        activeIngredient: 'espironolactona',
        dose: 25,
        doseUnit: 'mg',
        pharmaceuticalForm: 'Comprimido',
        route: 'ORAL',
        frequency: '1x ao dia',
        indication: 'Hipertensão arterial resistente',
        isPrescribed: true,
        isSelfMedication: false,
        adherence: 'GOOD',
      },
      {
        patientId: patient.id,
        activeIngredient: 'sinvastatina',
        tradeName: 'Zocor',
        dose: 40,
        doseUnit: 'mg',
        pharmaceuticalForm: 'Comprimido',
        route: 'ORAL',
        frequency: '1x ao dia',
        indication: 'Dislipidemia',
        isPrescribed: true,
        isSelfMedication: false,
        adherence: 'POOR',
        adverseEffects: 'Refere dores musculares ocasionais. Custo elevado, dificuldade de acesso.',
      },
      {
        patientId: patient.id,
        activeIngredient: 'diazepam',
        dose: 5,
        doseUnit: 'mg',
        pharmaceuticalForm: 'Comprimido',
        route: 'ORAL',
        frequency: '1x ao dia',
        indication: 'Ansiedade',
        isPrescribed: true,
        isSelfMedication: false,
        adherence: 'GOOD',
      },
      {
        patientId: patient.id,
        activeIngredient: 'ibuprofeno',
        dose: 600,
        doseUnit: 'mg',
        pharmaceuticalForm: 'Comprimido',
        route: 'ORAL',
        frequency: 'Conforme necessário',
        indication: '',
        isPrescribed: false,
        isSelfMedication: true,
        adherence: 'UNKNOWN',
        adverseEffects: 'Usa para dores nas articulações sem orientação médica.',
      },
    ],
  })
  console.log('✅ Paciente demo criado:', patient.code)

  // ─── Knowledge base entries ────────────────────────────────────────────────
  await prisma.knowledgeBase.deleteMany()
  await prisma.knowledgeBase.createMany({
    data: [
      {
        title: 'Interação: IECA + Diuréticos poupadores de potássio — risco de hipercalemia',
        type: KnowledgeType.INTERACTION,
        content: 'A combinação de inibidores da ECA com diuréticos poupadores de potássio (espironolactona, amilorida, triantereno) pode resultar em hipercalemia clinicamente significativa, especialmente em pacientes com insuficiência renal ou diabetes.',
        source: 'Micromedex Drug Interactions',
        status: KnowledgeStatus.VALIDATED,
        drugNames: ['enalapril', 'captopril', 'lisinopril', 'espironolactona', 'amilorida'],
        tags: ['hipercalemia', 'IECA', 'diurético', 'interação'],
        createdById: admin.id,
        validatedBy: 'admin@prmcare.com.br',
        validatedAt: new Date(),
        lastReviewedAt: new Date(),
      },
      {
        title: 'Critérios de Beers: Benzodiazepínicos em idosos',
        type: KnowledgeType.GUIDELINE,
        content: 'A American Geriatrics Society recomenda evitar o uso de benzodiazepínicos em idosos (≥65 anos) pelo risco aumentado de sedação, comprometimento cognitivo, delírio, quedas, fraturas e acidentes automobilísticos.',
        source: 'American Geriatrics Society Beers Criteria 2023',
        sourceUrl: 'https://agsjournals.onlinelibrary.wiley.com/doi/10.1111/jgs.18372',
        status: KnowledgeStatus.VALIDATED,
        drugNames: ['diazepam', 'alprazolam', 'clonazepam', 'lorazepam', 'zolpidem'],
        tags: ['critérios de beers', 'idoso', 'benzodiazepínico', 'quedas', 'delirium'],
        createdById: admin.id,
        validatedBy: 'admin@prmcare.com.br',
        validatedAt: new Date(),
        lastReviewedAt: new Date(),
      },
      {
        title: 'Metformina: contraindicação em disfunção renal grave',
        type: KnowledgeType.CONTRAINDICATION,
        content: 'A metformina é contraindicada em pacientes com TFG < 30 mL/min/1,73m² pelo risco de acidose lática. Deve ser utilizada com cautela em pacientes com TFG entre 30-45 mL/min/1,73m².',
        source: 'ANVISA — Bula Metformina / FDA Drug Label',
        status: KnowledgeStatus.VALIDATED,
        drugNames: ['metformina'],
        icd10Codes: ['N18'],
        tags: ['metformina', 'insuficiência renal', 'acidose lática', 'diabetes'],
        createdById: admin.id,
        validatedBy: 'admin@prmcare.com.br',
        validatedAt: new Date(),
        lastReviewedAt: new Date(),
      },
      {
        title: 'Sinvastatina: dose máxima com amiodarona — risco de miopatia',
        type: KnowledgeType.INTERACTION,
        content: 'Amiodarona inibe o CYP3A4, aumentando a concentração plasmática de sinvastatina. A dose máxima de sinvastatina com amiodarona é de 20 mg/dia. Doses maiores aumentam significativamente o risco de miopatia e rabdomiólise.',
        source: 'FDA Drug Safety Communication — Simvastatin Drug Interactions',
        sourceUrl: 'https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-new-restrictions-contraindications-and-dose-limitations-zocor',
        status: KnowledgeStatus.VALIDATED,
        drugNames: ['sinvastatina', 'amiodarona'],
        tags: ['sinvastatina', 'amiodarona', 'miopatia', 'rabdomiólise', 'CYP3A4'],
        createdById: admin.id,
        validatedBy: 'admin@prmcare.com.br',
        validatedAt: new Date(),
        lastReviewedAt: new Date(),
      },
      {
        title: 'AINEs em idosos: risco gastrointestinal e cardiovascular aumentado',
        type: KnowledgeType.ADVERSE_REACTION,
        content: 'Anti-inflamatórios não esteroidais aumentam significativamente o risco de sangramento gastrointestinal, insuficiência renal aguda e eventos cardiovasculares em idosos. Prefira paracetamol para analgesia.',
        source: 'Critérios de Beers AGS 2023 / PCDT Ministério da Saúde',
        status: KnowledgeStatus.PENDING,
        drugNames: ['ibuprofeno', 'naproxeno', 'diclofenaco', 'celecoxibe'],
        tags: ['AINE', 'idoso', 'sangramento GI', 'cardiovascular', 'critérios de beers'],
        createdById: admin.id,
        lastReviewedAt: new Date(),
      },
    ],
  })
  console.log('✅ Base de conhecimento criada')

  // ─── Consent records for demo user ───────────────────────────────────────────
  await prisma.consentRecord.createMany({
    data: [
      { userId: professional.id, type: 'TERMS_OF_USE', version: '1.0', accepted: true, ipAddress: '127.0.0.1' },
      { userId: professional.id, type: 'PRIVACY_POLICY', version: '1.0', accepted: true, ipAddress: '127.0.0.1' },
      { userId: professional.id, type: 'CLINICAL_DISCLAIMER', version: '1.0', accepted: true, ipAddress: '127.0.0.1' },
    ],
    skipDuplicates: true,
  })

  // Token transactions for demo user
  await prisma.tokenTransaction.createMany({
    data: [
      { userId: professional.id, type: 'BONUS', amount: 5, balanceBefore: 0, balanceAfter: 5, description: 'Tokens de boas-vindas' },
      { userId: professional.id, type: 'PURCHASE', amount: 50, balanceBefore: 5, balanceAfter: 55, description: 'Compra pacote Essencial' },
      { userId: professional.id, type: 'CONSUMPTION', amount: -3, balanceBefore: 55, balanceAfter: 52, description: 'Análise completa — PAC-DEMO-001' },
      { userId: professional.id, type: 'CONSUMPTION', amount: -2, balanceBefore: 52, balanceAfter: 50, description: 'Relatório PDF — PAC-DEMO-001' },
    ],
    skipDuplicates: true,
  })
  console.log('✅ Transações de tokens criadas')

  console.log('\n🎉 Seed concluído com sucesso!')
  console.log('\n📋 Credenciais de acesso:')
  console.log('   Admin:       admin@prmcare.com.br / Admin@123456')
  console.log('   Profissional: farmaceutico@demo.com / Demo@123456')
}

main()
  .catch(e => { console.error('❌ Erro no seed:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
