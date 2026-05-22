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
      <div className="bg-gradient-to-br from-[#0f2744] via-[#1e3a5f] to-[#1a4a7a] px-6 pt-8 pb-6 text-white">
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
      <div className="bg-white px-6 py-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Por onde começar?
        </p>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <Link
            href="/patients/new"
            className="group flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-[#1e3a5f] hover:bg-blue-50/30 transition-all"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 group-hover:bg-blue-200 transition-colors">
              <Users className="h-4 w-4 text-blue-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">1. Cadastrar paciente</p>
              <p className="text-[11px] text-gray-500">Adicione dados clínicos</p>
            </div>
          </Link>

          <Link
            href="/analysis/new"
            className="group flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-purple-400 hover:bg-purple-50/30 transition-all"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100 group-hover:bg-purple-200 transition-colors">
              <FlaskConical className="h-4 w-4 text-purple-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">2. Analisar PRMs</p>
              <p className="text-[11px] text-gray-500">IA + regras clínicas</p>
            </div>
          </Link>

          <GuidedTour
            trigger={
              <div className="group flex items-center gap-3 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 px-4 py-3 hover:bg-blue-50 hover:border-blue-400 transition-all cursor-pointer">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 group-hover:bg-blue-200 transition-colors">
                  <Sparkles className="h-4 w-4 text-blue-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800">Tour do sistema</p>
                  <p className="text-[11px] text-blue-600">Conheça todas as funções</p>
                </div>
              </div>
            }
          />
        </div>
      </div>
    </div>
  )
}
