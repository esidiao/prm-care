'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { ICD10_DATA } from '@/lib/icd10-data'
import type { ICD10Entry } from '@/lib/icd10-data'

// Remove acentos para busca insensível a acentuação
function sem(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function buscar(q: string): ICD10Entry[] {
  if (!q || q.trim().length < 2) return []
  const termo = sem(q.trim())
  const porCodigo: ICD10Entry[] = []
  const porDescricao: ICD10Entry[] = []
  for (const e of ICD10_DATA) {
    if (e.code.toLowerCase().startsWith(termo)) {
      porCodigo.push(e)
    } else if (sem(e.description).includes(termo)) {
      porDescricao.push(e)
    }
  }
  return [...porCodigo, ...porDescricao].slice(0, 10)
}

interface Props {
  nameValue: string
  codeValue: string
  onNameChange: (v: string) => void
  onCodeChange: (v: string) => void
  namePlaceholder?: string
  nameError?: string
}

export function ICD10Combobox({
  nameValue,
  codeValue,
  onNameChange,
  onCodeChange,
  namePlaceholder = 'Ex: Hipertensão arterial',
  nameError,
}: Props) {
  const [sugestoes, setSugestoes] = useState<ICD10Entry[]>([])
  const [aberto, setAberto] = useState(false)
  const [idx, setIdx] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Busca a cada digitação
  function handleDigitar(valor: string) {
    onNameChange(valor)
    const found = buscar(valor)
    setSugestoes(found)
    setAberto(found.length > 0)
    setIdx(-1)
  }

  // Seleciona uma sugestão
  function selecionar(e: ICD10Entry) {
    onNameChange(e.description)
    onCodeChange(e.code)
    setSugestoes([])
    setAberto(false)
    setIdx(-1)
  }

  // Navegação por teclado
  function handleTecla(e: React.KeyboardEvent) {
    if (!aberto) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, sugestoes.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); selecionar(sugestoes[idx]) }
    else if (e.key === 'Escape') setAberto(false)
  }

  // Fecha ao clicar fora
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  return (
    <div ref={wrapRef} className="relative flex gap-2 w-full">
      {/* Campo descrição */}
      <div className="relative flex-1">
        <input
          type="text"
          value={nameValue}
          onChange={e => handleDigitar(e.target.value)}
          onKeyDown={handleTecla}
          autoComplete="off"
          placeholder={namePlaceholder}
          className={`w-full pl-3 pr-8 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            nameError ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
          }`}
        />
        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 pointer-events-none" />

        {/* Dropdown */}
        {aberto && sugestoes.length > 0 && (
          <div className="absolute z-[100] top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
            {sugestoes.map((e, i) => (
              <button
                key={e.code}
                type="button"
                onMouseDown={ev => { ev.preventDefault(); selecionar(e) }}
                onMouseEnter={() => setIdx(i)}
                className={`w-full text-left px-3 py-2.5 flex items-start gap-3 border-b border-gray-50 last:border-0 transition-colors ${
                  i === idx ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <span className="shrink-0 font-mono text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 mt-0.5">
                  {e.code}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 leading-snug">{e.description}</p>
                  {e.category && <p className="text-[11px] text-gray-400 mt-0.5">{e.category}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Campo CID-10 */}
      <div className="relative w-28 shrink-0">
        <input
          type="text"
          value={codeValue}
          onChange={e => onCodeChange(e.target.value.toUpperCase())}
          placeholder="CID-10"
          maxLength={8}
          className="w-full pl-3 pr-7 py-2 border border-gray-300 bg-white rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {codeValue && (
          <button type="button" onClick={() => onCodeChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {nameError && (
        <p className="absolute -bottom-5 left-0 text-xs text-red-600">{nameError}</p>
      )}
    </div>
  )
}
