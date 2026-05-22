'use client'

import { useState } from 'react'
import { Printer, AlertTriangle, Info, ChevronDown, ChevronUp, X } from 'lucide-react'
import { TIME_SLOTS, type ResolvedSchedule, type TimeSlotId } from '@/lib/posology'
import type { PosologyAlert, MedWithSchedule } from '@/app/(dashboard)/patients/[id]/reconciliation/page'

// ── Severity config ──────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  high: { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-700', badge: 'bg-red-100 text-red-700', icon: '🔴', label: 'Alta' },
  medium: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', icon: '🟡', label: 'Média' },
  low: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-600', icon: '🔵', label: 'Baixa' },
} as const

// ── Class color pill ─────────────────────────────────────────────────────────

const CLASS_COLOR_MAP: Record<string, { bg: string; text: string; dot: string }> = {
  'Cardiovascular':        { bg: 'bg-red-100',     text: 'text-red-800',    dot: 'bg-red-500' },
  'Anticoagulante':        { bg: 'bg-rose-100',    text: 'text-rose-800',   dot: 'bg-rose-500' },
  'Antidiabético':         { bg: 'bg-violet-100',  text: 'text-violet-800', dot: 'bg-violet-500' },
  'Neurológico':           { bg: 'bg-indigo-100',  text: 'text-indigo-800', dot: 'bg-indigo-500' },
  'Psiquiátrico':          { bg: 'bg-purple-100',  text: 'text-purple-800', dot: 'bg-purple-500' },
  'Gastroenterológico':    { bg: 'bg-emerald-100', text: 'text-emerald-800',dot: 'bg-emerald-500' },
  'Analgésico/AINE':       { bg: 'bg-orange-100',  text: 'text-orange-800', dot: 'bg-orange-500' },
  'Antimicrobiano':        { bg: 'bg-teal-100',    text: 'text-teal-800',   dot: 'bg-teal-500' },
  'Hormonal':              { bg: 'bg-pink-100',    text: 'text-pink-800',   dot: 'bg-pink-500' },
  'Respiratório':          { bg: 'bg-sky-100',     text: 'text-sky-800',    dot: 'bg-sky-500' },
  'Suplemento/Vitamina':   { bg: 'bg-lime-100',    text: 'text-lime-800',   dot: 'bg-lime-500' },
  'Corticosteroide':       { bg: 'bg-yellow-100',  text: 'text-yellow-800', dot: 'bg-yellow-500' },
  'Outros':                { bg: 'bg-gray-100',    text: 'text-gray-700',   dot: 'bg-gray-400' },
}

function classColor(cls: string) {
  return CLASS_COLOR_MAP[cls] ?? CLASS_COLOR_MAP['Outros']
}

// ── Dot cell ─────────────────────────────────────────────────────────────────

function ScheduleDot({ active, color, timing }: { active: boolean; color: string; timing: string }) {
  if (!active) return <span className="block w-3 h-3 rounded-full bg-gray-100 mx-auto" />
  return (
    <span
      title={timing || 'Horário'}
      className={`block w-4 h-4 rounded-full ${color} mx-auto shadow-sm ring-2 ring-white`}
    />
  )
}

