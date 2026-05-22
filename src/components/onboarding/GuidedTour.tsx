'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  X, ChevronLeft, ChevronRight, Users, FlaskConical,
  FileText, BookOpen, BarChart3, Calculator, Globe,
  Shield, Sparkles, CheckCircle2,
} from 'lucide-react'

const TOUR_KEY = 'prm-tour-done'

interface TourStep {
  icon: React.ElementType
  color: string
  title: string
  description: string
  detail: string
  href?: string
  hrefLabel?: string
  visual: React.ReactNode
}

const steps: TourStep[] = [
  {
    icon: Sparkles,
    color: 'from-[#0f2744] to-[#1e3a5f]',
    title: 'Bem-vindo ao PRM Care',
    description: 'Sua plataforma de farmácia clínica baseada no Método Dáder.',
    detail: 'O PRM Care automatiza a identificação de Problemas Relacionados a Medicamentos (PRMs), combinando regras clínicas locais com análise por Inteligência Artificial.',
    visual: (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Motor clínico', sub: 'Regras Dáder' },
            { label: 'IA farmacêutica', sub: 'Groq LLaMA' },
            { label: 'FDA/ANVISA', sub: 'Dados reais' },
          ].map(({ label, sub }) => (
            <div key={label} className="rounded-lg bg-white/10 px-2 py-2">
              <p className="text-xs font-semibold text-white">{label}</p>
              <p className="text-[10px] text-white/60">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: Users,
    color: 'from-blue-600 to-blue-800',
    title: 'Gestão de Pacientes',
    description: 'Cadastre e gerencie todos os seus pacientes farmacoterapêuticos.',
    detail: 'Cada paciente tem seu perfil completo: medicamentos ativos, diagnósticos, comorbidades, alergias, função renal/hepática, escalas clínicas e histórico de análises.',
    href: '/patients/new',
    hrefLabel: 'Cadastrar primeiro paciente',
    visual: (
      <div className="space-y-2 py-2">
        {['João Silva · DM2 · 4 medicamentos', 'Maria Costa · HAS · 2 medicamentos', 'Pedro Alves · ICC · 6 medicamentos'].map(p => (
          <div key={p} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
            <div className="h-7 w-7 rounded-full bg-blue-300/30 flex items-center justify-center text-xs font-bold text-white">
              {p[0]}
            </div>
            <p className="text-xs text-white/80">{p}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: FlaskConical,
    color: 'from-purple-600 to-purple-800',
    title: 'Análise PRM com IA',
    description: 'Identifique problemas farmacoterapêuticos em segundos.',
    detail: 'A análise combina 50+ regras clínicas do Método Dáder com IA (LLaMA 70B). Detecta interações, subdoses, medicamentos desnecessários, falta de adesão e muito mais — classificados por gravidade (urgente, alto, moderado, baixo).',
    href: '/analysis/new',
    hrefLabel: 'Iniciar análise',
    visual: (
      <div className="space-y-2 py-2">
        {[
          { label: 'Interação grave: Varfarina + AAS', risk: 'Urgente', color: 'bg-red-400/30 text-red-200' },
          { label: 'Subdosagem de Metformina', risk: 'Alto', color: 'bg-orange-400/30 text-orange-200' },
          { label: 'Medicamento sem diagnóstico', risk: 'Moderado', color: 'bg-yellow-400/30 text-yellow-200' },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2">
            <p className="text-xs text-white/80 flex-1">{item.label}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ml-2 ${item.color}`}>{item.risk}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: FileText,
    color: 'from-emerald-600 to-emerald-800',
    title: 'Relatórios e Carta ao Médico',
    description: 'Documente e comunique suas intervenções farmacêuticas.',
    detail: 'Gere relatórios clínicos completos e cartas formais para o médico prescritor. Todos os documentos são imprimíveis e incluem seus dados profissionais (CRF, especialização).',
    href: '/reports',
    hrefLabel: 'Ver relatórios',
    visual: (
      <div className="rounded-lg bg-white/10 px-4 py-3 space-y-2 font-mono text-[10px] text-white/70">
        <p className="font-bold text-white text-xs">📄 Carta ao Médico</p>
        <p>Prezado Dr. ____,</p>
        <p>Comunico que durante acompanhamento</p>
        <p>farmacoterapêutico de seu paciente...</p>
        <p className="pt-1 text-emerald-300">■ 2 PRMs identificados</p>
        <p className="text-emerald-300">■ 1 intervenção recomendada</p>
      </div>
    ),
  },
  {
    icon: BookOpen,
    color: 'from-amber-600 to-amber-800',
    title: 'Base de Conhecimento Clínico',
    description: 'Seu repositório personalizado de protocolos e referências.',
    detail: 'Salve protocolos clínicos, interações, contraindicações e diretrizes. A base alimenta as análises de IA e pode ser compartilhada entre membros da instituição.',
    href: '/knowledge',
    hrefLabel: 'Explorar base clínica',
    visual: (
      <div className="space-y-1.5 py-1">
        {[
          { type: 'INTERAÇÃO', title: 'Varfarina + AINEs' },
          { type: 'PROTOCOLO', title: 'HAS — JNC 8' },
          { type: 'ALERTA', title: 'Polimorfismo CYP2D6' },
        ].map(item => (
          <div key={item.title} className="flex items-center gap-2 rounded bg-white/10 px-3 py-1.5">
            <span className="text-[9px] font-bold text-amber-300 bg-amber-400/20 rounded px-1.5 py-0.5">{item.type}</span>
            <p className="text-xs text-white/80">{item.title}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Calculator,
    color: 'from-teal-600 to-teal-800',
    title: 'Calculadoras Clínicas',
    description: '15+ calculadoras farmacêuticas integradas.',
    detail: 'Clearance de creatinina (Cockcroft-Gault, CKD-EPI), dose pediátrica, IMC, risco cardiovascular SCORE2, risco de sangramento HAS-BLED, CHADS₂-VASc e muito mais.',
    href: '/calculators',
    hrefLabel: 'Abrir calculadoras',
    visual: (
      <div className="grid grid-cols-2 gap-1.5 py-1">
        {['Clearance Creatinina', 'Risco CV SCORE2', 'HAS-BLED', 'IMC / BSA', 'Dose Pediátrica', 'CHADS₂-VASc'].map(c => (
          <div key={c} className="rounded bg-white/10 px-2 py-1.5 text-[10px] text-white/70 text-center">{c}</div>
        ))}
      </div>
    ),
  },
  {
    icon: Shield,
    color: 'from-gray-600 to-gray-800',
    title: 'Segurança e LGPD',
    description: 'Dados clínicos protegidos conforme a Lei 13.709/2018.',
    detail: 'Consentimento registrado, auditoria completa de acessos, timeout por inatividade (30 min), rate limiting e portabilidade de dados. Todos os dados são isolados por usuário.',
    href: '/settings/my-data',
    hrefLabel: 'Meus dados (LGPD)',
    visual: (
      <div className="space-y-2 py-1">
        {[
          { icon: '🔒', label: 'Consentimento LGPD registrado' },
          { icon: '📋', label: 'Auditoria de todos os acessos' },
          { icon: '⏱', label: 'Timeout por inatividade (30 min)' },
          { icon: '📦', label: 'Exportação dos seus dados' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2 rounded bg-white/10 px-3 py-1.5">
            <span>{item.icon}</span>
            <p className="text-xs text-white/80">{item.label}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: CheckCircle2,
    color: 'from-green-600 to-green-800',
    title: 'Tudo pronto para começar!',
    description: 'Você conheceu as principais funcionalidades do PRM Care.',
    detail: 'O próximo passo é cadastrar seu primeiro paciente e realizar uma análise PRM. Os 5 tokens de boas-vindas já estão na sua conta.',
    href: '/patients/new',
    hrefLabel: 'Cadastrar primeiro paciente →',
    visual: (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
          <CheckCircle2 className="h-9 w-9 text-green-300" />
        </div>
        <div className="rounded-xl bg-white/10 px-4 py-3 text-center">
          <p className="text-2xl font-bold text-white">5</p>
          <p className="text-xs text-white/60">tokens de boas-vindas disponíveis</p>
          <p className="text-[10px] text-white/40 mt-0.5">= 2 análises completas grátis</p>
        </div>
      </div>
    ),
  },
]

interface GuidedTourProps {
  trigger?: React.ReactNode
}

export function GuidedTour({ trigger }: GuidedTourProps) {
  const [open, setOpen]   = useState(false)
  const [step, setStep]   = useState(0)

  const current = steps[step]
  const Icon = current.icon
  const isLast = step === steps.length - 1

  const close = () => {
    setOpen(false)
    setStep(0)
    try { localStorage.setItem(TOUR_KEY, '1') } catch {}
  }

  return (
    <>
      {/* Trigger */}
      <div onClick={() => setOpen(true)}>
        {trigger ?? (
          <button className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors">
            <Sparkles className="h-4 w-4" /> Tour rápido
          </button>
        )}
      </div>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">

            {/* Header colorido */}
            <div className={`bg-gradient-to-br ${current.color} px-6 pt-6 pb-4 text-white relative`}>
              {/* Close */}
              <button onClick={close} className="absolute top-3 right-3 rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>

              {/* Step indicator */}
              <div className="flex items-center gap-1 mb-4">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      i < step ? 'bg-white/60' : i === step ? 'bg-white' : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] text-white/50 uppercase tracking-widest">
                    {step + 1} de {steps.length}
                  </p>
                  <h2 className="text-base font-bold leading-tight">{current.title}</h2>
                </div>
              </div>
              <p className="text-sm text-white/80">{current.description}</p>

              {/* Visual */}
              {current.visual}
            </div>

            {/* Body */}
            <div className="bg-white px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">{current.detail}</p>

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setStep(s => Math.max(0, s - 1))}
                  disabled={step === 0}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </button>

                <div className="flex gap-2">
                  {current.href && !isLast && (
                    <Link
                      href={current.href}
                      onClick={close}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      {current.hrefLabel}
                    </Link>
                  )}

                  {isLast ? (
                    <Link
                      href={current.href ?? '/patients/new'}
                      onClick={close}
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                    >
                      {current.hrefLabel}
                    </Link>
                  ) : (
                    <button
                      onClick={() => setStep(s => s + 1)}
                      className="flex items-center gap-1 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162d4a] transition-colors"
                    >
                      Próximo <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
