'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, Circle, Users, FlaskConical, FileText,
  UserCircle, ChevronDown, ChevronUp, X, Sparkles,
} from 'lucide-react'

interface Step {
  id: string
  label: string
  description: string
  href: string
  cta: string
  icon: React.ElementType
  done: boolean
}

interface Props {
  hasPatient: boolean
  hasAnalysis: boolean
  hasReport: boolean
  hasProfile: boolean
}

const HIDDEN_KEY = 'prm-onboarding-hidden'

export function OnboardingChecklist({ hasPatient, hasAnalysis, hasReport, hasProfile }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [hidden, setHidden]       = useState(() => {
    try { return localStorage.getItem(HIDDEN_KEY) === '1' } catch { return false }
  })

  const steps: Step[] = [
    {
      id: 'patient',
      label: 'Cadastrar primeiro paciente',
      description: 'Adicione um paciente com suas informações clínicas básicas.',
      href: '/patients/new',
      cta: 'Cadastrar paciente',
      icon: Users,
      done: hasPatient,
    },
    {
      id: 'analysis',
      label: 'Realizar primeira análise PRM',
      description: 'Execute uma análise farmacoterapêutica com apoio de IA.',
      href: '/analysis/new',
      cta: 'Nova análise',
      icon: FlaskConical,
      done: hasAnalysis,
    },
    {
      id: 'report',
      label: 'Gerar relatório ou carta ao médico',
      description: 'Documente os achados e comunique ao prescritor.',
      href: '/reports',
      cta: 'Ver relatórios',
      icon: FileText,
      done: hasReport,
    },
    {
      id: 'profile',
      label: 'Completar perfil profissional',
      description: 'Adicione seu CRF e especialização para personalizar documentos.',
      href: '/settings',
      cta: 'Editar perfil',
      icon: UserCircle,
      done: hasProfile,
    },
  ]

  const doneCount = steps.filter(s => s.done).length
  const allDone   = doneCount === steps.length
  const pct       = Math.round((doneCount / steps.length) * 100)

  const dismiss = () => {
    try { localStorage.setItem(HIDDEN_KEY, '1') } catch {}
    setHidden(true)
  }

  // Hide permanently once all done and dismissed, or user dismissed manually
  if (hidden) return null
  if (allDone) return (
    <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 flex items-center gap-3 shadow-sm">
      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-green-800">Configuração completa! 🎉</p>
        <p className="text-xs text-green-700">Você completou todos os primeiros passos do PRM Care.</p>
      </div>
      <button onClick={dismiss} className="text-green-500 hover:text-green-700">
        <X className="h-4 w-4" />
      </button>
    </div>
  )

  return (
    <div className="rounded-xl border border-blue-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none bg-gradient-to-r from-[#0f2744] to-[#1e3a5f] text-white"
        onClick={() => setCollapsed(c => !c)}
      >
        <Sparkles className="h-4 w-4 text-blue-300 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Primeiros passos</p>
          <p className="text-xs text-white/60">{doneCount} de {steps.length} concluídos</p>
        </div>

        {/* Progress bar */}
        <div className="hidden sm:block w-24 h-1.5 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-300 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-bold text-blue-300">{pct}%</span>

        <button onClick={(e) => { e.stopPropagation(); dismiss() }} className="text-white/30 hover:text-white/70 ml-1">
          <X className="h-3.5 w-3.5" />
        </button>
        {collapsed
          ? <ChevronDown className="h-4 w-4 text-white/50" />
          : <ChevronUp className="h-4 w-4 text-white/50" />
        }
      </div>

      {/* Steps */}
      {!collapsed && (
        <div className="divide-y divide-gray-50">
          {steps.map((step, idx) => {
            const Icon = step.icon
            return (
              <div
                key={step.id}
                className={`flex items-start gap-4 px-5 py-3.5 transition-colors ${
                  step.done ? 'bg-green-50/50' : 'hover:bg-blue-50/30'
                }`}
              >
                {/* Step number / check */}
                <div className="flex-shrink-0 mt-0.5">
                  {step.done
                    ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                    : <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-300 text-[10px] font-bold text-gray-400">
                        {idx + 1}
                      </div>
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${step.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {step.label}
                  </p>
                  {!step.done && (
                    <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                  )}
                </div>

                {!step.done && (
                  <Link
                    href={step.href}
                    className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#162d4a] transition-colors"
                  >
                    <Icon className="h-3 w-3" />
                    {step.cta}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
