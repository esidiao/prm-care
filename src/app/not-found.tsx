import Link from 'next/link'
import { Pill, Home, ArrowLeft, Search } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-muted flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-800">
            <Pill className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-brand-800">PRM Care</span>
        </div>

        {/* 404 */}
        <div className="mb-6">
          <p className="text-8xl font-black text-gray-200 dark:text-gray-700 leading-none select-none">404</p>
          <h1 className="text-2xl font-bold text-foreground mt-2">Página não encontrada</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            A página que você está procurando não existe ou foi movida.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-800 text-white text-sm font-medium rounded-lg hover:bg-brand-900 transition-colors"
          >
            <Home className="w-4 h-4" />
            Ir para o painel
          </Link>
          <Link
            href="javascript:history.back()"
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-card text-foreground text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
        </div>

        {/* Quick links */}
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground mb-3">Links úteis</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/patients" className="text-brand-800 hover:underline">Pacientes</Link>
            <Link href="/analysis/new" className="text-brand-800 hover:underline">Nova análise</Link>
            <Link href="/reports" className="text-brand-800 hover:underline">Relatórios</Link>
            <Link href="/tokens" className="text-brand-800 hover:underline">Tokens</Link>
            <Link href="/settings" className="text-brand-800 hover:underline">Configurações</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
