'use client'
import { useState } from 'react'
import { Dna, Search, X, Plus } from 'lucide-react'
import { pgxForDrugs, type PgxGuideline } from '@/lib/pgx'

export default function PharmacogenomicsPage() {
  const [input, setInput] = useState('')
  const [drugs, setDrugs] = useState<string[]>([])
  const [results, setResults] = useState<PgxGuideline[] | null>(null)

  const add = () => { const v = input.trim(); if (v && !drugs.includes(v)) setDrugs([...drugs, v]); setInput('') }
  const remove = (i: number) => setDrugs(drugs.filter((_, x) => x !== i))
  const search = () => setResults(pgxForDrugs(drugs))

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800"><Dna className="h-6 w-6 text-[#2c7a7b]" /> Farmacogenômica (CPIC)</h1>
      <p className="mt-1 text-sm text-slate-500">Verifique associações gene–medicamento com orientação baseada nas diretrizes públicas da CPIC. Apoio à decisão — não substitui aconselhamento genético nem a avaliação clínica.</p>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder="Medicamento (ex.: clopidogrel, codeína, varfarina) e Enter"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />
          <button onClick={add} className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"><Plus className="h-4 w-4" /> Adicionar</button>
        </div>
        {drugs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {drugs.map((d, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-800">{d}<button onClick={() => remove(i)} className="text-teal-500 hover:text-teal-700"><X className="h-3.5 w-3.5" /></button></span>
            ))}
          </div>
        )}
        <button onClick={search} disabled={drugs.length === 0} className="mt-4 flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Search className="h-4 w-4" /> Verificar farmacogenômica</button>
      </div>

      {results && (
        <div className="mt-6 space-y-3">
          {results.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              Nenhuma diretriz farmacogenética CPIC na base para os medicamentos informados. Ausência de diretriz na base não significa ausência de relevância — consulte fontes atualizadas se houver suspeita clínica.
            </div>
          ) : results.map((g, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">{g.gene}</span>
                <span className="font-semibold text-slate-800">{g.drugLabel}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">CPIC nível {g.level}</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{g.summary}</p>
              <p className="mt-1 text-xs text-slate-500"><b>Teste:</b> {g.test}</p>
              <div className="mt-3 space-y-1.5">
                {g.recommendations.map((r, j) => (
                  <div key={j} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-semibold text-slate-700">{r.phenotype}: </span><span className="text-slate-700">{r.action}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {results.length > 0 && (
            <p className="rounded-lg bg-teal-50 px-4 py-3 text-xs leading-relaxed text-teal-900">
              Resumos das diretrizes CPIC (cpicpgx.org) — confira a versão vigente. Apoio à decisão; a conduta final cabe ao farmacêutico/prescritor, considerando o genótipo/fenótipo real do paciente, exames, comorbidades e contexto clínico. Não substitui aconselhamento genético.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
