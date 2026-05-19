import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { RiskLevel } from '@prisma/client'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR })
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })
}

export function formatCurrency(valueInCents: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(valueInCents / 100)
}

export function calculateBMI(weight: number, height: number): number {
  const heightInMeters = height / 100
  return Math.round((weight / (heightInMeters * heightInMeters)) * 10) / 10
}

export function calculateAge(dateOfBirth: Date | string): number {
  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

export function generatePatientCode(): string {
  const prefix = 'PAC'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

export const RISK_LEVEL_CONFIG: Record<RiskLevel, {
  label: string
  color: string
  bg: string
  border: string
  badge: string
  deadline: string
  intervention: string
}> = {
  LOW: {
    label: 'Baixo Risco',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-800',
    deadline: 'Próxima consulta (30-60 dias)',
    intervention: 'Monitoramento e orientação educacional. Encaminhamento ao prescritor não urgente.',
  },
  MODERATE: {
    label: 'Risco Moderado',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-800',
    deadline: 'Breve (7-30 dias)',
    intervention: 'Intervenção farmacêutica recomendada. Contato com prescritor pode ser necessário.',
  },
  HIGH: {
    label: 'Alto Risco',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-800',
    deadline: 'Rápida (24-72 horas)',
    intervention: 'Intervenção prioritária. Contato com prescritor recomendado.',
  },
  URGENT: {
    label: 'Urgente',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-800',
    deadline: 'Imediata (até 24 horas)',
    intervention: 'Intervenção imediata obrigatória. Encaminhar para atendimento de saúde se necessário.',
  },
}

export const PRM_CATEGORY_LABELS: Record<string, string> = {
  NECESSITY: 'Necessidade',
  EFFECTIVENESS: 'Efetividade',
  SAFETY: 'Segurança',
  ADHERENCE: 'Adesão',
}

export const RENAL_FUNCTION_LABELS: Record<string, string> = {
  normal: 'Normal',
  mild_impairment: 'Leve (ClCr 60-89 mL/min)',
  moderate_impairment: 'Moderada (ClCr 30-59 mL/min)',
  severe_impairment: 'Grave (ClCr 15-29 mL/min)',
  failure: 'Insuficiência renal (ClCr < 15 mL/min)',
}

export const HEPATIC_FUNCTION_LABELS: Record<string, string> = {
  normal: 'Normal',
  mild_impairment: 'Leve (Child-Pugh A)',
  moderate_impairment: 'Moderada (Child-Pugh B)',
  severe_impairment: 'Grave (Child-Pugh C)',
}

export const ADHERENCE_LABELS: Record<string, string> = {
  EXCELLENT: 'Excelente (> 95%)',
  GOOD: 'Boa (80-95%)',
  MODERATE: 'Moderada (50-79%)',
  POOR: 'Baixa (< 50%)',
  UNKNOWN: 'Não avaliada',
}

export const ROUTE_LABELS: Record<string, string> = {
  ORAL: 'Oral',
  SUBLINGUAL: 'Sublingual',
  INHALED: 'Inalatória',
  INTRAVENOUS: 'Intravenosa',
  INTRAMUSCULAR: 'Intramuscular',
  SUBCUTANEOUS: 'Subcutânea',
  TOPICAL: 'Tópica',
  OPHTHALMIC: 'Oftálmica',
  OTIC: 'Otológica',
  NASAL: 'Nasal',
  RECTAL: 'Retal',
  TRANSDERMAL: 'Transdérmica',
  OTHER: 'Outra',
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`
}
