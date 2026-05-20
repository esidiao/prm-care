'use client'
import { useState, useEffect } from 'react'
import { Search, ExternalLink, Star, Clock, BookOpen, Pill, FlaskConical, Globe, Shield, Activity, X } from 'lucide-react'

// ── Bases de dados ─────────────────────────────────────────────────────────────

interface Database {
  id: string
  name: string
  description: string
  url: string
  searchUrl?: string // use {q} as placeholder
  category: string
  language: 'PT' | 'EN' | 'PT/EN'
  free: boolean
  tags: string[]
}

const DATABASES: Database[] = [
  // ── ANVISA / Brasil ───────────────────────────────────────────────────────
  {
    id: 'bulario',
    name: 'Bulário Eletrônico ANVISA',
    description: 'Bulas de medicamentos registrados no Brasil. Busca por nome comercial ou princípio ativo.',
    url: 'https://bula.anvisa.gov.br/',
    searchUrl: 'https://bula.anvisa.gov.br/consulta/detalhesDaConsulta?nomeProduto={q}',
    category: 'Bulas e Medicamentos',
    language: 'PT',
    free: true,
    tags: ['bula', 'anvisa', 'medicamentos', 'brasil'],
  },
  {
    id: 'anvisa-consultas',
    name: 'ANVISA — Consultas',
    description: 'Consulta de medicamentos, registros, recalls e alertas regulatórios da ANVISA.',
    url: 'https://consultas.anvisa.gov.br/',
    searchUrl: 'https://consultas.anvisa.gov.br/#/medicamentos/?nomeProduto={q}',
    category: 'Bulas e Medicamentos',
    language: 'PT',
    free: true,
    tags: ['anvisa', 'registro', 'recall', 'alerta'],
  },
  {
    id: 'rename',
    name: 'RENAME — Rename',
    description: 'Relação Nacional de Medicamentos Essenciais do Ministério da Saúde.',
    url: 'https://www.gov.br/saude/pt-br/assuntos/medicamentos/assistencia-farmaceutica/rename',
    category: 'Bulas e Medicamentos',
    language: 'PT',
    free: true,
    tags: ['medicamentos essenciais', 'SUS', 'ministério da saúde'],
  },
  {
    id: 'cfm-diretrizes',
    name: 'CFM — Diretrizes Clínicas',
    description: 'Diretrizes e protocolos clínicos do Conselho Federal de Medicina.',
    url: 'https://portal.cfm.org.br/diretrizes-e-protocolos/',
    category: 'Diretrizes e Protocolos',
    language: 'PT',
    free: true,
    tags: ['diretrizes', 'protocolos', 'CFM'],
  },
  {
    id: 'pcdt',
    name: 'PCDT — Protocolos Clínicos',
    description: 'Protocolos Clínicos e Diretrizes Terapêuticas do Ministério da Saúde.',
    url: 'https://www.gov.br/saude/pt-br/assuntos/protocolos-clinicos-e-diretrizes-terapeuticas-pcdt',
    category: 'Diretrizes e Protocolos',
    language: 'PT',
    free: true,
    tags: ['PCDT', 'protocolos', 'SUS', 'terapêutica'],
  },
  {
    id: 'cff',
    name: 'CFF — Conselho Federal de Farmácia',
    description: 'Resoluções, guias e publicações do Conselho Federal de Farmácia.',
    url: 'https://www.cff.org.br/',
    category: 'Diretrizes e Protocolos',
    language: 'PT',
    free: true,
    tags: ['CFF', 'farmácia', 'resoluções', 'guias'],
  },

  // ── Interações ────────────────────────────────────────────────────────────
  {
    id: 'drugs-interactions',
    name: 'Drugs.com — Interações',
    description: 'Verificador de interações medicamentosas com classificação de gravidade. Suporta múltiplos fármacos simultaneamente.',
    url: 'https://www.drugs.com/drug_interactions.html',
    searchUrl: 'https://www.drugs.com/interactions-check.php?drug_list={q}',
    category: 'Interações Medicamentosas',
    language: 'EN',
    free: true,
    tags: ['interações', 'drug interactions', 'gravidade'],
  },
  {
    id: 'medscape-interactions',
    name: 'Medscape — Drug Interactions',
    description: 'Banco de interações do Medscape com explicações clínicas e mecanismos de ação.',
    url: 'https://reference.medscape.com/drug-interactionchecker',
    category: 'Interações Medicamentosas',
    language: 'EN',
    free: true,
    tags: ['interações', 'medscape', 'mecanismo'],
  },
  {
    id: 'interacoes-cebrim',
    name: 'CEBRIM — Interações',
    description: 'Centro Brasileiro de Informação sobre Medicamentos — CFF. Consultas farmacêuticas especializadas.',
    url: 'https://www.cff.org.br/pagina.php?id=789',
    category: 'Interações Medicamentosas',
    language: 'PT',
    free: true,
    tags: ['CEBRIM', 'CFF', 'informação farmacêutica'],
  },

  // ── Referências clínicas ──────────────────────────────────────────────────
  {
    id: 'pubmed',
    name: 'PubMed / MEDLINE',
    description: 'Base de dados da literatura médica e farmacêutica com mais de 35 milhões de artigos científicos.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/',
    searchUrl: 'https://pubmed.ncbi.nlm.nih.gov/?term={q}',
    category: 'Literatura Científica',
    language: 'EN',
    free: true,
    tags: ['artigos', 'pesquisa', 'MEDLINE', 'evidências'],
  },
  {
    id: 'scielo',
    name: 'SciELO',
    description: 'Scientific Electronic Library Online — artigos científicos em português e espanhol.',
    url: 'https://www.scielo.br/',
    searchUrl: 'https://search.scielo.org/?q={q}&lang=pt',
    category: 'Literatura Científica',
    language: 'PT/EN',
    free: true,
    tags: ['artigos', 'português', 'brasil', 'scielo'],
  },
  {
    id: 'cochrane',
    name: 'Cochrane Library',
    description: 'Revisões sistemáticas e meta-análises de alta qualidade metodológica.',
    url: 'https://www.cochranelibrary.com/',
    searchUrl: 'https://www.cochranelibrary.com/search?searchText={q}',
    category: 'Literatura Científica',
    language: 'EN',
    free: true,
    tags: ['revisão sistemática', 'meta-análise', 'evidências', 'cochrane'],
  },

  // ── Calculadoras e doses ──────────────────────────────────────────────────
  {
    id: 'mdcalc',
    name: 'MDCalc',
    description: 'Calculadoras clínicas: CrCl, TFG, escores de risco, doses pediátricas e muito mais.',
    url: 'https://www.mdcalc.com/',
    searchUrl: 'https://www.mdcalc.com/search#q={q}',
    category: 'Calculadoras Clínicas',
    language: 'EN',
    free: true,
    tags: ['calculadora', 'CrCl', 'TFG', 'escore', 'dose'],
  },
  {
    id: 'globalrph',
    name: 'GlobalRPh — Dose Calculator',
    description: 'Calculadoras de ajuste de dose renal/hepática, monitoramento de fármacos (TDM) e conversão de doses.',
    url: 'https://globalrph.com/',
    category: 'Calculadoras Clínicas',
    language: 'EN',
    free: true,
    tags: ['ajuste renal', 'dose', 'TDM', 'farmácia'],
  },
  {
    id: 'epocrates',
    name: 'Epocrates Online',
    description: 'Referência de medicamentos com doses, interações e informações clínicas resumidas.',
    url: 'https://online.epocrates.com/',
    searchUrl: 'https://online.epocrates.com/drugs/{q}',
    category: 'Calculadoras Clínicas',
    language: 'EN',
    free: true,
    tags: ['dose', 'referência', 'clínica', 'fármaco'],
  },

  // ── Segurança e vigilância ────────────────────────────────────────────────
  {
    id: 'vigimedas',
    name: 'VigiMedas — ANVISA',
    description: 'Sistema de notificação de eventos adversos e queixas técnicas de medicamentos da ANVISA.',
    url: 'https://www.gov.br/anvisa/pt-br/assuntos/farmacovigilancia/notificacoes',
    category: 'Farmacovigilância',
    language: 'PT',
    free: true,
    tags: ['evento adverso', 'farmacovigilância', 'notificação', 'anvisa'],
  },
  {
    id: 'who-essential',
    name: 'OMS — Lista de Medicamentos Essenciais',
    description: 'Lista de medicamentos essenciais da Organização Mundial da Saúde (WHO EML).',
    url: 'https://www.who.int/groups/expert-committee-on-selection-and-use-of-essential-medicines/essential-medicines-lists',
    category: 'Farmacovigilância',
    language: 'EN',
    free: true,
    tags: ['OMS', 'WHO', 'medicamentos essenciais', 'global'],
  },
  {
    id: 'fda-safety',
    name: 'FDA — Drug Safety',
    description: 'Alertas de segurança, recalls e comunicados da FDA norte-americana.',
    url: 'https://www.fda.gov/drugs/drug-safety-and-availability',
    searchUrl: 'https://www.fda.gov/search?s={q}&source=drugs',
    category: 'Farmacovigilância',
    language: 'EN',
    free: true,
    tags: ['FDA', 'recall', 'alerta', 'segurança'],
  },

  // ── Especializados ────────────────────────────────────────────────────────
  {
    id: 'dailymed',
    name: 'DailyMed — NIH',
    description: 'Bulas oficiais norte-americanas aprovadas pela FDA, com informações completas de prescrição.',
    url: 'https://dailymed.nlm.nih.gov/',
    searchUrl: 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query={q}',
    category: 'Bulas e Medicamentos',
    language: 'EN',
    free: true,
    tags: ['bula', 'FDA', 'NIH', 'prescrição'],
  },
  {
    id: 'cdc-guidelines',
    name: 'CDC — Diretrizes',
    description: 'Diretrizes clínicas do Centers for Disease Control — infecções, vacinas e saúde pública.',
    url: 'https://www.cdc.gov/guidelines/',
    category: 'Diretrizes e Protocolos',
    language: 'EN',
    free: true,
    tags: ['CDC', 'diretrizes', 'infecção', 'vacina'],
  },
]

