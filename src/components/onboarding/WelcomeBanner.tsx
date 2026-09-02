'use client'
import Link from 'next/link'
import { Pill, Users, FlaskConical, Sparkles } from 'lucide-react'
import { GuidedTour } from './GuidedTour'

interface Props {
  firstName: string
  tokenBalance: number
}

export function WelcomeBanner({ firstName, tokenBalance }: Props) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-blue-100">
      {/* Hero */}
      <div className="bg-gradient-to-br from-brand-900 via-brand-800 to-[#1a4a7a] px-6 pt-8 pb-6 text-white">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <Pill className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-white/50 mb-0.5">Bem-vindo(a) ao</p>
            <h1 className="text-2xl font-bold">Olá, {firstName}! 👋</h1>
            <p className="text-white/70 text-sm mt-1 leading-relaxed">
              Sua plataforma de farmácia clínica está pronta. Você recebeu{' '}
              <span className="font-bold text-blue-300">{tokenBalance} tokens de boas-vindas</span>{' '}
              para suas primeiras análises.
            </p>
          </div>
        </div>

        {/* Stats de boas-vindas */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { value: '50+', label: 'Regras clínicas' },
            { value: 'IA', label: 'LLaMA 70B' },
            { value: 'LGPD', label: 'Conforme' },
          ].map(({ value, label }) => (
            <div key={label} className="rounded-xl bg-white/8 border border-white/10 px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-[10px] text-white/50 uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="bg-card px-6 py-5">
        <p className="section-label mb-3">Por onde começar?</p>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <Link
            href="/patients/new"
            className="group flex items-center gap-3 rounded-xl border border-border px-4 py-3 transition-all hover:border-brand-800/50 hover:bg-brand-50/30 dark:hover:bg-brand-900/20"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 transition-colors group-hover:bg-blue-200 dark:bg-blue-900/30 dark:group-hover:bg-blue-800/40">
              <Users className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">1. Cadastrar paciente</p>
              <p className="text-[11px] text-muted-foreground">Adicione dados clínicos</p>
            </div>
          </Link>

          <Link
            href="/analysis/new"
            className="group flex items-center gap-3 rounded-xl border border-border px-4 py-3 transition-all hover:border-purple-400 hover:bg-purple-50/30 dark:hover:bg-purple-900/20"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100 transition-colors group-hover:bg-purple-200 dark:bg-purple-900/30 dark:group-hover:bg-purple-800/40">
              <FlaskConical className="h-4 w-4 text-purple-700 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">2. Analisar PRMs</p>
              <p className="text-[11px] text-muted-foreground">IA + regras clínicas</p>
            </div>
          </Link>

          <GuidedTour
            trigger={
              <div className="group flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-brand-800/30 bg-brand-50/50 px-4 py-3 transition-all hover:border-brand-800/60 hover:bg-brand-50 dark:bg-brand-900/20 dark:border-brand-700/30 dark:hover:bg-brand-900/30">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 transition-colors group-hover:bg-brand-100 dark:bg-brand-900/40">
                  <Sparkles className="h-4 w-4 text-brand-800 dark:text-brand-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-brand-800 dark:text-brand-400">Tour do sistema</p>
                  <p className="text-[11px] text-brand-700/70 dark:text-brand-500">Conheça todas as funções</p>
                </div>
              </div>
            }
          />
        </div>
      </div>
    </div>
  )
}
