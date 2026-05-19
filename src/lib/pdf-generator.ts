/**
 * PRM Care — Gerador de Relatório PDF
 * Usa @react-pdf/renderer para gerar relatórios clínicos estruturados.
 */

import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, Font,
  pdf, Image,
} from '@react-pdf/renderer'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { RiskLevel, PRMCategory } from '@prisma/client'

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: '#1f2937', padding: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#1e3a5f' },
  logo: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1e3a5f' },
  logoSub: { fontSize: 8, color: '#6b7280', marginTop: 2 },
  headerRight: { textAlign: 'right' },
  headerDate: { fontSize: 8, color: '#6b7280' },

  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1e3a5f', marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },

  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: '35%', color: '#6b7280', fontSize: 8 },
  value: { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 8 },

  table: { width: '100%' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#1e3a5f', padding: '4 6', marginBottom: 1 },
  tableHeaderCell: { color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 8, flex: 1 },
  tableRow: { flexDirection: 'row', padding: '3 6', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tableCell: { flex: 1, fontSize: 8 },

  findingBox: { marginBottom: 10, borderWidth: 1, borderRadius: 4, overflow: 'hidden' },
  findingHeader: { padding: '5 8', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  findingTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, flex: 1 },
  riskBadge: { fontSize: 7, fontFamily: 'Helvetica-Bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  findingBody: { padding: '6 8', backgroundColor: '#ffffff' },
  findingField: { marginBottom: 4 },
  findingFieldLabel: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#374151', marginBottom: 1 },
  findingFieldValue: { fontSize: 8, color: '#4b5563', lineHeight: 1.4 },

  soapBox: { marginBottom: 6, padding: '5 8', borderRadius: 4 },
  soapLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 3 },
  soapText: { fontSize: 8, lineHeight: 1.5 },

  disclaimer: { marginTop: 20, padding: 10, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fbbf24', borderRadius: 4 },
  disclaimerText: { fontSize: 7, color: '#92400e', lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: '#9ca3af', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6 },
})

// ─── Risk color map ──────────────────────────────────────────────────────────

const RISK_COLORS: Record<RiskLevel, { bg: string; text: string; badge: string }> = {
  LOW: { bg: '#f0fdf4', text: '#15803d', badge: '#dcfce7' },
  MODERATE: { bg: '#fefce8', text: '#854d0e', badge: '#fef9c3' },
  HIGH: { bg: '#fff7ed', text: '#c2410c', badge: '#ffedd5' },
  URGENT: { bg: '#fef2f2', text: '#b91c1c', badge: '#fee2e2' },
}
const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: 'Baixo Risco', MODERATE: 'Risco Moderado', HIGH: 'Alto Risco', URGENT: 'URGENTE',
}
const CATEGORY_LABELS: Record<PRMCategory, string> = {
  NECESSITY: 'Necessidade', EFFECTIVENESS: 'Efetividade', SAFETY: 'Segurança', ADHERENCE: 'Adesão',
}

// ─── Document Component ──────────────────────────────────────────────────────

interface ReportData {
  report?: { id: string; type: string; isAnonymized: boolean; generatedAt: Date }
  analysis: any
  patient: any
  findings: any[]
  soapRecord: any
  // Aceita ambos os formatos para compatibilidade
  professionalName?: string
  professionalCRF?: string
  isAnonymized?: boolean
  professional?: {
    name: string
    email: string
    crfNumber?: string
    institution?: string
  }
}

