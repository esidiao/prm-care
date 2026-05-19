import Link from 'next/link'
import { Pill, Home, ArrowLeft, Search } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e3a5f]">
            <Pill className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-[#1e3a5f]">PRM Care</span>
        </div>

        {/* 404 */}
        <div className="mb-6">
          <p className="text-8xl font-black text-gray-200 leading-none select-none">404</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Página não encontrada</h1>
          <p className="text-gray-500 mt-2 text-sm">
            A página que você está procurando não existe ou foi movida.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1e3a5f] text-white text-sm font-medium rounded-lg hover:bg-[#162d4a] transition-colors"
          >
            <Home className="w-4 h-4" />
            Ir para o painel
          </Link>
          <Link
            href="javascript:history.back()"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
        </div>

        {/* Quick links */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400 mb-3">Links úteis</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/patients" className="text-[#1e3a5f] hover:underline">Pacientes</Link>
            <Link href="/analysis/new" className="text-[#1e3a5f] hover:underline">Nova análise</Link>
            <Link href="/reports" className="text-[#1e3a5f] hover:underline">Relatórios</Link>
            <Link href="/tokens" className="text-[#1e3a5f] hover:underline">Tokens</Link>
            <Link href="/settings" className="text-[#1e3a5f] hover:underline">Configurações</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
