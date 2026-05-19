import type {
  User, Patient, Medication, PRMAnalysis, PRMFinding,
  KnowledgeBase, TokenPackage, TokenTransaction, SOAPRecord, Report,
  UserRole, PlanType, PRMCategory, RiskLevel, AnalysisStatus,
  Sex, RouteOfAdministration, AdherenceLevel, KnowledgeType, KnowledgeStatus
} from '@prisma/client'

export type {
  User, Patient, Medication, PRMAnalysis, PRMFinding,
  KnowledgeBase, TokenPackage, TokenTransaction, SOAPRecord, Report,
  UserRole, PlanType, PRMCategory, RiskLevel, AnalysisStatus,
  Sex, RouteOfAdministration, AdherenceLevel, KnowledgeType, KnowledgeStatus
}

// ─── PRM Engine Types ────────────────────────────────────────────────────────

export interface PatientContext {
  id: string
  age?: number
  sex?: Sex | null
  weight?: number | null
  height?: number | null
  isPregnant: boolean
  gestationalAge?: number | null
  isLactating: boolean
  isElderly: boolean
  renalFunction?: string | null
  creatinineClearance?: number | null
  hepaticFunction?: string | null
  comorbidities: { name: string; icd10Code?: string | null }[]
  allergies: { substance: string; reaction?: string | null; severity?: string | null }[]
  diagnoses: { name: string; icd10Code?: string | null; isPrimary: boolean }[]
  labResults: { examName: string; value: string; unit?: string | null; isAbnormal: boolean }[]
  medications: MedicationContext[]
  chiefComplaint?: string | null
  clinicalHistory?: string | null
}

export interface MedicationContext {
  id: string
  tradeName?: string | null
  activeIngredient: string
  dose?: number | null
  doseUnit?: string | null
  pharmaceuticalForm?: string | null
  route: RouteOfAdministration
  frequency?: string | null
  frequencyHours?: number | null
  indication?: string | null
  isPrescribed: boolean
  isSelfMedication: boolean
  durationOfUse?: string | null
  adherence: AdherenceLevel
  adverseEffects?: string | null
}

export interface PRMFindingResult {
  category: PRMCategory
  riskLevel: RiskLevel
  title: string
  description: string
  clinicalEvidence: string
  potentialImpact: string
  pharmacistConduct: string
  patientGuidance: string
  needsReferral: boolean
  needsPrescriberContact: boolean
  monitoring?: string
  suggestedExams?: string
  reevaluationPeriod?: string
  confidenceLevel: 'high' | 'moderate' | 'low' | 'insufficient_data'
  validationNote: string
  interventionDeadline?: string
  medicationId?: string
}

export interface AnalysisResult {
  findings: PRMFindingResult[]
  summary: string
  totalPRMs: number
  urgentPRMs: number
  highRiskPRMs: number
  moderatePRMs: number
  lowRiskPRMs: number
  soapSuggestion: SOAPSuggestion
  dataQualityWarnings: string[]
}

export interface SOAPSuggestion {
  subjective: string
  objective: string
  assessment: string
  plan: string
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// ─── Dashboard Types ──────────────────────────────────────────────────────────

export interface DashboardStats {
  tokenBalance: number
  totalAnalyses: number
  recentPatients: PatientSummary[]
  pendingAlerts: number
  lastAnalysisAt?: Date
  plan: PlanType
}

export interface PatientSummary {
  id: string
  code: string
  name?: string
  age?: number
  lastAnalysis?: Date
  prmCount: number
  urgentPRMs: number
}

// ─── Token Costs Config ───────────────────────────────────────────────────────

export interface TokenCostConfig {
  basicAnalysis: number        // up to 3 meds
  completeAnalysis: number     // up to 10 meds
  advancedAnalysis: number     // with lab results
  generateReport: number
  reanalysis: number
  institutionalReport: number
}

export const DEFAULT_TOKEN_COSTS: TokenCostConfig = {
  basicAnalysis: 1,
  completeAnalysis: 3,
  advancedAnalysis: 5,
  generateReport: 2,
  reanalysis: 1,
  institutionalReport: 5,
}

// ─── Plan Limits ──────────────────────────────────────────────────────────────

export interface PlanLimits {
  freeAnalyses: number
  pdfExport: boolean
  historyMonths: number
  multiUser: boolean
  soapRecord: boolean
  institutionalReport: boolean
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  FREE: {
    freeAnalyses: 2,
    pdfExport: false,
    historyMonths: 1,
    multiUser: false,
    soapRecord: false,
    institutionalReport: false,
  },
  BASIC: {
    freeAnalyses: 0,
    pdfExport: true,
    historyMonths: 3,
    multiUser: false,
    soapRecord: false,
    institutionalReport: false,
  },
  PROFESSIONAL: {
    freeAnalyses: 0,
    pdfExport: true,
    historyMonths: 24,
    multiUser: false,
    soapRecord: true,
    institutionalReport: false,
  },
  INSTITUTIONAL: {
    freeAnalyses: 0,
    pdfExport: true,
    historyMonths: 60,
    multiUser: true,
    soapRecord: true,
    institutionalReport: true,
  },
}

// ─── Admin Stats ──────────────────────────────────────────────────────────────

export interface AdminStats {
  totalUsers: number
  activeUsers: number
  tokensSold: number
  tokensConsumed: number
  estimatedRevenue: number
  totalAnalyses: number
  totalReports: number
  topPackages: { name: string; count: number }[]
  topAlerts: { title: string; count: number }[]
  knowledgeBasePendingUpdate: number
}