const CATEGORIES = Array.from(new Set(DATABASES.map(d => d.category)))

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  'Bulas e Medicamentos': Pill,
  'Interações Medicamentosas': Shield,
  'Literatura Científica': BookOpen,
  'Calculadoras Clínicas': FlaskConical,
  'Farmacovigilância': Activity,
  'Diretrizes e Protocolos': Globe,
}

const CATEGORY_COLORS: Record<string, string> = {
  'Bulas e Medicamentos':     'text-blue-600 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
  'Interações Medicamentosas':'text-red-600 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
  'Literatura Científica':    'text-purple-600 bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800',
  'Calculadoras Clínicas':    'text-teal-600 bg-teal-50 dark:bg-teal-950 border-teal-200 dark:border-teal-800',
  'Farmacovigilância':        'text-orange-600 bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800',
  'Diretrizes e Protocolos':  'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800',
}

const RECENT_KEY = 'prm-recent-resources'

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}
function addRecent(id: string) {
  try {
    const list = getRecent().filter(x => x !== id)
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...list].slice(0, 6)))
  } catch {}
}
function getFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem('prm-fav-resources') ?? '[]') } catch { return [] }
}
function toggleFavorite(id: string): string[] {
  const favs = getFavorites()
  const next = favs.includes(id) ? favs.filter(f => f !== id) : [id, ...favs]
  try { localStorage.setItem('prm-fav-resources', JSON.stringify(next)) } catch {}
  return next
}

