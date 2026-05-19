'use client'

import { useState, useEffect } from 'react'
import {
  Coins, Plus, Pencil, CheckCircle, XCircle, Star,
  Loader2, AlertTriangle, Check, X, ArrowUpDown, Hash
} from 'lucide-react'

interface TokenPackage {
  id: string
  name: string
  description: string | null
  tokens: number
  priceInCents: number
  currency: string
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  _count: { transactions: number }
}

const emptyForm = {
  name: '',
  description: '',
  tokens: '',
  priceInCents: '',
  currency: 'BRL',
  isActive: true,
  isFeatured: false,
  sortOrder: 0,
}

export default function AdminTokensPage() {
  const [packages, setPackages] = useState<TokenPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<typeof emptyForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchPackages = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tokens')
      const json = await res.json()
      if (json.success) setPackages(json.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPackages() }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (pkg: TokenPackage) => {
    setEditingId(pkg.id)
    setForm({
      name: pkg.name,
      description: pkg.description || '',
      tokens: String(pkg.tokens),
      priceInCents: String(pkg.priceInCents),
      currency: pkg.currency,
      isActive: pkg.isActive,
      isFeatured: pkg.isFeatured,
      sortOrder: pkg.sortOrder,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setFeedback(null)
    try {
      const body = {
        ...(editingId && { id: editingId }),
        name: form.name,
        description: form.description || undefined,
        tokens: parseInt(String(form.tokens)),
        priceInCents: parseInt(String(form.priceInCents)),
        currency: form.currency,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        sortOrder: Number(form.sortOrder),
      }

      const res = await fetch('/api/admin/tokens', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar')

      setFeedback({ type: 'success', message: editingId ? 'Pacote atualizado.' : 'Pacote criado.' })
      setShowForm(false)
      fetchPackages()
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (id: string) => {
    if (!confirm('Desativar este pacote? Ele não aparecerá mais para compra.')) return
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setFeedback({ type: 'success', message: 'Pacote desativado.' })
        fetchPackages()
      }
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao desativar.' })
    }
  }

  const formatPrice = (cents: number, currency: string) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(cents / 100)
  }

  const pricePerToken = (pkg: TokenPackage) =>
    (pkg.priceInCents / pkg.tokens / 100).toFixed(2)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Coins className="w-6 h-6 text-amber-500" />
            Pacotes de Tokens
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerencie os pacotes de créditos disponíveis para compra</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo pacote
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {feedback.message}
          <button onClick={() => setFeedback(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Packages grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map(pkg => (
            <div
              key={pkg.id}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
                pkg.isFeatured ? 'border-amber-400 ring-1 ring-amber-300' : 'border-gray-200'
              } ${!pkg.isActive ? 'opacity-60' : ''}`}
            >
              {pkg.isFeatured && (
                <div className="bg-amber-500 text-white text-xs font-semibold text-center py-1 flex items-center justify-center gap-1">
                  <Star className="w-3 h-3" /> Destaque
                </div>
              )}

              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                    {pkg.description && <p className="text-xs text-gray-500 mt-0.5">{pkg.description}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                    pkg.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {pkg.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-500" />
                    <span className="text-2xl font-bold text-gray-900">{pkg.tokens.toLocaleString()}</span>
                    <span className="text-gray-500 text-sm">tokens</span>
                  </div>

                  <div className="text-2xl font-bold text-blue-600">
                    {formatPrice(pkg.priceInCents, pkg.currency)}
                    <span className="text-sm font-normal text-gray-400 ml-1">
                      = R$ {pricePerToken(pkg)}/token
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    Ordem: {pkg.sortOrder}
                  </span>
                  <span className="flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3" />
                    {pkg._count.transactions} transação{pkg._count.transactions !== 1 ? 'ões' : ''}
                  </span>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => openEdit(pkg)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  {pkg.isActive && (
                    <button
                      onClick={() => handleDeactivate(pkg.id)}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Empty state */}
          {packages.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <Coins className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum pacote cadastrado.</p>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                {editingId ? 'Editar pacote' : 'Novo pacote de tokens'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Pacote Básico"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Descrição opcional"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tokens <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.tokens}
                    onChange={e => setForm(f => ({ ...f, tokens: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: 50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preço (centavos) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.priceInCents}
                    onChange={e => setForm(f => ({ ...f, priceInCents: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: 4990 = R$ 49,90"
                  />
                  {form.priceInCents && (
                    <p className="text-xs text-gray-400 mt-1">
                      = {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(form.priceInCents) / 100)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Moeda</label>
                  <select
                    value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="BRL">BRL (R$)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ordem</label>
                  <input
                    type="number"
                    min="0"
                    value={form.sortOrder}
                    onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  Ativo
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={e => setForm(f => ({ ...f, isFeatured: e.target.checked }))}
                    className="rounded border-gray-300 text-amber-500"
                  />
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  Destaque
                </label>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-200">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.tokens || !form.priceInCents}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
