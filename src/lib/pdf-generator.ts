/**
 * pdf-generator.ts
 * Gera relatórios PDF profissionais de análise PRM usando @react-pdf/renderer
 * Renderização server-side (Node.js) — sem dependências de browser
 */

import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

export interface PDFGeneratorInput {
  report: {
    id: string
    type: string
    isAnonymized: boolean
    generatedAt: Date
  }
  analysis: any
  patient: any
  findings: any[]
  soapRecord: any | null
  isAnonymized: boolean
  professionalName: string
  professionalCRF?: string
}

// ─── Paleta de cores ──────────────────────────────────────────────────────────

const COLORS = {
  primary:   '#1e3a5f',
  accent:    '#2563eb',
  urgent:    '#dc2626',
  high:      '#ea580c',
  moderate:  '#d97706',
  low:       '#16a34a',
  gray50:    '#f9fafb',
  gray100:   '#f3f4f6',
  gray200:   '#e5e7eb',
  gray400:   '#9ca3af',
  gray500:   '#6b7280',
  gray700:   '#374151',
  gray900:   '#111827',
  white:     '#ffffff',
  red50:     '#fef2f2',
  orange50:  '#fff7ed',
  yellow50:  '#fffbeb',
  green50:   '#f0fdf4',
}

const RISK_COLORS: Record<string, string> = {
  URGENT:   COLORS.urgent,
  HIGH:     COLORS.high,
  MODERATE: COLORS.moderate,
  LOW:      COLORS.low,
}

const RISK_BG: Record<string, string> = {
  URGENT:   COLORS.red50,
  HIGH:     COLORS.orange50,
  MODERATE: COLORS.yellow50,
  LOW:      COLORS.green50,
}

const RISK_LABELS: Record<string, string> = {
  URGENT:   'URGENTE',
  HIGH:     'ALTO',
  MODERATE: 'MODERADO',
  LOW:      'BAIXO',
}