// ── Database Card ─────────────────────────────────────────────────────────────

function DbCard({
  db,
  isFav,
  onToggleFav,
  searchTerm,
}: {
  db: Database
  isFav: boolean
  onToggleFav: (id: string) => void
  searchTerm: string
}) {
  const Icon = CATEGORY_ICONS[db.category] ?? Globe
  const colorClass = CATEGORY_COLORS[db.category] ?? 'text-gray-600 bg-gray-50'

  const handleOpen = (url: string) => {
    addRecent(db.id)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const searchUrl = searchTerm && db.searchUrl
    ? db.searchUrl.replace('{q}', encodeURIComponent(searchTerm))
    : null

  return (
    <div className="group flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">{db.name}</p>
            <button
              onClick={() => onToggleFav(db.id)}
              className={`flex-shrink-0 transition-colors ${isFav ? 'text-amber-500' : 'text-gray-200 dark:text-gray-700 hover:text-amber-400'}`}
              title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <Star className="h-3.5 w-3.5" fill={isFav ? 'currentColor' : 'none'} />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${colorClass}`}>
              {db.category}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              db.language === 'PT' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : db.language === 'EN' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
            }`}>
              {db.language}
            </span>
            {db.free && (
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-medium">
                Gratuito
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="px-4 pb-3 text-xs text-gray-500 dark:text-gray-400 flex-1 leading-relaxed">
        {db.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 px-4 pb-3">
        {db.tags.slice(0, 4).map(t => (
          <span key={t} className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[10px] text-gray-500 dark:text-gray-400">
            {t}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-gray-100 dark:border-gray-700 p-3">
        <button
          onClick={() => handleOpen(db.url)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Acessar
        </button>
        {searchUrl && (
          <button
            onClick={() => handleOpen(searchUrl)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#16304f] transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            Buscar "{searchTerm.slice(0, 12)}{searchTerm.length > 12 ? '…' : ''}"
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  const [q, setQ] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterLang, setFilterLang] = useState('')
  const [favorites, setFavorites] = useState<string[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const [showOnlyFav, setShowOnlyFav] = useState(false)

  useEffect(() => {
    setFavorites(getFavorites())
    setRecent(getRecent())
  }, [])

  const handleToggleFav = (id: string) => {
    const next = toggleFavorite(id)
    setFavorites(next)
  }

  const handleOpen = (id: string) => {
    addRecent(id)
    setRecent(getRecent())
  }

  const filtered = DATABASES.filter(db => {
    if (showOnlyFav && !favorites.includes(db.id)) return false
    if (filterCategory && db.category !== filterCategory) return false
    if (filterLang && db.language !== filterLang) return false
    if (q) {
      const lower = q.toLowerCase()
      return (
        db.name.toLowerCase().includes(lower) ||
        db.description.toLowerCase().includes(lower) ||
        db.tags.some(t => t.toLowerCase().includes(lower))
      )
    }
    return true
  })

  const recentDbs = recent.map(id => DATABASES.find(d => d.id === id)).filter(Boolean) as Database[]
  const favDbs = DATABASES.filter(d => favorites.includes(d.id))

  // Group by category
  const grouped: Record<string, Database[]> = {}
  for (const db of filtered) {
    if (!grouped[db.category]) grouped[db.category] = []
    grouped[db.category].push(db)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bases de Dados Clínicas</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {DATABASES.length} fontes farmacêuticas e clínicas de referência — acesso direto e busca integrada
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Digite um medicamento, patologia ou tema para buscar em todas as bases…"
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-12 pr-12 py-3.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 shadow-sm"
        />
        {q && (
          <button
            onClick={() => setQ('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {q && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-4 py-2.5 text-sm text-blue-700 dark:text-blue-300">
          💡 Clique em <strong>"Buscar"</strong> em qualquer base para pesquisar <strong>"{q}"</strong> diretamente nela
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#1e3a5f] focus:outline-none"
        >
          <option value="">Todas as categorias</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={filterLang}
          onChange={e => setFilterLang(e.target.value)}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#1e3a5f] focus:outline-none"
        >
          <option value="">Todos os idiomas</option>
          <option value="PT">🇧🇷 Português</option>
          <option value="EN">🇺🇸 Inglês</option>
          <option value="PT/EN">PT/EN</option>
        </select>

        <button
          onClick={() => setShowOnlyFav(f => !f)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            showOnlyFav
              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
              : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <Star className="h-3.5 w-3.5" fill={showOnlyFav ? 'currentColor' : 'none'} />
          Favoritos {favDbs.length > 0 && `(${favDbs.length})`}
        </button>

        {(filterCategory || filterLang || showOnlyFav) && (
          <button
            onClick={() => { setFilterCategory(''); setFilterLang(''); setShowOnlyFav(false) }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-3.5 w-3.5" /> Limpar filtros
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
          {filtered.length} de {DATABASES.length} bases
        </span>
      </div>

      {/* Recent */}
      {recentDbs.length > 0 && !q && !filterCategory && !showOnlyFav && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Acessadas recentemente</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentDbs.map(db => {
              const Icon = CATEGORY_ICONS[db.category] ?? Globe
              return (
                <button
                  key={db.id}
                  onClick={() => { addRecent(db.id); setRecent(getRecent()); window.open(db.url, '_blank', 'noopener,noreferrer') }}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                >
                  <Icon className="h-3.5 w-3.5 text-gray-400" />
                  {db.name}
                  <ExternalLink className="h-3 w-3 text-gray-300" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Category groups */}
      {Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-16 text-center">
          <Search className="h-10 w-10 text-gray-200 dark:text-gray-700 mb-3" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nenhuma base encontrada</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Tente outros termos ou limpe os filtros</p>
        </div>
      ) : (
        Object.entries(grouped).map(([category, dbs]) => {
          const Icon = CATEGORY_ICONS[category] ?? Globe
          const colorClass = CATEGORY_COLORS[category] ?? ''
          return (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`flex h-6 w-6 items-center justify-center rounded-lg border ${colorClass}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">{category}</h2>
                <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  {dbs.length}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dbs.map(db => (
                  <DbCard
                    key={db.id}
                    db={db}
                    isFav={favorites.includes(db.id)}
                    onToggleFav={handleToggleFav}
                    searchTerm={q}
                  />
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
