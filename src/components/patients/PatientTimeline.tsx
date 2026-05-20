'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  TrendingDown, TrendingUp, Minus, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronUp, ArrowRight,
  ShieldAlert, Clock
} from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Finding {
  id: string
  title: string
  category: string
  riskLevel: string
  isResolved: boolean
  description: string
}

interface AnalysisSummary {
  id: string
  createdAt: string         // ISO string (serializado do server)
  totalPRMs: number
  urgentPRMs: number
  highRiskPRMs: number
  moderatePRMs: number
  lowPRMs: number
  resolvedPRMs: number
  findings: Finding[]
}

interface Props {
  analyses: AnalysisSummary[]
  patientId: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  URGENT:   'bg-red-600',
  HIGH:     'bg-orange-500',
  MODERATE: 'bg-yellow-400',
  LOW:      'bg-green-500',
}

const RISK_TEXT: Record<string, string> = {
  URGENT:   'text-red-700',
  HIGH:     'text-orange-700',
  MODERATE: 'text-yellow-700',
  LOW:      'text-green-700',
}

const RISK_BG: Record<string, string> = {
  URGENT:   'bg-red-50 border-red-200',
  HIGH:     'bg-orange-50 border-orange-200',
  MODERATE: 'bg-yellow-50 border-yellow-200',
  LOW:      'bg-green-50 border-green-200',
}

const RISK_LABELS: Record<string, string> = {
  URGENT:   'Urgente',
  HIGH:     'Alto',
  MODERATE: 'Moderado',
  LOW:      'Baixo',
}