const CATEGORY_LABELS: Record<string, string> = {
  NECESSITY:     'Necessidade',
  EFFECTIVENESS: 'Efetividade',
  SAFETY:        'Segurança',
  ADHERENCE:     'Adesão',
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  SIMPLE:        'Resumo de Achados',
  COMPLETE:      'Relatório Completo',
  SOAP:          'Registro SOAP',
  INSTITUTIONAL: 'Relatório Institucional',
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: COLORS.gray900,
    backgroundColor: COLORS.white,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  headerLeft: { flex: 1 },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.primary,
    marginBottom: 2,
  },
  headerSubtitle: { fontSize: 8, color: COLORS.gray500 },
  headerRight: { alignItems: 'flex-end' },
  headerBadge: {
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 4,
  },
  headerMeta: { fontSize: 7, color: COLORS.gray500, textAlign: 'right' },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  footerText: { fontSize: 7, color: COLORS.gray400 },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.primary,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  card: { backgroundColor: COLORS.gray50, borderRadius: 4, padding: 10, marginBottom: 6 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  infoItem: { width: '33%', marginBottom: 8, paddingRight: 6 },
  infoLabel: { fontSize: 7, color: COLORS.gray500, marginBottom: 1 },
  infoValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: COLORS.gray900 },
  statsRow: { flexDirection: 'row', marginBottom: 14 },
  statBox: {
    flex: 1,
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 6,
  },
  statNumber: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  statLabel: { fontSize: 6, color: COLORS.gray500, textAlign: 'center' },
  findingCard: {
    borderRadius: 4,
    marginBottom: 8,
    padding: 10,
    borderLeftWidth: 3,
    position: 'relative',
  },
  findingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  findingTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    flex: 1,
    marginRight: 8,
  },
  findingBadge: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    color: COLORS.white,
  },
  findingCategoryBadge: {
    fontSize: 6,
    color: COLORS.gray500,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  findingField: { marginBottom: 5 },
  findingFieldLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.gray700,
    marginBottom: 1,
  },
  findingFieldValue: { fontSize: 8, color: COLORS.gray700, lineHeight: 1.4 },
  table: { marginBottom: 6 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.gray100,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 3,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  tableCell: { fontSize: 8, color: COLORS.gray700, flex: 1 },
  tableCellHeader: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: COLORS.gray500, flex: 1 },
  soapBlock: {
    marginBottom: 8,
    padding: 10,
    backgroundColor: COLORS.gray50,
    borderRadius: 4,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.accent,
  },
  soapLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: COLORS.accent, marginBottom: 4 },
  soapText: { fontSize: 8, color: COLORS.gray700, lineHeight: 1.5 },
  tag: {
    backgroundColor: COLORS.gray100,
    fontSize: 7,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 4,
    marginBottom: 3,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  disclaimer: {
    marginTop: 14,
    padding: 10,
    backgroundColor: COLORS.gray50,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  disclaimerText: { fontSize: 7, color: COLORS.gray500, lineHeight: 1.4, textAlign: 'justify' },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  resolvedNote: {
    marginTop: 6,
    padding: 5,
    backgroundColor: COLORS.green50,
    borderRadius: 3,
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: Date | string | null | undefined, withTime = false): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return withTime
    ? d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function clean(str: string | null | undefined): string {
  return str?.replace(/\*\*/g, '').replace(/\*/g, '').trim() || '—'
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function el(type: any, props: any, ...children: any[]) {
  return React.createElement(type, props, ...children.filter(c => c !== null && c !== undefined && c !== false))
}

function PageHeader({ type, reportId, generatedAt, professionalName, professionalCRF }: any) {
  return el(View, { style: s.header },
    el(View, { style: s.headerLeft },
      el(Text, { style: s.headerTitle }, 'Relatório PRM'),
      el(Text, { style: s.headerSubtitle }, REPORT_TYPE_LABELS[type] || type),
    ),
    el(View, { style: s.headerRight },
      el(Text, { style: s.headerBadge }, 'FARMÁCIA CLÍNICA'),
      el(Text, { style: s.headerMeta }, `Gerado: ${fmt(generatedAt, true)}`),
      el(Text, { style: s.headerMeta }, `Por: ${professionalName}`),
      professionalCRF ? el(Text, { style: s.headerMeta }, `CRF: ${professionalCRF}`) : null,
      el(Text, { style: s.headerMeta }, `ID: ${reportId.slice(0, 8)}`),
    ),
  )
}

function StatsRow({ findings }: { findings: any[] }) {
  const counts = {
    total:    findings.length,
    urgent:   findings.filter(f => f.riskLevel === 'URGENT').length,
    high:     findings.filter(f => f.riskLevel === 'HIGH').length,
    moderate: findings.filter(f => f.riskLevel === 'MODERATE').length,
    resolved: findings.filter(f => f.isResolved).length,
  }
  const stats = [
    { label: 'Total PRMs',  value: counts.total,    color: COLORS.primary,  bg: '#eff6ff', border: '#bfdbfe' },
    { label: 'Urgentes',    value: counts.urgent,   color: COLORS.urgent,   bg: COLORS.red50,    border: '#fecaca' },
    { label: 'Alto risco',  value: counts.high,     color: COLORS.high,     bg: COLORS.orange50, border: '#fed7aa' },
    { label: 'Moderados',   value: counts.moderate, color: COLORS.moderate, bg: COLORS.yellow50, border: '#fde68a' },
    { label: 'Resolvidos',  value: counts.resolved, color: COLORS.low,      bg: COLORS.green50,  border: '#bbf7d0' },
  ]
  return el(View, { style: s.statsRow },
    ...stats.map((stat, i) =>
      el(View, { key: i, style: { ...s.statBox, backgroundColor: stat.bg, borderColor: stat.border, marginRight: i < stats.length - 1 ? 6 : 0 } },
        el(Text, { style: { ...s.statNumber, color: stat.color } }, String(stat.value)),
        el(Text, { style: s.statLabel }, stat.label),
      )
    ),
  )
}

function PatientSection({ patient, isAnonymized }: any) {
  const name = isAnonymized ? patient.code : (patient.name || patient.code)
  const items = [
    ['Paciente', name],
    ['Código', patient.code],
    ['Sexo', patient.sex === 'MALE' ? 'Masculino' : patient.sex === 'FEMALE' ? 'Feminino' : '—'],
    ['Idade', patient.age ? `${patient.age} anos` : '—'],
    ['Peso', patient.weight ? `${patient.weight} kg` : '—'],
    ['Altura', patient.height ? `${patient.height} cm` : '—'],
    ['Gestante', patient.isPregnant ? 'Sim' : 'Não'],
    ['Lactante', patient.isLactating ? 'Sim' : 'Não'],
    ['Idoso ≥60', patient.isElderly ? 'Sim' : 'Não'],
    ['Função renal', patient.renalFunction || '—'],
    ['ClCr', patient.creatinineClearance ? `${patient.creatinineClearance} mL/min` : '—'],
    ['Função hepática', patient.hepaticFunction || '—'],
  ]
  return el(View, { style: s.section },
    el(Text, { style: s.sectionTitle }, '1. Dados do Paciente'),
    el(View, { style: s.card },
      el(View, { style: s.infoGrid },
        ...items.map(([label, value], i) =>
          el(View, { key: i, style: s.infoItem },
            el(Text, { style: s.infoLabel }, label),
            el(Text, { style: s.infoValue }, value || '—'),
          )
        ),
      ),
      // Diagnósticos
      patient.diagnoses?.length > 0 ? el(View, { style: { marginTop: 8 } },
        el(Text, { style: { ...s.infoLabel, marginBottom: 3 } }, 'DIAGNÓSTICOS'),
        el(View, { style: s.tagRow },
          ...patient.diagnoses.map((d: any, i: number) =>
            el(Text, { key: i, style: s.tag },
              `${d.isPrimary ? '● ' : '○ '}${d.name}${d.icd10Code ? ` (${d.icd10Code})` : ''}`
            )
          ),
        ),
      ) : null,
      // Comorbidades
      patient.comorbidities?.length > 0 ? el(View, { style: { marginTop: 6 } },
        el(Text, { style: { ...s.infoLabel, marginBottom: 3 } }, 'COMORBIDADES'),
        el(View, { style: s.tagRow },
          ...patient.comorbidities.map((c: any, i: number) =>
            el(Text, { key: i, style: s.tag }, c.name)
          ),
        ),
      ) : null,
      // Alergias
      patient.allergies?.length > 0 ? el(View, {
        style: { marginTop: 6, padding: 6, backgroundColor: '#fef2f2', borderRadius: 3 }
      },
        el(Text, { style: { ...s.infoLabel, color: COLORS.urgent, marginBottom: 3 } }, '⚠ ALERGIAS'),
        ...patient.allergies.map((a: any, i: number) =>
          el(Text, { key: i, style: { fontSize: 8, color: COLORS.urgent, marginBottom: 1 } },
            `• ${a.substance}${a.reaction ? ` — ${a.reaction}` : ''}${a.severity ? ` (${a.severity})` : ''}`
          )
        ),
      ) : null,
    ),
  )
}

function MedicationsSection({ medications }: { medications: any[] }) {
  if (!medications?.length) return null
  return el(View, { style: s.section },
    el(Text, { style: s.sectionTitle }, `2. Medicamentos em Uso (${medications.length})`),
    el(View, { style: s.table },
      el(View, { style: s.tableHeader },
        el(Text, { style: { ...s.tableCellHeader, flex: 2 } }, 'PRINCÍPIO ATIVO'),
        el(Text, { style: s.tableCellHeader }, 'DOSE'),
        el(Text, { style: s.tableCellHeader }, 'FREQUÊNCIA'),
        el(Text, { style: s.tableCellHeader }, 'VIA'),
        el(Text, { style: s.tableCellHeader }, 'ADESÃO'),
      ),
      ...medications.map((med, i) =>
        el(View, { key: i, style: { ...s.tableRow, backgroundColor: i % 2 === 0 ? COLORS.white : COLORS.gray50 } },
          el(View, { style: { flex: 2 } },
            el(Text, { style: { fontSize: 8, fontFamily: 'Helvetica-Bold' } }, med.activeIngredient || '—'),
            med.tradeName ? el(Text, { style: { fontSize: 7, color: COLORS.gray400 } }, med.tradeName) : null,
            med.indication ? el(Text, { style: { fontSize: 7, color: COLORS.gray500 } }, `Para: ${med.indication}`) : null,
          ),
          el(Text, { style: s.tableCell }, med.dose ? `${med.dose}${med.doseUnit || ''}` : '—'),
          el(Text, { style: s.tableCell }, med.frequency || '—'),
          el(Text, { style: s.tableCell }, med.route || '—'),
          el(Text, { style: {
            ...s.tableCell,
            color: med.adherence === 'POOR' ? COLORS.urgent : med.adherence === 'MODERATE' ? COLORS.moderate : COLORS.low
          } },
            med.adherence === 'POOR' ? 'Baixa' : med.adherence === 'MODERATE' ? 'Moderada' : 'Boa'
          ),
        )
      ),
    ),
  )
}

function FindingsSection({ findings, type, sectionNum }: { findings: any[]; type: string; sectionNum: number }) {
  if (type === 'SOAP') return null
  const isSimple = type === 'SIMPLE'
  const order = ['URGENT', 'HIGH', 'MODERATE', 'LOW']
  const sorted = [...findings].sort((a, b) => order.indexOf(a.riskLevel) - order.indexOf(b.riskLevel))

  return el(View, { style: s.section },
    el(Text, { style: s.sectionTitle }, `${sectionNum}. PRMs Identificados (${findings.length})`),
    ...sorted.map((f, i) =>
      el(View, { key: i, style: {
        ...s.findingCard,
        backgroundColor: RISK_BG[f.riskLevel] || COLORS.gray50,
        borderLeftColor: RISK_COLORS[f.riskLevel] || COLORS.gray400,
      }},
        el(View, { style: s.findingHeader },
          el(Text, { style: s.findingTitle }, clean(f.title)),
          el(Text, { style: { ...s.findingBadge, backgroundColor: RISK_COLORS[f.riskLevel] || COLORS.gray400 } },
            RISK_LABELS[f.riskLevel] || f.riskLevel
          ),
        ),
        el(View, { style: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 } },
          el(Text, { style: s.findingCategoryBadge }, CATEGORY_LABELS[f.category] || f.category),
          f.isResolved ? el(Text, { style: { fontSize: 7, color: COLORS.low, fontFamily: 'Helvetica-Bold', marginLeft: 6 } }, '✓ RESOLVIDO') : null,
        ),

        el(View, { style: s.findingField },
          el(Text, { style: s.findingFieldLabel }, 'Descrição'),
          el(Text, { style: s.findingFieldValue }, clean(f.description)),
        ),

        !isSimple && f.clinicalEvidence ? el(View, { style: s.findingField },
          el(Text, { style: s.findingFieldLabel }, 'Evidência clínica'),
          el(Text, { style: s.findingFieldValue }, clean(f.clinicalEvidence)),
        ) : null,

        f.pharmacistConduct ? el(View, { style: s.findingField },
          el(Text, { style: s.findingFieldLabel }, 'Conduta farmacêutica'),
          el(Text, { style: s.findingFieldValue }, clean(f.pharmacistConduct)),
        ) : null,

        !isSimple && f.patientGuidance ? el(View, { style: s.findingField },
          el(Text, { style: s.findingFieldLabel }, 'Orientação ao paciente'),
          el(Text, { style: s.findingFieldValue }, clean(f.patientGuidance)),
        ) : null,

        !isSimple && f.monitoring ? el(View, { style: s.findingField },
          el(Text, { style: s.findingFieldLabel }, 'Monitoramento'),
          el(Text, { style: s.findingFieldValue }, clean(f.monitoring)),
        ) : null,

        el(View, { style: { flexDirection: 'row', marginTop: 2 } },
          f.interventionDeadline ? el(View, { style: { marginRight: 16 } },
            el(Text, { style: s.findingFieldLabel }, 'Prazo'),
            el(Text, { style: s.findingFieldValue }, f.interventionDeadline),
          ) : null,
          f.reevaluationPeriod ? el(View, { style: { marginRight: 16 } },
            el(Text, { style: s.findingFieldLabel }, 'Reavaliação'),
            el(Text, { style: s.findingFieldValue }, f.reevaluationPeriod),
          ) : null,
          el(View, {},
            el(Text, { style: s.findingFieldLabel }, 'Contato prescritor'),
            el(Text, { style: s.findingFieldValue }, f.needsPrescriberContact ? 'Sim' : 'Não'),
          ),
        ),

        f.isResolved && f.resolvedNotes ? el(View, { style: s.resolvedNote },
          el(Text, { style: { ...s.findingFieldLabel, color: COLORS.low } }, 'Notas de resolução'),
          el(Text, { style: s.findingFieldValue }, clean(f.resolvedNotes)),
        ) : null,
      )
    ),
  )
}

function SOAPSection({ soapRecord, sectionNum }: { soapRecord: any; sectionNum: number }) {
  if (!soapRecord) return null
  const blocks = [
    { label: 'S — Subjetivo', text: soapRecord.subjective },
    { label: 'O — Objetivo',  text: soapRecord.objective },
    { label: 'A — Avaliação', text: soapRecord.assessment },
    { label: 'P — Plano',     text: soapRecord.plan },
  ]
  return el(View, { style: s.section },
    el(Text, { style: s.sectionTitle }, `${sectionNum}. Registro SOAP`),
    ...blocks.map((b, i) =>
      el(View, { key: i, style: s.soapBlock },
        el(Text, { style: s.soapLabel }, b.label),
        el(Text, { style: s.soapText }, clean(b.text)),
      )
    ),
  )
}

function Disclaimer() {
  return el(View, { style: s.disclaimer },
    el(Text, { style: s.disclaimerText },
      'AVISO LEGAL: Este relatório foi gerado com suporte de sistema de análise farmacêutica e deve ser interpretado ' +
      'por profissional habilitado. Os achados representam potenciais problemas relacionados a medicamentos (PRMs) e não ' +
      'substituem a avaliação clínica individualizada. A conduta final é responsabilidade exclusiva do farmacêutico e/ou ' +
      'equipe de saúde. Documento confidencial — uso restrito à equipe de saúde. Resolução CFF vigente.'
    ),
  )
}

function Footer() {
  return el(View, { style: s.footer, fixed: true },
    el(Text, { style: s.footerText }, 'PharmaCare · Farmácia Clínica · Documento confidencial'),
    el(Text, { style: s.footerText, render: ({ pageNumber, totalPages }: any) => `Pág. ${pageNumber} / ${totalPages}` }),
  )
}

// ─── Exportação ───────────────────────────────────────────────────────────────

export async function generateReportPDF(input: PDFGeneratorInput): Promise<Buffer> {
  // Renderizar o Document diretamente sem wrapper intermediário
  const { report, patient, findings, soapRecord, isAnonymized, professionalName, professionalCRF } = input

  const isSoapOnly = report.type === 'SOAP'
  const showMeds   = report.type !== 'SIMPLE'
  const showSOAP   = !!soapRecord

  let sectionCounter = 1
  const patientSec  = sectionCounter++
  const medSec      = showMeds ? sectionCounter++ : 0
  const findingsSec = !isSoapOnly ? sectionCounter++ : 0
  const soapSec     = showSOAP ? sectionCounter++ : 0

  const doc = el(Document, {
    title: `Relatório PRM — ${patient.code}`,
    author: professionalName,
    subject: 'Farmácia Clínica — Análise de PRMs',
    creator: 'PharmaCare',
  },
    el(Page, { size: 'A4', style: s.page },
      el(PageHeader, { type: report.type, reportId: report.id, generatedAt: report.generatedAt, professionalName, professionalCRF }),
      el(StatsRow, { findings }),
      el(PatientSection, { patient, isAnonymized }),
      showMeds ? el(MedicationsSection, { medications: patient.medications || [] }) : null,
      !isSoapOnly ? el(FindingsSection, { findings, type: report.type, sectionNum: findingsSec }) : null,
      showSOAP ? el(SOAPSection, { soapRecord, sectionNum: soapSec }) : null,
      el(Disclaimer, {}),
      el(Footer, {}),
    )
  )

  const buf = await renderToBuffer(doc as any)
  return Buffer.from(buf)
}
