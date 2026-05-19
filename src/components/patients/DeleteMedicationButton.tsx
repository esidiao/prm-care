'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'

export function DeleteMedicationButton({ medicationId, medicationName }: { medicationId: string; medicationName: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm(`Excluir "${medicationName}"? Esta ação não pode ser desfeita.`)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/medications/${medicationId}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        alert('Erro ao excluir medicamento. Tente novamente.')
      }
    } catch {
      alert('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      title="Excluir medicamento"
      className="ml-2 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  )
}