// ── Alert card ───────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: PosologyAlert }) {
  const [open, setOpen] = useState(false)
  const cfg = SEVERITY_CONFIG[alert.severity]

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden print:border print:break-inside-avoid`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
      >
        <span className="text-base mt-0.5">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${cfg.text}`}>{alert.title}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
            {alert.type === 'beers' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-800 text-white">Critérios Beers</span>
            )}
          </div>
          <p className={`text-xs mt-0.5 ${cfg.text} opacity-80`}>{alert.medication}</p>
        </div>
        <span className="text-gray-400 flex-shrink-0 mt-0.5">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className={`px-4 pb-4 text-xs ${cfg.text} space-y-2 border-t ${cfg.border} pt-3`}>
          <p>{alert.message}</p>
          {alert.recommendation && (
            <div className="flex gap-2 mt-2 p-2.5 rounded-lg bg-white/60">
              <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <p><span className="font-semibold">Conduta: </span>{alert.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Legend ───────────────────────────────────────────────────────────────────

function Legend({ classes }: { classes: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {classes.map(cls => {
        const c = classColor(cls)
        return (
          <span key={cls} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${c.bg} ${c.text} font-medium`}>
            <span className={`w-2 h-2 rounded-full ${c.dot}`} />
            {cls}
          </span>
        )
      })}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  meds: MedWithSchedule[]
  alerts: PosologyAlert[]
  patientName: string
  patientAge: number | null
}

export function MedScheduleGrid({ meds, alerts, patientName, patientAge }: Props) {
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [showOnlyAlerted, setShowOnlyAlerted] = useState(false)

  const alertedMedNames = new Set(alerts.map(a => a.medication.split('(')[0].trim().toLowerCase()))
  const filteredAlerts = alerts.filter(a =>
    filterSeverity === 'all' ? true : a.severity === filterSeverity
  )
  const displayedMeds = showOnlyAlerted
    ? meds.filter(m => alertedMedNames.has(m.name.toLowerCase()))
    : meds

  const presentClasses = Array.from(new Set(meds.map(m => m.therapeuticClass)))
  const highCount = alerts.filter(a => a.severity === 'high').length
  const medCount = alerts.filter(a => a.severity === 'medium').length

  return (
    <div className="space-y-6">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 px-4 py-2.5">
          <span className="text-xl font-bold text-gray-900">{meds.length}</span>
          <span className="text-sm text-gray-500">medicamento{meds.length !== 1 ? 's' : ''}</span>
        </div>
        {highCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-xl font-bold text-red-700">{highCount}</span>
            <span className="text-sm text-red-600">alerta{highCount !== 1 ? 's' : ''} alto risco</span>
          </div>
        )}
        {medCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5">
            <span className="text-xl font-bold text-amber-700">{medCount}</span>
            <span className="text-sm text-amber-600">alerta{medCount !== 1 ? 's' : ''} atenção</span>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 px-4 py-2.5">
          <span className="text-sm text-gray-600">
            {patientAge !== null ? `${patientAge} anos` : 'Idade não informada'}
          </span>
        </div>
      </div>

      {/* ── SCHEDULE GRID ── */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden print:border-gray-400">
        <div className="bg-gradient-to-r from-[#0f2744] to-[#1e3a5f] px-5 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-sm">Grade de Horários</h2>
            <p className="text-white/60 text-xs mt-0.5">Posologia visual — {patientName}</p>
          </div>
          <button
            onClick={() => setShowOnlyAlerted(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              showOnlyAlerted
                ? 'bg-amber-400 text-gray-900'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {showOnlyAlerted ? '✓ Só alertados' : 'Filtrar alertados'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-2.5 text-left font-semibold text-gray-600 min-w-[180px]">
                  Medicamento
                </th>
                {TIME_SLOTS.map(slot => (
                  <th key={slot.id} className="px-2 py-2.5 text-center font-medium text-gray-500 min-w-[52px]">
                    <div className="text-[10px] text-gray-400">{slot.icon}</div>
                    <div>{slot.label}</div>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left font-medium text-gray-500 min-w-[140px]">Observações</th>
              </tr>
            </thead>
            <tbody>
              {displayedMeds.map((med, idx) => {
                const c = classColor(med.therapeuticClass)
                const hasAlert = alertedMedNames.has(med.name.toLowerCase())
                return (
                  <tr
                    key={med.id}
                    className={`border-b border-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} ${hasAlert ? 'ring-inset ring-1 ring-amber-200' : ''}`}
                  >
                    {/* Med name cell */}
                    <td className="sticky left-0 z-10 px-4 py-3 bg-inherit">
                      <div className="flex items-start gap-2">
                        {hasAlert && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />}
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate leading-tight">{med.name}</p>
                          {med.dosage && <p className="text-gray-400 truncate">{med.dosage}</p>}
                          <span className={`inline-flex items-center gap-1 mt-1 text-[10px] px-1.5 py-0.5 rounded-full ${c.bg} ${c.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                            {med.therapeuticClass}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Time slots */}
                    {TIME_SLOTS.map(slot => {
                      const active = med.schedule.slots.includes(slot.id as TimeSlotId)
                      return (
                        <td key={slot.id} className="px-2 py-3 text-center">
                          <ScheduleDot active={active} color={c.dot} timing={med.schedule.timing} />
                        </td>
                      )
                    })}

                    {/* Timing note */}
                    <td className="px-3 py-3">
                      <p className="text-gray-500 leading-snug">
                        {med.schedule.isVariable
                          ? <span className="italic text-gray-400">Variável</span>
                          : med.schedule.timing || '—'}
                      </p>
                    </td>
                  </tr>
                )
              })}
              {displayedMeds.length === 0 && (
                <tr>
                  <td colSpan={TIME_SLOTS.length + 2} className="px-4 py-8 text-center text-gray-400 text-sm">
                    Nenhum medicamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-2">Legenda — Classe Terapêutica</p>
          <Legend classes={presentClasses} />
        </div>
      </div>

      {/* ── ALERTS PANEL ── */}
      {alerts.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden print:border-gray-400">
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Alertas Posológicos
              </h2>
              <p className="text-white/70 text-xs mt-0.5">{alerts.length} ponto{alerts.length !== 1 ? 's' : ''} de atenção identificado{alerts.length !== 1 ? 's' : ''}</p>
            </div>
            {/* Severity filter */}
            <div className="flex gap-1.5 flex-wrap justify-end">
              {(['all', 'high', 'medium', 'low'] as const).map(sev => (
                <button
                  key={sev}
                  onClick={() => setFilterSeverity(sev)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filterSeverity === sev
                      ? 'bg-white text-gray-900'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {sev === 'all' ? 'Todos' : sev === 'high' ? '🔴 Alto' : sev === 'medium' ? '🟡 Médio' : '🔵 Baixo'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 space-y-3">
            {filteredAlerts.map((alert, i) => (
              <AlertCard key={i} alert={alert} />
            ))}
            {filteredAlerts.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-4">Nenhum alerta para este filtro.</p>
            )}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-emerald-800 text-sm">Nenhum alerta posológico identificado</p>
            <p className="text-emerald-700 text-xs mt-0.5">A posologia registrada não ativou nenhuma regra de alerta clínico.</p>
          </div>
        </div>
      )}

      {/* Print footer */}
      <div className="hidden print:block text-xs text-gray-400 border-t border-gray-200 pt-4 mt-4">
        <p>Conciliação Farmacêutica — PRM Care · Gerado em {new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}</p>
        <p className="mt-1">Este documento é de uso interno e deve ser revisado pelo farmacêutico responsável.</p>
      </div>
    </div>
  )
}
