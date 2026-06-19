/**
 * Normalização/alias de fármacos — aumenta o recall do matcher de interações
 * mapeando variantes para o princípio ativo canônico (em português) usado pela base.
 * Custo zero, determinístico e extensível. Cobre: inglês→PT, abreviações, nomes
 * comerciais BR frequentes e formas salinas. NÃO é exaustivo — ampliar conforme uso.
 */
const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

// chave normalizada → princípio ativo canônico (como na KNOWN_INTERACTIONS/CLASS_KEYWORDS)
const ALIASES: Record<string, string> = {
  // inglês → PT (INN)
  warfarin: 'varfarina', acetaminophen: 'paracetamol', paracetamol: 'paracetamol', lithium: 'litio',
  omeprazole: 'omeprazol', simvastatin: 'sinvastatina', atorvastatin: 'atorvastatina', metformin: 'metformina',
  ibuprofen: 'ibuprofeno', naproxen: 'naproxeno', diclofenac: 'diclofenaco', clopidogrel: 'clopidogrel',
  amiodarone: 'amiodarona', digoxin: 'digoxina', spironolactone: 'espironolactona', enalapril: 'enalapril',
  losartan: 'losartana', tramadol: 'tramadol', codeine: 'codeina', fluoxetine: 'fluoxetina',
  sertraline: 'sertralina', clarithromycin: 'claritromicina', ciprofloxacin: 'ciprofloxacino',
  azithromycin: 'azitromicina', methotrexate: 'metotrexato', allopurinol: 'alopurinol',
  rivaroxaban: 'rivaroxabana', apixaban: 'apixabana', dabigatran: 'dabigatrana', sildenafil: 'sildenafila',
  carbamazepine: 'carbamazepina', phenytoin: 'fenitoina', rifampicin: 'rifampicina', rifampin: 'rifampicina',
  gemfibrozil: 'genfibrozila', furosemide: 'furosemida', levothyroxine: 'levotiroxina',
  // abreviações / sinônimos
  aas: 'acido acetilsalicilico', asa: 'acido acetilsalicilico', aspirina: 'acido acetilsalicilico',
  'acido acetil salicilico': 'acido acetilsalicilico', 'acido acetilsalicilico': 'acido acetilsalicilico',
  hctz: 'hidroclorotiazida', 'sulfa-trimetoprim': 'sulfametoxazol', bactrim: 'sulfametoxazol',
  'sulfametoxazol-trimetoprima': 'sulfametoxazol', cotrimoxazol: 'sulfametoxazol',
  // nomes comerciais BR frequentes → princípio ativo
  tylenol: 'paracetamol', novalgina: 'dipirona', glifage: 'metformina', selozok: 'metoprolol',
  losartana: 'losartana', 'aradois': 'losartana', 'hidromed': 'hidroclorotiazida', 'lasix': 'furosemida',
  'puran t4': 'levotiroxina', puran: 'levotiroxina', synthroid: 'levotiroxina', marevan: 'varfarina',
  coumadin: 'varfarina', xarelto: 'rivaroxabana', eliquis: 'apixabana', pradaxa: 'dabigatrana',
  viagra: 'sildenafila', plavix: 'clopidogrel', 'aas protect': 'acido acetilsalicilico',
}

// sufixos de forma salina/éster a remover quando não houver alias direto
const SALT_SUFFIXES = [
  ' potassica', ' potassico', ' sodica', ' sodico', ' calcica', ' calcico', ' de sodio', ' de potassio',
  ' de calcio', ' hemifumarato', ' maleato', ' besilato', ' mesilato', ' cloridrato', ' sulfato',
  ' succinato', ' tartarato', ' fumarato', ' dicloridrato', ' bromidrato',
]

/** Retorna o princípio ativo canônico para um nome digitado (alias → PT; remove sal). */
export function canonicalizeDrug(name: string): string {
  const n = norm(name)
  if (!n) return n
  if (ALIASES[n]) return ALIASES[n]
  // tenta remover forma salina e reavaliar
  for (const suf of SALT_SUFFIXES) {
    if (n.endsWith(suf)) {
      const base = n.slice(0, -suf.length).trim()
      return ALIASES[base] || base
    }
    // sal no meio: "losartana potassica 50mg" → pega antes do sufixo
    const idx = n.indexOf(suf)
    if (idx > 0) {
      const base = n.slice(0, idx).trim()
      if (ALIASES[base]) return ALIASES[base]
    }
  }
  return n
}
