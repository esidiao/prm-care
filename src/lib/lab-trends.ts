/**
 * Monitoramento temporal de exames — detecta PIORA/tendência entre as duas medidas
 * mais recentes de cada analito, para re-alertar o farmacêutico (vigilância contínua).
 * Determinístico, sem dependências externas. Apoio à decisão.
 */
export interface LabPoint { examName: string; value: string; collectedAt: string | null }
export interface LabTrend {
  analyte: string
  severity: 'high' | 'warning' | 'info'
  direction: 'up' | 'down'
  previous: number
  latest: number
  unit: string
  message: string
}

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
function parseNum(v: string): number | null {
  const m = (v || '').replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

// analito canônico → palavras-chave de exame
const ANALYTES: { key: string; label: string; unit: string; kws: string[] }[] = [
  { key: 'creatinina', label: 'Creatinina', unit: 'mg/dL', kws: ['creatinina'] },
  { key: 'tfg', label: 'TFG/Clearance', unit: 'mL/min', kws: ['tfg', 'egfr', 'clearance', 'filtracao glomerular', 'depuracao'] },
  { key: 'potassio', label: 'Potássio', unit: 'mEq/L', kws: ['potassio', 'k+', 'kalemia', 'caliemia'] },
  { key: 'sodio', label: 'Sódio', unit: 'mEq/L', kws: ['sodio', 'na+', 'natremia'] },
  { key: 'inr', label: 'INR', unit: '', kws: ['inr', 'rni', 'razao normalizada'] },
  { key: 'hba1c', label: 'HbA1c', unit: '%', kws: ['hba1c', 'hemoglobina glicada', 'glicada', 'a1c'] },
  { key: 'alt', label: 'ALT/AST', unit: 'U/L', kws: ['alt', 'tgp', 'ast', 'tgo', 'aminotransferase'] },
]

/** Avalia tendências de piora entre as 2 medidas mais recentes (com data) de cada analito. */
export function analyzeLabTrends(labs: LabPoint[]): LabTrend[] {
  const trends: LabTrend[] = []
  for (const a of ANALYTES) {
    const pts = labs
      .filter(l => a.kws.some(k => norm(l.examName).includes(k)) && l.collectedAt && parseNum(l.value) !== null)
      .map(l => ({ v: parseNum(l.value)!, t: new Date(l.collectedAt as string).getTime() }))
      .filter(p => !Number.isNaN(p.t))
      .sort((x, y) => y.t - x.t)
    if (pts.length < 2) continue
    const latest = pts[0].v, previous = pts[1].v
    const delta = latest - previous
    const pct = previous !== 0 ? (delta / Math.abs(previous)) * 100 : 0
    let sev: LabTrend['severity'] | null = null
    let dir: LabTrend['direction'] = delta >= 0 ? 'up' : 'down'
    let msg = ''

    switch (a.key) {
      case 'creatinina':
        if (delta >= 0.3 || pct >= 25) { sev = latest >= 2 || pct >= 50 ? 'high' : 'warning'; dir = 'up'; msg = `Creatinina subiu de ${previous} para ${latest} mg/dL — piora da função renal. Reavaliar fármacos de ajuste/contraindicação renal e K⁺.` }
        break
      case 'tfg':
        if (delta <= -10 || (previous >= 30 && latest < 30) || (previous >= 60 && latest < 60)) { sev = latest < 30 ? 'high' : 'warning'; dir = 'down'; msg = `TFG caiu de ${previous} para ${latest} mL/min — reavaliar doses renais (metformina/DOAC/AINE) e contraindicações.` }
        break
      case 'potassio':
        if (delta >= 0.4 && latest >= 5.0) { sev = latest >= 6 ? 'high' : 'warning'; dir = 'up'; msg = `Potássio subiu de ${previous} para ${latest} mEq/L — hipercalemia emergente. Revisar IECA/BRA/poupador e suplementos de K⁺.` }
        break
      case 'sodio':
        if (delta <= -3 && latest < 135) { sev = latest < 130 ? 'high' : 'warning'; dir = 'down'; msg = `Sódio caiu de ${previous} para ${latest} mEq/L — hiponatremia emergente. Revisar ISRS/tiazídico e volemia.` }
        break
      case 'inr':
        if (latest > 3.5 || (latest < 1.8 && previous >= 1.8)) { sev = latest >= 5 ? 'high' : 'warning'; dir = latest > previous ? 'up' : 'down'; msg = `INR variou de ${previous} para ${latest} — fora/à beira da faixa. ${latest > 3.5 ? 'Risco hemorrágico' : 'Anticoagulação subterapêutica'}; ajustar varfarina.` }
        break
      case 'hba1c':
        if (delta >= 0.5) { sev = 'warning'; dir = 'up'; msg = `HbA1c subiu de ${previous}% para ${latest}% — piora do controle glicêmico. Reavaliar adesão e otimização do tratamento.` }
        break
      case 'alt':
        if (delta > 0 && pct >= 50 && latest >= 80) { sev = latest >= 120 ? 'high' : 'warning'; dir = 'up'; msg = `Transaminases subiram de ${previous} para ${latest} U/L — possível hepatotoxicidade emergente. Reavaliar fármacos hepatotóxicos.` }
        break
    }
    if (sev) trends.push({ analyte: a.label, severity: sev, direction: dir, previous, latest, unit: a.unit, message: msg })
  }
  // mais grave primeiro
  const rank = { high: 0, warning: 1, info: 2 } as const
  return trends.sort((x, y) => rank[x.severity] - rank[y.severity])
}
