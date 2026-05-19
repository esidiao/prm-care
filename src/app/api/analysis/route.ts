import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { analyzePRM, getTokenCostForAnalysis } from '@/lib/prm-engine'
import { consumeTokens, hasEnoughTokens } from '@/lib/token-service'
import { AnalysisStatus, RouteOfAdministration, AdherenceLevel } from '@prisma/client'
import type { PatientContext } from '@/types'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = await req.json()
    const { patientId, medications, clinicalData } = body

    if (!patientId) return NextResponse.json({ error: 'Paciente obrigatório' }, { status: 400 })

    // Load patient
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, userId: session.user.id },
      include: { comorbidities: true, allergies: true, diagnoses: true, labResults: { orderBy: { collectedAt: 'desc' }, take: 20 } },
    })
    if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

    // Determine analysis type and cost
    const hasLabs = clinicalData?.labResults?.length > 0 || patient.labResults.length > 0
    const medCount = medications?.length ?? 0
    const { type: analysisType, cost: tokenCost } = getTokenCostForAnalysis(medCount, hasLabs)

    // Check token balance
    const sufficient = await hasEnoughTokens(session.user.id, tokenCost)
    if (!sufficient) {
      return NextResponse.json({
        error: `Saldo insuficiente. Você precisa de ${tokenCost} token(s) para esta análise.`,
        required: tokenCost,
      }, { status: 402 })
    }

    // Save medications to DB (upsert)
    const savedMeds = await Promise.all(
      (medications || []).map(async (med: any) => {
        return prisma.medication.create({
          data: {
            patientId,
            activeIngredient: med.activeIngredient,
            tradeName: med.tradeName || null,
            dose: med.dose ? parseFloat(med.dose) : null,
            doseUnit: med.doseUnit || null,
            pharmaceuticalForm: med.pharmaceuticalForm || null,
            route: (med.route as RouteOfAdministration) || RouteOfAdministration.ORAL,
            frequency: med.frequency || null,
            frequencyHours: med.frequencyHours ? parseInt(med.frequencyHours) : null,
            indication: med.indication || null,
            isPrescribed: med.isPrescribed ?? true,
            isSelfMedication: med.isSelfMedication ?? false,
            adherence: (med.adherence as AdherenceLevel) || AdherenceLevel.UNKNOWN,
            adverseEffects: med.adverseEffects || null,
          },
        })
      })
    )

    // Save lab results if new ones
    if (clinicalData?.labResults?.length > 0) {
      await prisma.labResult.createMany({
        data: clinicalData.labResults.map((lab: any) => ({
          patientId,
          examName: lab.examName,
          value: lab.value,
          unit: lab.unit || null,
          isAbnormal: lab.isAbnormal ?? false,
        })),
        skipDuplicates: true,
      })
    }

    // Update patient renal/hepatic if provided
    if (clinicalData?.renalFunction || clinicalData?.creatinineClearance || clinicalData?.hepaticFunction) {
      await prisma.patient.update({
        where: { id: patientId },
        data: {
          renalFunction: clinicalData.renalFunction || undefined,
          creatinineClearance: clinicalData.creatinineClearance || undefined,
          hepaticFunction: clinicalData.hepaticFunction || undefined,
        },
      })
    }

    // Build patient context for PRM engine
    const allLabResults = [
      ...patient.labResults,
      ...(clinicalData?.labResults || []),
    ]

    const patientContext: PatientContext = {
      id: patient.id,
      age: patient.age ?? undefined,
      sex: patient.sex,
      weight: patient.weight,
      height: patient.height,
      isPregnant: patient.isPregnant,
      gestationalAge: patient.gestationalAge,
      isLactating: patient.isLactating,
      isElderly: patient.isElderly,
      renalFunction: clinicalData?.renalFunction || patient.renalFunction,
      creatinineClearance: clinicalData?.creatinineClearance || patient.creatinineClearance,
      hepaticFunction: clinicalData?.hepaticFunction || patient.hepaticFunction,
      comorbidities: patient.comorbidities,
      allergies: patient.allergies,
      diagnoses: patient.diagnoses,
      labResults: allLabResults.map(l => ({
        examName: l.examName,
        value: l.value,
        unit: l.unit,
        isAbnormal: l.isAbnormal,
      })),
      medications: savedMeds.map(m => ({
        id: m.id,
        activeIngredient: m.activeIngredient,
        tradeName: m.tradeName,
        dose: m.dose,
        doseUnit: m.doseUnit,
        pharmaceuticalForm: m.pharmaceuticalForm,
        route: m.route,
        frequency: m.frequency,
        frequencyHours: m.frequencyHours,
        indication: m.indication,
        isPrescribed: m.isPrescribed,
        isSelfMedication: m.isSelfMedication,
        durationOfUse: m.durationOfUse,
        adherence: m.adherence,
        adverseEffects: m.adverseEffects,
      })),
    }

    // Run PRM engine
    const result = analyzePRM(patientContext)

    // Consume tokens
    const tokenOp = await consumeTokens(
      session.user.id,
      tokenCost,
      `Análise PRM (${analysisType}) — paciente ${patient.code}`,
    )
    if (!tokenOp.success) {
      return NextResponse.json({ error: tokenOp.error }, { status: 402 })
    }

    // Save analysis to DB
    const analysis = await prisma.pRMAnalysis.create({
      data: {
        userId: session.user.id,
        patientId,
        status: AnalysisStatus.COMPLETED,
        tokensConsumed: tokenCost,
        analysisType,
        totalPRMs: result.totalPRMs,
        urgentPRMs: result.urgentPRMs,
        highRiskPRMs: result.highRiskPRMs,
        moderatePRMs: result.moderatePRMs,
        lowRiskPRMs: result.lowRiskPRMs,
        summary: result.summary,
        completedAt: new Date(),
        findings: {
          create: result.findings.map(f => ({
            medicationId: f.medicationId || null,
            category: f.category,
            riskLevel: f.riskLevel,
            title: f.title,
            description: f.description,
            clinicalEvidence: f.clinicalEvidence,
            potentialImpact: f.potentialImpact,
            pharmacistConduct: f.pharmacistConduct,
            patientGuidance: f.patientGuidance,
            needsReferral: f.needsReferral,
            needsPrescriberContact: f.needsPrescriberContact,
            monitoring: f.monitoring || null,
            suggestedExams: f.suggestedExams || null,
            reevaluationPeriod: f.reevaluationPeriod || null,
            confidenceLevel: f.confidenceLevel,
            validationNote: f.validationNote,
            interventionDeadline: f.interventionDeadline || null,
          })),
        },
        soapRecord: {
          create: {
            patientId,
            subjective: result.soapSuggestion.subjective,
            objective: result.soapSuggestion.objective,
            assessment: result.soapSuggestion.assessment,
            plan: result.soapSuggestion.plan,
          },
        },
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_ANALYSIS',
        resource: 'prm_analysis',
        resourceId: analysis.id,
        details: { analysisType, tokenCost, totalPRMs: result.totalPRMs, urgentPRMs: result.urgentPRMs },
      },
    })

    // Update token transaction with reference
    await prisma.tokenTransaction.updateMany({
      where: {
        userId: session.user.id,
        referenceId: null,
        type: 'CONSUMPTION',
      },
      data: { referenceId: analysis.id },
    })

    return NextResponse.json({
      success: true,
      data: { id: analysis.id, totalPRMs: result.totalPRMs, urgentPRMs: result.urgentPRMs },
    }, { status: 201 })
  } catch (err: any) {
    console.error('[CREATE_ANALYSIS]', err)
    return NextResponse.json({ error: err.message || 'Erro interno ao processar análise.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const analyses = await prisma.pRMAnalysis.findMany({
    where: { userId: session.user.id },
    include: { patient: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return NextResponse.json({ success: true, data: analyses })
}