function PRMReport({ data }: { data: ReportData }) {
  const { analysis, patient, findings, soapRecord } = data
  const professionalName = data.professionalName || data.professional?.name || 'Farmacêutico'
  const professionalCRF = data.professionalCRF || data.professional?.crfNumber
  const isAnonymized = data.isAnonymized ?? data.report?.isAnonymized ?? false
  const now = new Date()
  const patientName = isAnonymized ? patient.code : (patient.name || patient.code)

  const urgentFindings = findings.filter(f => f.riskLevel === 'URGENT')
  const highFindings = findings.filter(f => f.riskLevel === 'HIGH')
  const moderateFindings = findings.filter(f => f.riskLevel === 'MODERATE')
  const lowFindings = findings.filter(f => f.riskLevel === 'LOW')

  return React.createElement(Document, { title: `PRM Care — Relatório ${patient.code}` },
    // Page 1 — Patient data + Summary
    React.createElement(Page, { size: 'A4', style: styles.page },
      // Header
      React.createElement(View, { style: styles.header },
        React.createElement(View, null,
          React.createElement(Text, { style: styles.logo }, '💊 PRM Care'),
          React.createElement(Text, { style: styles.logoSub }, 'Seguimento Farmacoterapêutico — Método Dáder'),
        ),
        React.createElement(View, { style: styles.headerRight },
          React.createElement(Text, { style: styles.headerDate }, `Emitido em: ${format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`),
          React.createElement(Text, { style: { ...styles.headerDate, marginTop: 2 } }, `Relatório nº: ${analysis.id.slice(-8).toUpperCase()}`),
        ),
      ),

      // Patient identification
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'IDENTIFICAÇÃO DO PACIENTE'),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, 'Código:'), React.createElement(Text, { style: styles.value }, patient.code)),
        !isAnonymized && patient.name && React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, 'Nome:'), React.createElement(Text, { style: styles.value }, patient.name)),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, 'Idade:'), React.createElement(Text, { style: styles.value }, patient.age ? `${patient.age} anos` : '—')),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, 'Sexo:'), React.createElement(Text, { style: styles.value }, patient.sex === 'MALE' ? 'Masculino' : patient.sex === 'FEMALE' ? 'Feminino' : patient.sex || '—')),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, 'Peso / Altura:'), React.createElement(Text, { style: styles.value }, `${patient.weight || '—'} kg / ${patient.height || '—'} cm`)),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, 'Gestante:'), React.createElement(Text, { style: styles.value }, patient.isPregnant ? `Sim${patient.gestationalAge ? ` (${patient.gestationalAge} sem.)` : ''}` : 'Não')),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, 'Idoso (≥60a):'), React.createElement(Text, { style: styles.value }, patient.isElderly ? 'Sim' : 'Não')),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, 'Função renal:'), React.createElement(Text, { style: styles.value }, patient.renalFunction || '—')),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, 'Função hepática:'), React.createElement(Text, { style: styles.value }, patient.hepaticFunction || '—')),
        patient.chiefComplaint && React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, 'Queixa principal:'), React.createElement(Text, { style: styles.value }, patient.chiefComplaint)),
      ),

      // Diagnoses & Comorbidities
      (patient.diagnoses?.length > 0 || patient.comorbidities?.length > 0) && React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'DIAGNÓSTICOS E COMORBIDADES'),
        ...(patient.diagnoses || []).map((d: any) => React.createElement(View, { key: d.id, style: styles.row },
          React.createElement(Text, { style: styles.label }, d.isPrimary ? 'Principal:' : 'Secundário:'),
          React.createElement(Text, { style: styles.value }, `${d.name}${d.icd10Code ? ` (${d.icd10Code})` : ''}`),
        )),
        ...(patient.comorbidities || []).map((c: any) => React.createElement(View, { key: c.id, style: styles.row },
          React.createElement(Text, { style: styles.label }, 'Comorbidade:'),
          React.createElement(Text, { style: styles.value }, c.name),
        )),
      ),

      // Medications table
      patient.medications?.length > 0 && React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, `MEDICAMENTOS EM USO (${patient.medications.length})`),
        React.createElement(View, { style: styles.table },
          React.createElement(View, { style: styles.tableHeader },
            React.createElement(Text, { style: { ...styles.tableHeaderCell, flex: 2 } }, 'Princípio Ativo'),
            React.createElement(Text, { style: styles.tableHeaderCell }, 'Dose'),
            React.createElement(Text, { style: styles.tableHeaderCell }, 'Via'),
            React.createElement(Text, { style: styles.tableHeaderCell }, 'Frequência'),
            React.createElement(Text, { style: styles.tableHeaderCell }, 'Adesão'),
          ),
          ...(patient.medications || []).map((med: any, i: number) => React.createElement(View, { key: med.id, style: { ...styles.tableRow, backgroundColor: i % 2 === 0 ? '#f9fafb' : '#ffffff' } },
            React.createElement(Text, { style: { ...styles.tableCell, flex: 2 } }, `${med.activeIngredient}${med.tradeName ? ` (${med.tradeName})` : ''}${med.isSelfMedication ? ' [automedicação]' : ''}`),
            React.createElement(Text, { style: styles.tableCell }, med.dose ? `${med.dose}${med.doseUnit || ''}` : '—'),
            React.createElement(Text, { style: styles.tableCell }, med.route || '—'),
            React.createElement(Text, { style: styles.tableCell }, med.frequency || '—'),
            React.createElement(Text, { style: styles.tableCell }, med.adherence || '—'),
          )),
        ),
      ),

      // Analysis summary
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'RESUMO DA ANÁLISE FARMACOTERAPÊUTICA'),
        React.createElement(View, { style: { flexDirection: 'row', gap: 8, marginBottom: 8 } },
          ...([
            { label: 'Total PRMs', value: analysis.totalPRMs, color: '#1e3a5f' },
            { label: 'Urgentes', value: analysis.urgentPRMs, color: '#dc2626' },
            { label: 'Alto risco', value: analysis.highRiskPRMs, color: '#ea580c' },
            { label: 'Moderados', value: analysis.moderatePRMs, color: '#ca8a04' },
            { label: 'Baixo risco', value: analysis.lowRiskPRMs, color: '#16a34a' },
          ].map(s => React.createElement(View, { key: s.label, style: { flex: 1, alignItems: 'center', padding: 6, backgroundColor: '#f9fafb', borderRadius: 4, borderWidth: 1, borderColor: '#e5e7eb' } },
            React.createElement(Text, { style: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: s.color } }, String(s.value)),
            React.createElement(Text, { style: { fontSize: 7, color: '#6b7280' } }, s.label),
          ))),
        ),
        React.createElement(Text, { style: { fontSize: 8, color: '#374151', lineHeight: 1.5 } }, analysis.summary),
      ),

      // Footer
      React.createElement(View, { style: styles.footer, fixed: true },
        React.createElement(Text, null, 'PRM Care — Seguimento Farmacoterapêutico'),
        React.createElement(Text, { render: ({ pageNumber, totalPages }: any) => `Página ${pageNumber} de ${totalPages}` }),
      ),
    ),

    // Page 2 — PRM Findings
    findings.length > 0 && React.createElement(Page, { size: 'A4', style: styles.page },
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.logo }, '💊 PRM Care'),
        React.createElement(Text, { style: styles.headerDate }, `Paciente: ${patientName} · ${format(now, 'dd/MM/yyyy', { locale: ptBR })}`),
      ),
      React.createElement(Text, { style: { ...styles.sectionTitle, fontSize: 11, marginBottom: 12 } }, 'PROBLEMAS RELACIONADOS A MEDICAMENTOS IDENTIFICADOS'),

      ...(findings.map((finding: any) => {
        const colors = RISK_COLORS[finding.riskLevel as RiskLevel]
        return React.createElement(View, { key: finding.id, style: { ...styles.findingBox, borderColor: colors.text } },
          React.createElement(View, { style: { ...styles.findingHeader, backgroundColor: colors.bg } },
            React.createElement(Text, { style: { ...styles.findingTitle, color: colors.text } }, finding.title),
            React.createElement(View, { style: { flexDirection: 'row', gap: 4 } },
              React.createElement(Text, { style: { ...styles.riskBadge, backgroundColor: colors.badge, color: colors.text } }, RISK_LABELS[finding.riskLevel as RiskLevel]),
              React.createElement(Text, { style: { ...styles.riskBadge, backgroundColor: '#f3f4f6', color: '#374151' } }, CATEGORY_LABELS[finding.category as PRMCategory]),
            ),
          ),
          React.createElement(View, { style: styles.findingBody },
            React.createElement(View, { style: styles.findingField }, React.createElement(Text, { style: styles.findingFieldLabel }, 'Evidência clínica:'), React.createElement(Text, { style: styles.findingFieldValue }, finding.clinicalEvidence)),
            React.createElement(View, { style: styles.findingField }, React.createElement(Text, { style: styles.findingFieldLabel }, 'Impacto potencial:'), React.createElement(Text, { style: styles.findingFieldValue }, finding.potentialImpact)),
            React.createElement(View, { style: styles.findingField }, React.createElement(Text, { style: styles.findingFieldLabel }, 'Conduta farmacêutica:'), React.createElement(Text, { style: styles.findingFieldValue }, finding.pharmacistConduct)),
            React.createElement(View, { style: styles.findingField }, React.createElement(Text, { style: styles.findingFieldLabel }, 'Orientação ao paciente:'), React.createElement(Text, { style: styles.findingFieldValue }, finding.patientGuidance)),
            finding.monitoring && React.createElement(View, { style: styles.findingField }, React.createElement(Text, { style: styles.findingFieldLabel }, 'Monitoramento:'), React.createElement(Text, { style: styles.findingFieldValue }, finding.monitoring)),
            React.createElement(View, { style: { flexDirection: 'row', gap: 12, marginTop: 4 } },
              React.createElement(Text, { style: { fontSize: 7, color: '#6b7280' } }, `Prazo: ${finding.interventionDeadline || '—'}`),
              React.createElement(Text, { style: { fontSize: 7, color: '#6b7280' } }, `Confiança: ${finding.confidenceLevel}`),
              finding.needsPrescriberContact && React.createElement(Text, { style: { fontSize: 7, color: '#1d4ed8' } }, '📞 Contato com prescritor'),
              finding.needsReferral && React.createElement(Text, { style: { fontSize: 7, color: '#dc2626' } }, '🏥 Encaminhamento'),
            ),
          ),
        )
      })),

      React.createElement(View, { style: styles.footer, fixed: true },
        React.createElement(Text, null, 'PRM Care — Seguimento Farmacoterapêutico'),
        React.createElement(Text, { render: ({ pageNumber, totalPages }: any) => `Página ${pageNumber} de ${totalPages}` }),
      ),
    ),

    // Page 3 — SOAP + Disclaimer
    soapRecord && React.createElement(Page, { size: 'A4', style: styles.page },
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.logo }, '💊 PRM Care'),
        React.createElement(Text, { style: styles.headerDate }, `Paciente: ${patientName} · Registro SOAP`),
      ),
      React.createElement(Text, { style: { ...styles.sectionTitle, fontSize: 11, marginBottom: 12 } }, 'REGISTRO SOAP — SEGUIMENTO FARMACOTERAPÊUTICO'),

      ...[
        { label: 'S — Subjetivo', text: soapRecord.subjective, bg: '#eff6ff', color: '#1e40af' },
        { label: 'O — Objetivo', text: soapRecord.objective, bg: '#f9fafb', color: '#374151' },
        { label: 'A — Avaliação', text: soapRecord.assessment, bg: '#fefce8', color: '#854d0e' },
        { label: 'P — Plano', text: soapRecord.plan, bg: '#f0fdf4', color: '#15803d' },
      ].map(s => React.createElement(View, { key: s.label, style: { ...styles.soapBox, backgroundColor: s.bg, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: s.color } },
        React.createElement(Text, { style: { ...styles.soapLabel, color: s.color } }, s.label),
        React.createElement(Text, { style: styles.soapText }, s.text),
      )),

      // Professional signature
      React.createElement(View, { style: { marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' } },
        React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between' } },
          React.createElement(View, { style: { flex: 1 } },
            React.createElement(Text, { style: { fontSize: 8, color: '#374151' } }, `Profissional responsável: ${professionalName || '___________________________'}`),
            React.createElement(Text, { style: { fontSize: 8, color: '#374151', marginTop: 4 } }, `CRF: ${professionalCRF || '___________________________'}`),
          ),
          React.createElement(View, { style: { flex: 1, alignItems: 'flex-end' } },
            React.createElement(Text, { style: { fontSize: 8, color: '#374151' } }, `Data: ${format(now, 'dd/MM/yyyy', { locale: ptBR })}`),
            React.createElement(Text, { style: { fontSize: 8, color: '#374151', marginTop: 4 } }, 'Assinatura: ___________________________'),
          ),
        ),
      ),

      // Disclaimer
      React.createElement(View, { style: styles.disclaimer },
        React.createElement(Text, { style: { ...styles.disclaimerText, fontFamily: 'Helvetica-Bold', marginBottom: 4 } }, '⚠️ LIMITAÇÕES E RESPONSABILIDADES'),
        React.createElement(Text, { style: styles.disclaimerText }, '• Esta ferramenta é de apoio técnico e educacional e NÃO substitui avaliação profissional habilitada.\n• As análises são baseadas exclusivamente nos dados informados. Dados incompletos podem limitar as conclusões.\n• Não interrompa, substitua ou ajuste medicamentos sem orientação de farmacêutico ou médico habilitado.\n• Recomendações clínicas devem ser validadas por profissional habilitado antes de qualquer intervenção.\n• Em sinais de urgência, encaminhe imediatamente para atendimento de saúde.\n• O profissional responsável pela análise assume a responsabilidade pela aplicação das recomendações.'),
      ),

      React.createElement(View, { style: styles.footer, fixed: true },
        React.createElement(Text, null, 'PRM Care — Seguimento Farmacoterapêutico'),
        React.createElement(Text, { render: ({ pageNumber, totalPages }: any) => `Página ${pageNumber} de ${totalPages}` }),
      ),
    ),
  )
}

// ─── Generate PDF Buffer ──────────────────────────────────────────────────────

export async function generateReportPDF(data: ReportData): Promise<Buffer> {
  const element = React.createElement(PRMReport, { data })
  const instance = pdf(element as any)
  const blob = await instance.toBlob()
  const arrayBuffer = await blob.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
