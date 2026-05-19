'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, FileText, Shield, Coins, CheckCircle,
  AlertTriangle, Loader2, ChevronRight, EyeOff
} from 'lucide-react'

interface Analysis {
  id: string
  createdAt: string
  patient: { code: string; name: string }
  findings: { riskLevel: string }[]
}

const REPORT_TYPES = [
  {
    id: 'COMPLETE',
    label: 'Relatório Completo',
    description: 'Dados do paciente, todos os PRMs identificados, registro SOAP e orientações ao paciente.',
    cost: 2,
    recommended: true,
  },
  {
    id: 'SOAP',
    label: 'Registro SOAP',
    description: 'Apenas o registro Subjetivo-Objetivo-Avaliação-Plano para prontuário clínico.',
    cost: 2,
    recommended: false,
  },
  {
    id: 'SIMPLE',
    label: 'Resumo de Achados',
    description: 'Lista compacta dos PRMs identificados, sem dados completos do paciente.',
    cost: 2,
    recommended: false,
  },
  {
    id: 'INSTITUTIONAL',
    label: 'Relatório Institucional',
    description: 'Formato estendido com cabeçalho da instituição, estatísticas e dados regulatórios.',
    cost: 5,
    recommended: false,
  },
]

const riskColors: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-orange-100 text-orange-700',
  LOW: 'bg-yellow-100 text-yellow-700',
  INFORMATIONAL: 'bg-blue-100 text-blue-700',
}

export default function NewReportPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedAnalysisId = searchParams.get('analysisId')

  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loadingAnalyses, setLoadingAnalyses] = useState(true)
  const [selectedAnalysisId, setSelectedAnalysisId] = useState(preselectedAnalysisId || '')
  const [selectedType, setSelectedType] = useState('COMPLETE')
  const [isAnonymized, setIsAnonymized] = useState(false)
  const [tokenBalance, setTokenBalance] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const selectedReportType = REPORT_TYPES.find(t => t.id === selectedType)!
  const selectedAnalysis = analyses.find(a => a.id === selectedAnalysisId)
  const hasEnoughTokens = tokenBalance !== null && tokenBalance >= selectedReportType.cost

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [analysesRes, sessionRes] = await Promise.all([
          fetch('/api/analysis'),
          fetch('/api/auth/session'),
        ])
        const analysesData = await analysesRes.json()
        const sessionData = await sessionRes.json()

        if (analysesData.success) setAnalyses(analysesData.data || [])
        if (sessionData?.user?.tokenBalance !== undefined) {
          setTokenBalance(sessionData.user.tokenBalance)
        }
      } catch {
        // ignore
      } finally {
        setLoadingAnalyses(false)
      }
    }
    fetchData()
  }, [])

  const handleGenerate = async () => {
    if (!selectedAnalysisId) {
      setError('Selecione uma análise para gerar o relatório.')
      return
    }
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: selectedAnalysisId,
          type: selectedType,
          isAnonymized,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao gerar relatório')

      // Navigate to reports list or download
      router.push('/reports')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const riskCounts = selectedAnalysis?.findings?.reduce((acc, f) => {
    acc[f.riskLevel] = (acc[f.riskLevel] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/reports" className="text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerar Relatório PDF</h1>
          <p className="text-sm text-gray-500 mt-0.5">Selecione a análise e o tipo de relatório</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Step 1: Select Analysis */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">1</span>
            Selecionar análise
          </h2>

          {loadingAnalyses ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : analyses.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma análise disponível.</p>
              <Link href="/analysis/new" className="text-sm text-blue-600 hover:underline mt-1 inline-block">
                Criar primeira análise
              </Link>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {analyses.map(analysis => {
                const counts = (analysis.findings ?? []).reduce((acc, f) => {
                  acc[f.riskLevel] = (acc[f.riskLevel] || 0) + 1
                  return acc
                }, {} as Record<string, number>)
                const isSelected = selectedAnalysisId === analysis.id

                return (
                  <button
                    key={analysis.id}
                    type="button"
                    onClick={() => setSelectedAnalysisId(analysis.id)}
                    className={`w-full flex items-center gap-4 p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{analysis.patient.name}</p>
                      <p className="text-xs text-gray-500">
                        {analysis.patient.code} · {new Date(analysis.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {Object.entries(counts).map(([level, count]) => (
                        <span key={level} className={`px-1.5 py-0.5 rounded text-xs font-medium ${riskColors[level] || 'bg-gray-100 text-gray-600'}`}>
                          {count}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Step 2: Report Type */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">2</span>
            Tipo de relatório
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {REPORT_TYPES.map(type => {
              const isSelected = selectedType === type.id
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedType(type.id)}
                  className={`relative flex flex-col gap-1 p-4 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {type.recommended && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                      Recomendado
                    </span>
                  )}
                  <div className="flex items-start gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                    }`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{type.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 pl-6">
                    <Coins className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-700">{type.cost} token{type.cost > 1 ? 's' : ''}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 3: Options */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">3</span>
            Opções
          </h2>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={isAnonymized}
              onChange={e => setIsAnonymized(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-blue-600"
            />
            <div>
              <div className="flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-gray-500" />
                <p className="text-sm font-medium text-gray-900">Anonimizar dados do paciente</p>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Nome e CPF serão substituídos pelo código do paciente. Recomendado para fins acadêmicos ou apresentações.
              </p>
            </div>
          </label>
        </div>

        {/* Summary & Confirm */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">4</span>
            Confirmar geração
          </h2>

          <div className="space-y-3">
            {/* Analysis preview */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Análise selecionada</span>
              {selectedAnalysis ? (
                <span className="text-sm font-medium text-gray-900">
                  {selectedAnalysis.patient.name} ({selectedAnalysis.patient.code})
                </span>
              ) : (
                <span className="text-sm text-gray-400 italic">Nenhuma selecionada</span>
              )}
            </div>

            {/* Type */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Tipo de relatório</span>
              <span className="text-sm font-medium text-gray-900">{selectedReportType.label}</span>
            </div>

            {/* Anonymized */}
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Anonimizado</span>
              <span className={`text-sm font-medium ${isAnonymized ? 'text-blue-600' : 'text-gray-500'}`}>
                {isAnonymized ? 'Sim' : 'Não'}
              </span>
            </div>

            {/* Cost */}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-500">Custo em tokens</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-amber-700">{selectedReportType.cost} token{selectedReportType.cost > 1 ? 's' : ''}</span>
                </div>
                {tokenBalance !== null && (
                  <span className={`text-xs ${hasEnoughTokens ? 'text-green-600' : 'text-red-600'}`}>
                    (saldo: {tokenBalance})
                  </span>
                )}
              </div>
            </div>
          </div>

          {!hasEnoughTokens && tokenBalance !== null && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-red-800">Saldo insuficiente</p>
                <p className="text-xs text-red-700 mt-0.5">
                  Você precisa de {selectedReportType.cost} tokens mas tem apenas {tokenBalance}.{' '}
                  <Link href="/tokens" className="underline">Adquira mais tokens</Link>.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-5">
            <Link
              href="/reports"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !selectedAnalysisId || !hasEnoughTokens}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Gerar relatório
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
