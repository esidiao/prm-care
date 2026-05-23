'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Coins, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2, Clock, Loader2, ShoppingCart, XCircle } from 'lucide-react'
import { formatDateTime, formatCurrency } from '@/lib/utils'

interface TokenPackage {
  id: string
  name: string
  description: string | null
  tokens: number
  priceInCents: number
  currency: string
  isFeatured: boolean
  sortOrder: number
}

interface TokenTransaction {
  id: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  type: string
  description: string | null
  createdAt: string
}

function StatusBanner({ status }: { status: string | null }) {
  if (!status) return null

  if (status === 'success') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-800">Pagamento aprovado!</p>
          <p className="text-xs text-green-700 mt-0.5">Seus tokens foram creditados. O saldo será atualizado em instantes.</p>
        </div>
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Pagamento em processamento</p>
          <p className="text-xs text-amber-700 mt-0.5">Seu pagamento está sendo processado. Os tokens serão creditados assim que confirmado.</p>
        </div>
      </div>
    )
  }

  if (status === 'failure') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-800">Pagamento não realizado</p>
          <p className="text-xs text-red-700 mt-0.5">O pagamento foi cancelado ou recusado. Tente novamente ou escolha outra forma de pagamento.</p>
        </div>
      </div>
    )
  }

  return null
}

export default function TokensPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const status = searchParams.get('status')

  const [packages, setPackages] = useState<TokenPackage[]>([])
  const [history, setHistory] = useState<TokenTransaction[]>([])
  const [loadingPackages, setLoadingPackages] = useState(true)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)

  useEffect(() => {
    setLoadingPackages(true)
    Promise.all([
      fetch('/api/payments/packages').then(r => r.json()),
      fetch('/api/tokens/history').then(r => r.json()),
    ]).then(([pkg, hist]) => {
      setPackages(pkg.data || [])
      setHistory(hist.data || [])
      setLoadingPackages(false)
    }).catch(() => setLoadingPackages(false))
  }, [])

  async function handleCheckout(pkg: TokenPackage) {
    if (checkingOut) return
    setCheckingOut(pkg.id)
    try {
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkg.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao iniciar checkout')
      window.location.href = data.initPoint
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao processar. Tente novamente.'
      alert(message)
      setCheckingOut(null)
    }
  }

  const balance = session?.user?.tokenBalance ?? 0

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="text-2xl font-bold text-gray-900">Tokens e créditos</h1>
        <p className="text-gray-500">Gerencie seu saldo e histórico de uso</p>
      </div>

      <StatusBanner status={status} />

      {/* Balance */}
      <div className="rounded-xl border bg-[#1e3a5f] p-6 text-white shadow-sm">
        <p className="text-blue-200 text-sm mb-1">Saldo atual</p>
        <div className="flex items-end gap-3">
          <span className="text-5xl font-bold tabular-nums">{balance}</span>
          <span className="text-blue-300 mb-2">tokens</span>
        </div>
        {balance <= 3 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/20 border border-red-400/30 p-2.5 text-sm text-red-200">
            <AlertTriangle className="h-4 w-4" />
            Saldo baixo — recarregue para continuar as análises
          </div>
        )}
      </div>

      {/* Token cost reference */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-4">Custo por operação</h2>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Análise básica (≤ 3 medicamentos)', cost: 1 },
            { label: 'Análise completa (≤ 10 medicamentos)', cost: 3 },
            { label: 'Análise avançada (com exames)', cost: 5 },
            { label: 'Relatório PDF simples', cost: 2 },
            { label: 'Reanálise', cost: 1 },
            { label: 'Relatório institucional', cost: 5 },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5">
              <span className="text-sm text-gray-600">{item.label}</span>
              <div className="flex items-center gap-1 font-semibold text-[#1e3a5f]">
                <Coins className="h-3.5 w-3.5" /> {item.cost}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Packages */}
      <div>
        <h2 className="mb-4 text-lg font-bold text-gray-900">Comprar tokens</h2>
        {loadingPackages ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-xl border-2 border-gray-100 bg-white p-5 animate-pulse">
                <div className="h-8 w-16 bg-gray-100 rounded mb-2" />
                <div className="h-4 w-24 bg-gray-100 rounded mb-4" />
                <div className="h-6 w-20 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {packages.map((pkg) => {
              const isLoading = checkingOut === pkg.id
              return (
                <div
                  key={pkg.id}
                  className={`rounded-xl border-2 p-5 shadow-sm transition-all ${
                    pkg.isFeatured
                      ? 'border-[#1e3a5f] bg-[#eff6ff]'
                      : 'border-gray-200 bg-white hover:border-[#1e3a5f]'
                  }`}
                >
                  {pkg.isFeatured && (
                    <span className="mb-2 inline-block rounded-full bg-[#1e3a5f] px-2.5 py-0.5 text-xs font-bold text-white">
                      Recomendado
                    </span>
                  )}
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-3xl font-bold text-[#1e3a5f]">{pkg.tokens}</span>
                    <span className="text-gray-500 mb-0.5">tokens</span>
                  </div>
                  <p className="font-semibold text-gray-900">{pkg.name}</p>
                  {pkg.description && (
                    <p className="text-xs text-gray-500 mt-1">{pkg.description}</p>
                  )}
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(pkg.priceInCents)}</p>
                    <p className="text-xs text-gray-400">
                      {formatCurrency(Math.round(pkg.priceInCents / pkg.tokens))} por token
                    </p>
                  </div>
                  <button
                    onClick={() => handleCheckout(pkg)}
                    disabled={checkingOut !== null}
                    className={`mt-3 w-full rounded-lg py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                      pkg.isFeatured
                        ? 'bg-[#1e3a5f] text-white hover:bg-[#162d4a]'
                        : 'bg-gray-100 text-gray-900 hover:bg-[#1e3a5f] hover:text-white'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4" />
                        Comprar
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <ShoppingCart className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Pagamento seguro via Mercado Pago</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Aceitamos cartão de crédito, débito, Pix e boleto. Você será redirecionado ao checkout seguro do Mercado Pago.
            </p>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="rounded-xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold text-gray-900">Histórico de transações</h2>
        </div>
        {history.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">Nenhuma transação encontrada</div>
        ) : (
          <div className="divide-y">
            {history.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className={`rounded-full p-2 ${tx.amount > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    {tx.amount > 0
                      ? <TrendingUp className="h-4 w-4 text-green-600" />
                      : <TrendingDown className="h-4 w-4 text-red-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tx.description ?? tx.type}</p>
                    <p className="text-xs text-gray-400">{formatDateTime(tx.createdAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount} tokens
                  </p>
                  <p className="text-xs text-gray-400">Saldo: {tx.balanceAfter}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
