import fs from 'node:fs'
const DIR = 'scripts/ddi'
const norm = s => String(s||'').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g,'')

// 1) Cumulative EN->PT dictionary
const en2pt = {}
// map_base is PT->EN (invert; skip empty EN)
const base = JSON.parse(fs.readFileSync(`${DIR}/map_base.json`,'utf8'))
for (const [pt, en] of Object.entries(base)) { if (en && pt) en2pt[norm(en)] = pt }
// map_top450 + n0..n5 are EN->PT (skip empty PT)
const files = ['map_top450.json','n0out.json','n1out.json','n2out.json','n3out.json','n4out.json','n5out.json']
for (const f of files) {
  const m = JSON.parse(fs.readFileSync(`${DIR}/${f}`,'utf8'))
  for (const [en, pt] of Object.entries(m)) { if (en && pt) en2pt[norm(en)] = pt }
}
console.log('Universo PT mapeado (DCI EN distintas):', Object.keys(en2pt).length)

// 2) Parse DDInter CSVs and build deduped pair set (max severity)
const SEVRANK = { major:3, moderate:2, minor:1 }
const RANKSEV = { 3:'major', 2:'moderate', 1:'minor' }
const pairs = new Map() // sortedPtKey -> rank
let lines=0, knownSev=0, inUniverse=0
for (const c of ['A','B','D','H','L','P','R','V']) {
  const txt = fs.readFileSync(`${DIR}/csv/${c}.csv`,'utf8')
  const L = txt.split('\n')
  for (let i=1;i<L.length;i++) {
    const x = L[i].split(',')
    if (x.length<5) continue
    lines++
    const sev = x[4].trim()
    if (!SEVRANK[sev.toLowerCase()]) continue
    knownSev++
    const a = en2pt[norm(x[1])], b = en2pt[norm(x[3])]
    if (!a || !b) continue
    const na = norm(a), nb = norm(b)
    if (na === nb) continue
    inUniverse++
    const key = [na, nb].sort().join('|')
    const rank = SEVRANK[sev.toLowerCase()]
    const prev = pairs.get(key)
    if (!prev) pairs.set(key, { a, b, na, nb, rank })
    else if (rank > prev.rank) pairs.set(key, { a, b, na, nb, rank })
  }
}
console.log('Linhas DDInter:', lines, '| com gravidade:', knownSev, '| no universo:', inUniverse, '| pares únicos:', pairs.size)

// 3) Emit ddi-external.ts (use PT canonical names, lowercase no-accents already)
const sorted = [...pairs.values()].sort((p,q)=> p.na===q.na ? p.nb.localeCompare(q.nb) : p.na.localeCompare(q.na))
let major=0,moderate=0,minor=0
const rows = sorted.map(p => {
  const sev = RANKSEV[p.rank]
  if (sev==='major') major++; else if (sev==='moderate') moderate++; else minor++
  return `[${JSON.stringify(p.a)},${JSON.stringify(p.b)},${JSON.stringify(sev)}]`
})
const header = `// ARQUIVO GERADO AUTOMATICAMENTE — não editar à mão.
// Fonte: DDInter 2.0 (http://ddinter2.scbdd.com) — Licença CC BY-NC-SA 4.0.
// Atribuição: Xiong G. et al. DDInter (2022). Uso não-comercial/assistencial, ShareAlike.
// Reconstruível via: node scripts/ddi/build.mjs  (mapas PT/EN em scripts/ddi/*.json)
// Pares: ${pairs.size} (major=${major} / moderate=${moderate} / minor=${minor}).

export type ExternalPair = [string, string, 'major' | 'moderate' | 'minor']
export const EXTERNAL_SOURCE = 'DDInter (CC BY-NC-SA 4.0)'
export const EXTERNAL_INTERACTIONS: ExternalPair[] = [
${rows.join(',\n')}
]
`
fs.writeFileSync('src/lib/ddi-external.ts', header)
console.log('GERADO src/lib/ddi-external.ts —', pairs.size, 'pares | major', major, 'moderate', moderate, 'minor', minor)