const CATEGORY_LABELS: Record<string, string> = {
  NECESSITY:    'Necessidade',
  EFFECTIVENESS:'Efetividade',
  SAFETY:       'Segurança',
  ADHERENCE:    'Adesão',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// compara dois números e retorna ícone de tendência
function Trend({ curr, prev, lowerIsBetter = true }: { curr: number; prev: number; lowerIsBetter?: boolean }) {
  if (prev === 0 && curr === 0) return <Minus className="h-3.5 w-3.5 text-gray-400" />
  const better = lowerIsBetter ? curr < prev : curr > prev
  const worse  = lowerIsBetter ? curr > prev : curr < prev
  if (better) return <TrendingDown className="h-3.5 w-3.5 text-green-600" />
  if (worse)  return <TrendingUp className="h-3.5 w-3.5 text-red-500" />
  return <Minus className="h-3.5 w-3.5 text-gray-400" />
}

// ── Mini sparkline ────────────────────────────────────────────────────────────

function Sparkline({ data, color = '#1e3a5f' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 80
  const h = 30
  const step = w / (data.length - 1)
  const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => (
        <circle key={i} cx={i * step} cy={h - (v / max) * h} r={2.5} fill={color} />
      ))}
    </svg>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

export function PatientTimeline({ analyses, patientId }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null)

  if (analyses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Clock className="h-8 w-8 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">Nenhuma análise registrada ainda.</p>
        <Link href={`/analysis/new?patientId=${patientId}`}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#162d4a]">
          Realizar primeira análise
        </Link>
      </div>
    )
  }

  // dados para sparklines (ordem cronológica)
  const chronological = [...analyses].reverse()
  const totalData    = chronological.map(a => a.totalPRMs)
  const urgentData   = chronological.map(a => a.urgentPRMs)
  const resolvedData = chronological.map(a => a.resolvedPRMs)

  // comparação entre duas análises
  const compareA = compareIds ? analyses.find(a => a.id === compareIds[0]) : null
  const compareB = compareIds ? analyses.find(a => a.id === compareIds[1]) : null

  const toggleCompare = (id: string) => {
    if (!compareMode) return
    if (!compareIds) {
      setCompareIds([id, ''])
    } else if (compareIds[1] === '') {
      if (compareIds[0] === id) return
      setCompareIds([compareIds[0], id])
    } else {
      setCompareIds([id, ''])
    }
  }

  const isSelectedForCompare = (id: string) => compareIds?.includes(id) ?? false

  return (
    <div className="space-y-5">
      {/* Controles */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          {analyses.length} análise{analyses.length > 1 ? 's' : ''} registrada{analyses.length > 1 ? 's' : ''}
        </h3>
        {analyses.length >= 2 && (
          <button
            onClick={() => {
              setCompareMode(m => !m)
              setCompareIds(null)
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
              compareMode
                ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            {compareMode ? 'Comparando…' : 'Comparar análises'}
          </button>
        )}
      </div>

      {/* Instrução de comparação */}
      {compareMode && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-700">
          {!compareIds || compareIds[1] === ''
            ? '👆 Selecione a primeira análise para comparar'
            : '👆 Selecione a segunda análise para ver o comparativo'}
        </div>
      )}

      {/* Painel comparativo */}
      {compareA && compareB && compareIds![1] !== '' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-blue-900">📊 Comparativo de análises</h4>
            <button onClick={() => setCompareIds(null)} className="text-xs text-blue-600 hover:underline">Limpar</button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div />
            <div className="font-semibold text-gray-600">{formatDate(compareA.createdAt)}</div>
            <div className="font-semibold text-gray-600">{formatDate(compareB.createdAt)}</div>

            {[
              { label: 'Total de PRMs', a: compareA.totalPRMs, b: compareB.totalPRMs },
              { label: 'Urgentes',      a: compareA.urgentPRMs, b: compareB.urgentPRMs },
              { label: 'Alto risco',    a: compareA.highRiskPRMs, b: compareB.highRiskPRMs },
              { label: 'Moderados',     a: compareA.moderatePRMs, b: compareB.moderatePRMs },
              { label: 'Resolvidos',    a: compareA.resolvedPRMs, b: compareB.resolvedPRMs, higherIsBetter: true },
            ].map(row => (
              <>
                <div key={`l-${row.label}`} className="text-left text-gray-600 font-medium py-1">{row.label}</div>
                <div key={`a-${row.label}`} className="py-1 font-bold text-gray-900">{row.a}</div>
                <div key={`b-${row.label}`} className={`py-1 font-bold flex items-center justify-center gap-1 ${
                  row.higherIsBetter
                    ? (row.b > row.a ? 'text-green-700' : row.b < row.a ? 'text-red-700' : 'text-gray-700')
                    : (row.b < row.a ? 'text-green-700' : row.b > row.a ? 'text-red-700' : 'text-gray-700')
                }`}>
                  {row.b}
                  {row.b !== row.a && (
                    <span className="text-[10px]">
                      {row.higherIsBetter
                        ? (row.b > row.a ? '▲' : '▼')
                        : (row.b < row.a ? '▼' : '▲')}
                    </span>
                  )}
                </div>
              </>
            ))}
          </div>

          {/* PRMs novos vs resolvidos */}
          {(() => {
            const titlesA = new Set(compareA.findings.map(f => f.title))
            const titlesB = new Set(compareB.findings.map(f => f.title))
            const newPRMs = compareB.findings.filter(f => !titlesA.has(f.title))
            const resolvedPRMs = compareA.findings.filter(f => !titlesB.has(f.title) && f.isResolved)
            return (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-blue-200">
                <div>
                  <p className="text-xs font-semibold text-green-700 mb-1">✅ PRMs resolvidos entre análises ({resolvedPRMs.length})</p>
                  {resolvedPRMs.length === 0
                    ? <p className="text-xs text-gray-400">Nenhum</p>
                    : resolvedPRMs.slice(0, 3).map(f => (
                        <p key={f.id} className="text-xs text-gray-600 truncate">· {f.title}</p>
                      ))
                  }
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-700 mb-1">🆕 Novos PRMs ({newPRMs.length})</p>
                  {newPRMs.length === 0
                    ? <p className="text-xs text-gray-400">Nenhum</p>
                    : newPRMs.slice(0, 3).map(f => (
                        <p key={f.id} className="text-xs text-gray-600 truncate">· {f.title}</p>
                      ))
                  }
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Sparklines de tendência */}
      {analyses.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total de PRMs', data: totalData, color: '#1e3a5f' },
            { label: 'Urgentes',      data: urgentData, color: '#dc2626' },
            { label: 'Resolvidos',    data: resolvedData, color: '#16a34a' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border bg-white p-3 flex flex-col gap-2">
              <p className="text-xs text-gray-500">{s.label}</p>
              <Sparkline data={s.data} color={s.color} />
              <p className="text-[10px] text-gray-400">últimas {s.data.length} análises</p>
            </div>
          ))}
        </div>
      )}

      {/* Timeline vertical */}
      <div className="relative">
        {/* Linha vertical */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

        <div className="space-y-4">
          {analyses.map((analysis, idx) => {
            const prev = analyses[idx + 1]
            const isExpanded = expandedId === analysis.id
            const isSelected = isSelectedForCompare(analysis.id)
            const resolutionRate = analysis.totalPRMs > 0
              ? Math.round((analysis.resolvedPRMs / analysis.totalPRMs) * 100)
              : 0

            return (
              <div key={analysis.id}
                className={`relative pl-10 transition-all ${compareMode ? 'cursor-pointer' : ''}`}
                onClick={() => toggleCompare(analysis.id)}
              >
                {/* Bolinha na timeline */}
                <div className={`absolute left-0 top-4 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : idx === 0
                      ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white'
                      : 'border-gray-300 bg-white text-gray-500'
                }`}>
                  {analyses.length - idx}
                </div>

                {/* Card */}
                <div className={`rounded-xl border bg-white shadow-sm transition-all ${
                  isSelected ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'
                }`}>
                  {/* Cabeçalho do card */}
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">{formatDate(analysis.createdAt)}</p>
                          {idx === 0 && (
                            <span className="rounded-full bg-[#1e3a5f] px-2 py-0.5 text-[10px] font-medium text-white">Mais recente</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {analysis.totalPRMs} PRM{analysis.totalPRMs !== 1 ? 's' : ''} identificado{analysis.totalPRMs !== 1 ? 's' : ''}
                          {analysis.resolvedPRMs > 0 && ` · ${analysis.resolvedPRMs} resolvido${analysis.resolvedPRMs !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Badges de risco */}
                      {analysis.urgentPRMs > 0 && (
                        <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">{analysis.urgentPRMs} urgente</span>
                      )}
                      {analysis.highRiskPRMs > 0 && (
                        <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-xs font-medium">{analysis.highRiskPRMs} alto</span>
                      )}
                      {analysis.moderatePRMs > 0 && (
                        <span className="rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5 text-xs font-medium">{analysis.moderatePRMs} mod.</span>
                      )}

                      {/* Tendência vs análise anterior */}
                      {prev && (
                        <div className="flex items-center gap-0.5 text-xs text-gray-400">
                          <Trend curr={analysis.totalPRMs} prev={prev.totalPRMs} />
                        </div>
                      )}

                      {/* Botão expandir */}
                      {!compareMode && (
                        <button
                          onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : analysis.id) }}
                          className="ml-1 rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      )}

                      {/* Link para análise completa */}
                      {!compareMode && (
                        <Link
                          href={`/analysis/${analysis.id}`}
                          onClick={e => e.stopPropagation()}
                          className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 hover:text-[#1e3a5f] transition-colors"
                          title="Ver análise completa"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Barra de progresso resolução */}
                  {analysis.totalPRMs > 0 && (
                    <div className="px-5 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${resolutionRate}%`,
                              backgroundColor: resolutionRate >= 70 ? '#16a34a' : resolutionRate >= 40 ? '#d97706' : '#dc2626',
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 w-8 text-right">{resolutionRate}%</span>
                      </div>
                    </div>
                  )}

                  {/* Conteúdo expandido */}
                  {isExpanded && !compareMode && (
                    <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                      {/* Achados agrupados por risco */}
                      {(['URGENT', 'HIGH', 'MODERATE', 'LOW'] as const).map(level => {
                        const group = analysis.findings.filter(f => f.riskLevel === level)
                        if (group.length === 0) return null
                        return (
                          <div key={level}>
                            <p className={`text-xs font-semibold mb-2 ${RISK_TEXT[level]}`}>
                              {RISK_LABELS[level]} ({group.length})
                            </p>
                            <div className="space-y-1.5">
                              {group.map(f => (
                                <div key={f.id}
                                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${RISK_BG[f.riskLevel]}`}>
                                  <div className={`mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${RISK_COLORS[f.riskLevel]}`} />
                                  <div className="min-w-0">
                                    <p className={`font-medium truncate ${f.isResolved ? 'line-through text-gray-400' : RISK_TEXT[f.riskLevel]}`}>
                                      {f.title}
                                    </p>
                                    <p className="text-gray-500 mt-0.5">{CATEGORY_LABELS[f.category] || f.category}</p>
                                  </div>
                                  {f.isResolved && (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}

                      {/* Variação em relação à análise anterior */}
                      {prev && (() => {
                        const titlesNow  = new Set(analysis.findings.map(f => f.title))
                        const titlesPrev = new Set(prev.findings.map(f => f.title))
                        const newPRMs  = analysis.findings.filter(f => !titlesPrev.has(f.title))
                        const goneKeys = prev.findings.filter(f => !titlesNow.has(f.title))
                        if (newPRMs.length === 0 && goneKeys.length === 0) return null
                        return (
                          <div className="border-t border-dashed border-gray-200 pt-3 space-y-2">
                            <p className="text-xs font-semibold text-gray-500">Variação vs análise anterior ({formatDateShort(prev.createdAt)})</p>
                            {newPRMs.length > 0 && (
                              <div>
                                <p className="text-[10px] font-medium text-red-600 mb-1">🆕 Novos PRMs detectados</p>
                                {newPRMs.map(f => <p key={f.id} className="text-[10px] text-gray-600 truncate pl-2">· {f.title}</p>)}
                              </div>
                            )}
                            {goneKeys.length > 0 && (
                              <div>
                                <p className="text-[10px] font-medium text-green-600 mb-1">✅ PRMs não recorrentes</p>
                                {goneKeys.map(f => <p key={f.id} className="text-[10px] text-gray-600 truncate pl-2">· {f.title}</p>)}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
