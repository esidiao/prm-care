'use client'
import { useState } from 'react'
import { Shield, Download, Trash2, FileText, Lock, Clock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { ExportWithWarning } from '@/components/export/ExportWithWarning'

export default function MyDataPage() {
  const [deletionReason, setDeletionReason]   = useState('')
  const [sendingDeletion, setSendingDeletion] = useState(false)
  const [deletionSent, setDeletionSent]       = useState(false)
  const [deletionError, setDeletionError]     = useState('')

  const requestDeletion = async () => {
    if (!deletionReason.trim()) return
    setSendingDeletion(true)
    setDeletionError('')
    try {
      const res = await fetch('/api/user/my-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deletionReason }),
      })
      if (res.ok) {
        setDeletionSent(true)
      } else {
        setDeletionError('Erro ao enviar solicitação. Tente novamente.')
      }
    } catch {
      setDeletionError('Erro de conexão. Tente novamente.')
    } finally {
      setSendingDeletion(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Meus Dados — LGPD</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Seus direitos como titular de dados pessoais (Lei 13.709/2018)
        </p>
      </div>

      {/* Direitos */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-[#1e3a5f]" />
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Seus direitos garantidos pela LGPD</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: FileText, label: 'Acesso', desc: 'Você pode consultar todos os seus dados a qualquer momento', art: 'Art. 18, I' },
            { icon: Download, label: 'Portabilidade', desc: 'Exporte uma cópia completa dos seus dados em formato legível', art: 'Art. 18, V' },
            { icon: Lock, label: 'Retificação', desc: 'Corrija dados incompletos ou incorretos no seu perfil', art: 'Art. 18, III' },
            { icon: Trash2, label: 'Exclusão', desc: 'Solicite a exclusão dos seus dados pessoais', art: 'Art. 18, VI' },
          ].map(({ icon: Icon, label, desc, art }) => (
            <div key={label} className="flex items-start gap-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                <Icon className="h-4 w-4 text-[#1e3a5f]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                <p className="text-[10px] text-[#1e3a5f] mt-0.5 font-medium">{art}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exportar dados */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Download className="h-4 w-4 text-emerald-600" />
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Portabilidade — Exportar meus dados</h2>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Baixe um arquivo JSON com todos os seus dados: perfil, consentimentos, histórico de análises e log de acessos.
          Os dados de pacientes não são incluídos para proteger a privacidade deles.
        </p>
        <ExportWithWarning
          href="/api/user/my-data"
          label="Exportar meus dados (JSON)"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
        />
      </div>

      {/* Informações sobre retenção */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-blue-600" />
          <h2 className="font-semibold text-blue-900 dark:text-blue-300 text-sm">Retenção de dados</h2>
        </div>
        <div className="space-y-2 text-xs text-blue-800 dark:text-blue-400">
          <p>• <strong>Dados de perfil:</strong> mantidos enquanto a conta estiver ativa</p>
          <p>• <strong>Dados clínicos de pacientes:</strong> mínimo de 5 anos após o último atendimento (CFM e CFF)</p>
          <p>• <strong>Logs de auditoria:</strong> retidos por 2 anos para fins de segurança e conformidade</p>
          <p>• <strong>Após exclusão da conta:</strong> dados de saúde são anonimizados, não excluídos, para cumprir obrigações legais</p>
        </div>
      </div>

      {/* Solicitar exclusão */}
      <div className="rounded-xl border border-red-200 bg-white dark:bg-gray-800 dark:border-red-900 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Trash2 className="h-4 w-4 text-red-600" />
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Solicitar exclusão de dados</h2>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
          Ao solicitar a exclusão, sua conta e dados pessoais serão removidos em até <strong>15 dias úteis</strong>.
          Dados clínicos de pacientes serão anonimizados para cumprir obrigações legais de retenção (CFF/CFM).
        </p>

        {deletionSent ? (
          <div className="flex items-start gap-3 rounded-xl bg-green-50 border border-green-200 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800">Solicitação registrada</p>
              <p className="text-xs text-green-700 mt-0.5">
                Você receberá uma confirmação por e-mail. O prazo de processamento é de até 15 dias úteis.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Motivo da solicitação <span className="text-red-500">*</span>
              </label>
              <textarea
                value={deletionReason}
                onChange={e => setDeletionReason(e.target.value)}
                placeholder="Ex: Não utilizo mais o serviço / Desejo encerrar minha conta…"
                rows={3}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
              />
            </div>

            {deletionError && (
              <p className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" /> {deletionError}
              </p>
            )}

            <button
              onClick={requestDeletion}
              disabled={!deletionReason.trim() || sendingDeletion}
              className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sendingDeletion
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</>
                : <><Trash2 className="h-4 w-4" /> Solicitar exclusão de dados</>
              }
            </button>
          </div>
        )}
      </div>

      {/* Contato DPO */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-xs text-gray-500 dark:text-gray-400">
        <p><strong className="text-gray-700 dark:text-gray-300">Encarregado de Dados (DPO):</strong> Para dúvidas sobre privacidade e proteção de dados, entre em contato pelo e-mail <span className="text-[#1e3a5f] dark:text-blue-400">privacidade@prmcare.com.br</span></p>
        <p className="mt-1">Referência legal: Lei Geral de Proteção de Dados Pessoais — Lei nº 13.709, de 14 de agosto de 2018.</p>
      </div>
    </div>
  )
}
