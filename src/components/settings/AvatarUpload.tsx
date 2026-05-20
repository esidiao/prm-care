'use client'
import { useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Trash2, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface Props {
  currentImage: string | null | undefined
  userName: string | null | undefined
}

const MAX_DIMENSION = 256 // px — resized on canvas before upload

function resizeToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const size = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = MAX_DIMENSION
      canvas.height = MAX_DIMENSION
      const ctx = canvas.getContext('2d')!
      // Center-crop square
      const sx = (img.width - size) / 2
      const sy = (img.height - size) / 2
      ctx.drawImage(img, sx, sy, size, size, 0, 0, MAX_DIMENSION, MAX_DIMENSION)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao carregar imagem')) }
    img.src = url
  })
}

export function AvatarUpload({ currentImage, userName }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentImage ?? null)
  const [saving, setSaving] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const initials = (userName || '?')[0].toUpperCase()

  const upload = useCallback(async (dataURL: string | null) => {
    setSaving(true)
    try {
      const res = await fetch('/api/user/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataURL }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro desconhecido')
      }
      setPreview(dataURL)
      toast({
        title: dataURL ? 'Foto atualizada' : 'Foto removida',
        description: dataURL ? 'Sua foto de perfil foi salva.' : 'Foto de perfil removida.',
        variant: 'success',
      } as Parameters<typeof toast>[0])
      // Refresh server components so sidebar/topbar show the new image
      router.refresh()
    } catch (err) {
      toast({
        title: 'Erro ao salvar foto',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      } as Parameters<typeof toast>[0])
    } finally {
      setSaving(false)
    }
  }, [toast])

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Selecione uma imagem (JPG, PNG, WebP).', variant: 'destructive' } as Parameters<typeof toast>[0])
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande', description: 'Máximo 5 MB.', variant: 'destructive' } as Parameters<typeof toast>[0])
      return
    }
    const dataURL = await resizeToDataURL(file)
    await upload(dataURL)
  }, [upload, toast])

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await handleFile(file)
    e.target.value = ''
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) await handleFile(file)
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      {/* Avatar circle */}
      <div
        className={`relative flex-shrink-0 cursor-pointer group ${isDragging ? 'ring-2 ring-[#1e3a5f] ring-offset-2' : ''}`}
        onClick={() => !saving && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        title="Clique ou arraste uma foto"
      >
        <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-white dark:border-gray-700 shadow-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
          {preview ? (
            <img src={preview} alt="Foto de perfil" className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-white select-none">{initials}</span>
          )}
        </div>

        {/* Overlay on hover */}
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {saving ? (
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          ) : (
            <Camera className="h-6 w-6 text-white" />
          )}
        </div>

        {/* Camera badge */}
        {!saving && (
          <div className="absolute bottom-0.5 right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#1e3a5f] border-2 border-white dark:border-gray-800 shadow-md">
            <Camera className="h-3.5 w-3.5 text-white" />
          </div>
        )}
      </div>

      {/* Info + actions */}
      <div className="flex flex-col gap-2 text-center sm:text-left">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Foto de perfil</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            JPG, PNG ou WebP · Máx. 5 MB · Será recortada em círculo 256×256 px
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
          <button
            type="button"
            onClick={() => !saving && inputRef.current?.click()}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <Camera className="h-3.5 w-3.5" />
            {preview ? 'Alterar foto' : 'Adicionar foto'}
          </button>

          {preview && (
            <button
              type="button"
              onClick={() => upload(null)}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remover
            </button>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={handleChange}
        tabIndex={-1}
      />
    </div>
  )
}
