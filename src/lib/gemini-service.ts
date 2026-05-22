/**
 * PRM Care — Serviço de Análise com IA (Groq — gratuito)
 *
 * Utiliza o modelo llama-3.3-70b via Groq API
 * Gratuito: 14.400 requisições/dia, sem cartão de crédito.
 *
 * Para ativar: defina GROQ_API_KEY no .env e no Vercel.
 * Obter em: https://console.groq.com/keys
 */

import type { PatientContext, PRMFindingResult } from '@/types'
import { PRMCategory, RiskLevel } from '@prisma/client'
import type { FDAEnrichmentResult } from './drug-lookup-service'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

interface GeminiPRM {
  titulo: string
  categoria: 'NECESSITY' | 'EFFECTIVENESS' | 'SAFETY' | 'ADHERENCE'
  risco: 'URGENT' | 'HIGH' | 'MODERATE' | 'LOW'
  descricao: string
  impacto_potencial: string
  evidencia: string
  conduta_farmaceutica: string
  orientacao_paciente: string
  monitoramento: string
  prazo_intervencao: string
  necessita_prescritor: boolean
  sistema_organico?: string
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um farmacêutico clínico sênior com especialização em farmacoterapia, farmacovigilância e seguimento farmacoterapêutico pelo Método Dáder (Grupo de Investigação em Atenção Farmacêutica da Universidade de Granada). Você tem 20 anos de experiência em análise de problemas relacionados a medicamentos (PRMs) em pacientes polimedicados, idosos, gestantes e pacientes com insuficiência renal e hepática, atuando em contexto clínico brasileiro.

Seu papel é complementar uma análise de regras clínicas já realizada por um motor de regras determinístico. O motor já verifica:
- Critérios de Beers 2023 (AGS) para idosos ≥65 anos
- Critérios STOPP/START v3
- Interações medicamentosas de primeira e segunda geração (55+ pares conhecidos)
- Contraindicações em gestantes e lactantes
- Alertas de dose em insuficiência renal e hepática
- Interações alimento-medicamento (varfarina/alimentos ricos em vitamina K, IMAOs/tiramina, etc.)
- Interações medicamento-condição clínica (20+ pares)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TIPOS DE PRMs QUE VOCÊ DEVE IDENTIFICAR (não cobertos pelo motor)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. CASCATA DE PRESCRIÇÃO (PRIORIDADE MÁXIMA)
   Definição: um efeito adverso de um medicamento é interpretado como nova doença e tratado com outro medicamento, criando uma cascata desnecessária.
   Padrões clássicos a identificar:
   • AINE → edema/hipertensão → diurético ou anti-hipertensivo adicionado
   • AINE → dispepsia/gastrite → IBP adicionado (questionar se AINE é realmente necessário)
   • Corticoide sistêmico → hiperglicemia → hipoglicemiante adicionado
   • Corticoide → osteoporose não tratada (ausência de cálcio + vitamina D)
   • Betabloqueador não-seletivo → broncoespasmo → broncodilatador adicionado
   • Bloqueador de canal de cálcio (di-hidropiridínico) → edema de tornozelo → diurético adicionado
   • Antipsicótico → sintomas extrapiramidais → antiparkinsônico adicionado (biperideno, triexifenidila)
   • ISRS/IRSN → disfunção sexual → medicamento para disfunção adicionado
   • Lítio → poliúria/polidipsia → diurético que eleva lítio adicionado
   • Diurético tiazídico → hiperuricemia → alopurinol adicionado
   • Diurético → hipocalemia → suplemento de potássio (questionar uso de poupador K+)
   • Metoclopramida → efeitos extrapiramidais em idosos
   • Antibiótico de amplo espectro → diarreia → antidiarreico adicionado (mascaramento de C. diff)
   • Inibidor de colinesterase (donepezila) → bradicardia → marcapasso ou antiarrítmico
   • Metotrexato → náusea não tratada com ácido fólico adequado

2. INTERAÇÕES FARMACOLÓGICAS DE ENZIMAS CYP450 E TRANSPORTADORES
   Metabolismo CYP3A4:
   • Inibidores fortes: claritromicina, eritromicina, cetoconazol, itraconazol, fluconazol (moderado), ritonavir, amiodarona, verapamil, diltiazem, suco de grapefruit
   • Indutores: rifampicina, carbamazepina, fenitoína, fenobarbital, erva-de-são-joão
   • Substratos de alta relevância: sinvastatina, lovastatina (NÃO pravastatina/rosuvastatina), midazolam, alprazolam, triazolam, tacrolimus, ciclosporina, opioides (fentanil, oxicodona), amlodipina, sildenafil, vardenafil
   Metabolismo CYP2C19:
   • Inibidores: omeprazol, esomeprazol, clopidogrel (reduce activation), fluoxetina, fluvoxamina
   • Substratos: clopidogrel (pró-droga!), voriconazol, diazepam, fenitoína, sertralina
   • CRÍTICO: omeprazol/esomeprazol reduzem ativação do clopidogrel em ~40% → risco de eventos coronários
   Metabolismo CYP2D6:
   • Inibidores: fluoxetina, paroxetina, bupropiona, haloperidol, amiodarona
   • Substratos: codeína (pró-droga → morfina), tramadol, metoprolol, tamoxifeno, risperidona
   • CRÍTICO: fluoxetina/paroxetina bloqueiam ativação do tamoxifeno via CYP2D6 → risco de recorrência de câncer de mama
   Transportadores:
   • Inibidores de P-gp: amiodarona, verapamil, quinidina, azóis, claritromicina → elevam digoxina, dabigatrana
   • Inibidores de OATP1B1: ciclosporina, gemfibrozila → elevam estatinas → risco de miopatia

3. MEDICAMENTO NECESSÁRIO AUSENTE (baseado em guidelines vigentes)
   Indicações obrigatórias frequentemente esquecidas:
   • DM2 + doença cardiovascular estabelecida ou risco alto: empagliflozina ou liraglutida (EMPA-REG, LEADER)
   • DM2 + proteinúria ≥30mg/g: IECA ou BRA (ADA 2024, KDIGO 2022)
   • IC com FE reduzida (FEr): IECA/BRA + betabloqueador + ARM + SGLT2i (guideline ESC IC 2023)
   • IAM recente (<12 meses): betabloqueador, AAS, estatina, IECA/BRA
   • FA com CHA₂DS₂-VASc ≥2 (homens) ou ≥3 (mulheres): anticoagulação oral
   • DRC + DM2: SGLT2i com evidência renal (dapagliflozina, empagliflozina) se TFGe ≥20
   • Osteoporose em uso de corticoide (>3 meses): cálcio + vitamina D + bifosfonato
   • Asma/DPOC + LABA: ICS associado obrigatório para asma (guia GINA 2024)
   • DRC avançada: rastreio e correção de acidose, hiperfosfatemia, anemia

4. INADEQUAÇÃO DE DOSE AO PERFIL INDIVIDUAL
   • Ajuste renal obrigatório: metformina (ClCr <30: contraindicada; 30-45: reduzir), digoxina (ClCr <50), gabapentina, pregabalina, atenolol, ciprofloxacino, alendronato (ClCr <35: contraindicado), metoclopramida (ClCr <40: reduzir 50%), HBPM
   • Ajuste hepático: estatinas em Child-Pugh B/C, metronidazol, morfina, tramadol, benzodiazepínicos em cirrose
   • Subdose comum: betabloqueador em IC (dose-alvo vs dose atual), IECA em DM2 (necessidade de titulação)
   • Superdose em idosos: diazepam, alprazolam, amitriptilina (dose-dependente)

5. DUPLICIDADE TERAPÊUTICA SUTIL
   • Dois IBPs diferentes ou dose dobrada de IBP
   • Dois AINEs (incluindo AAS em dose analgésica + outro AINE)
   • Dois anticolinérgicos: combinações sutis incluem solifenacina + oxibutinina; ipratrópio + tiotrópio; antidepressivo tricíclico + anti-histamínico; antipsicótico + anti-histamínico sedativo
   • Dois antidepressivos serotoninérgicos (risco de síndrome serotoninérgica)
   • Dois antihipertensivos da mesma classe (dois BRAs, dois IECAs, dois betabloqueadores)
   • Dois benzodiazepínicos (prescrições de diferentes especialistas)

6. DURAÇÃO INAPROPRIADA — USO CRÔNICO INDEVIDO
   • IBP: indicado crônico apenas para DRGE confirmada, uso de AINE crónico, H. pylori, Barrett. Uso >8 semanas sem indicação clara → deprescription
   • Benzodiazepínicos: indicados por no máximo 2-4 semanas para insônia/ansiedade aguda. Uso >4 semanas → dependência, risco de quedas em idosos
   • Corticosteroides sistêmicos: uso >3 meses → avaliar mineral ósseo, glicemia, imunossupressão
   • Antibióticos: uso >14 dias sem indicação específica (ex: acne tratada com antibiótico oral por meses)
   • Opioides em dor crônica não oncológica: reavaliação periódica obrigatória
   • Anti-histamínicos sedativos de 1ª geração (prometazina, difenidramina): não devem ser usados cronicamente

7. INEFETIVIDADE PROVÁVEL
   • Antibiótico de amplo espectro oral para infecção grave (bacteremia, endocardite, pneumonia grave)
   • Antifúngico tópico para onicomicose grave ou extensa
   • IBP em H. pylori sem esquema erradicador completo
   • Estatina em paciente com triglicerídeos elevados isolados (fibrato seria mais adequado)
   • Broncodilatador prescrito sem espirometria confirmando obstrução
   • Antidepressivo em dose subterapêutica (ex: sertralina 12,5mg)
   • Codeína em metabolizadores lentos (considerar se sem efeito)

8. RISCOS ESPECÍFICOS AO PERFIL — SISTEMA RENAL
   • Nefrotóxicos combinados: AINE + IECA/BRA + diurético = triple whammy (IRA aguda)
   • AINEs em TFGe <60: contraindicados
   • Contrastes iodados planejados + metformina: suspender 48h antes
   • Aminoglicosídeos sem monitoramento adequado em DRC
   • Vancomicina em DRC sem ajuste de dose ou monitoramento de TDM

9. RISCOS ESPECÍFICOS AO PERFIL — SISTEMA CARDIOVASCULAR
   • QT longo: haloperidol, metadona, amiodarona, macrolídeos, fluoroquinolonas, ondansetrona, domperidona, citalopram >40mg, escitalopram >20mg — risco maior se combinados ou com hipocalemia
   • Bradicardia: betabloqueador + diltiazem/verapamil + digoxina (bloqueio AV)
   • Hipotensão ortostática: α-bloqueadores, antidepressivos tricíclicos, fenotiazinas, diuréticos em idosos

10. RISCOS ESPECÍFICOS AO PERFIL — SISTEMA NERVOSO CENTRAL
    • Síndrome serotoninérgica: ISRS + tramadol; ISRS + triptanos; ISRS + lítio; linezolida + ISRS; IMAO + qualquer serotoninérgico
    • Síndrome anticolinérgica central: combinação de múltiplos anticolinérgicos (carga anticolinérgica elevada: Anticholinergic Cognitive Burden scale ≥3)
    • Rebote de benzodiazepínico em suspensão abrupta
    • Convulsões por fluoroquinolonas em pacientes com história de epilepsia
    • Encefalopatia por metotrexato em altas doses

11. RISCOS ESPECÍFICOS AO PERFIL — SISTEMA ENDÓCRINO E METABÓLICO
    • Hipoglicemia: sulfonilurea + IECA + exercício intenso em idosos
    • Hiperglicemia induzida: corticosteroides, tacrolimus, diuréticos tiazídicos em doses altas, antipsicóticos atípicos (olanzapina, clozapina, quetiapina)
    • Hipercalemia perigosa: IECA + BRA (não associar!) + poupadores de K+ + suplemento de K+
    • Hiponatremia: ISRS + diuréticos tiazídicos em idosos (síndrome de secreção inapropriada de ADH)
    • Hipotireoidismo: amiodarona, lítio, interferon

12. ADESÃO E COMPLEXIDADE TERAPÊUTICA
    • Polimedicação (≥5 medicamentos): risco de erro, esquecimento, interações
    • Horários incompatíveis: levotiroxina deve ser tomada em jejum; bisfosfonato 30 min antes de comer
    • Formas farmacêuticas complexas: paciente idoso com dificuldade de deglutição usando comprimidos grandes
    • Custo: medicamentos de alto custo sem alternativas genéricas disponíveis no SUS
    • Regimes de múltiplas tomadas diárias em paciente idoso solo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIRETRIZES DE QUALIDADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Use sempre nomes de medicamentos em português brasileiro (enalapril, não "enalaprilat"; sinvastatina, não "simvastatin")
- Cite guidelines específicos: ADA 2024, ESC 2023, GINA 2024, KDIGO 2022, AGS Beers 2023, Micromedex, UpToDate
- Seja ESPECÍFICO ao paciente: mencione as doses, diagnósticos e valores laboratoriais concretos dele
- NÃO repita PRMs óbvios já detectados pelo motor (warfarina + AAS, digoxina em DRC, etc.)
- Se não há PRM relevante, retorne lista vazia — não invente PRMs para preencher quota`

// ── Few-shot examples ────────────────────────────────────────────────────────

const FEW_SHOT_EXAMPLES = `
=== EXEMPLOS DE PRMs — RACIOCÍNIO CLÍNICO AVANÇADO ===

EXEMPLO 1 — Cascata de prescrição clássica (AINE → hipertensão → anti-hipertensivo):
Paciente 68 anos, HAS prévia controlada, passou a usar diclofenaco 50mg 2x/dia há 2 meses para dor lombar. Médico adicionou amlodipina 5mg há 6 semanas pois PA estava em 155/95 mmHg.
→ PRM identificado:
{
  "titulo": "Cascata de prescrição: AINE causando elevação da PA e adição desnecessária de anti-hipertensivo",
  "categoria": "SAFETY",
  "risco": "HIGH",
  "descricao": "O diclofenaco inibe prostaglandinas vasodilatadoras renais, causando retenção de sódio e água e antagonismo de anti-hipertensivos. A elevação da PA ocorreu 2 meses após o início do AINE, sugerindo fortemente cascata de prescrição: o efeito adverso foi tratado como nova doença em vez de remover a causa.",
  "impacto_potencial": "Progressão de HAS, aumento de risco cardiovascular, uso desnecessário e custos adicionais com amlodipina",
  "evidencia": "AINEs reduzem eficácia de anti-hipertensivos em média 3-5 mmHg (Br J Clin Pharmacol 2012). Guideline ESC/ESH 2023 contraindica AINEs em HAS não controlada. Diclofenaco tem maior risco cardiovascular entre os AINEs (LANCET 2013).",
  "conduta_farmaceutica": "Discutir com prescrito: 1) Substituir diclofenaco por paracetamol 1g 3x/dia (+ fisioterapia se disponível); 2) Reavaliar necessidade da amlodipina após 4 semanas sem AINE; 3) Se dor neuropática, considerar duloxetina.",
  "orientacao_paciente": "O anti-inflamatório que você toma pode ser a causa da sua pressão alta ter subido. Converse com seu médico antes de mudar qualquer medicamento, mas evite ibuprofeno, diclofenaco e naproxeno.",
  "monitoramento": "PA 2x/semana nas primeiras 4 semanas após suspensão do AINE",
  "prazo_intervencao": "7 dias",
  "necessita_prescritor": true,
  "sistema_organico": "cardiovascular"
}

EXEMPLO 2 — Cascata de prescrição (antipsicótico → parkinsonismo → antiparkinsônico):
Paciente 45 anos, esquizofrenia, em uso de haloperidol 5mg/dia há 6 meses. Médico prescreveu biperideno 2mg 2x/dia há 3 meses para "tremores".
→ PRM identificado:
{
  "titulo": "Cascata de prescrição: haloperidol causando parkinsonismo tratado com biperideno desnecessário",
  "categoria": "SAFETY",
  "risco": "HIGH",
  "descricao": "O haloperidol (antipsicótico típico) causa parkinsonismo em até 30% dos pacientes por bloqueio de receptores D2. O biperideno (anticolinérgico) foi adicionado para tratar esse efeito adverso. Em vez de tratar a cascata, a conduta ideal seria considerar substituição por antipsicótico atípico com menor bloqueio D2.",
  "impacto_potencial": "Carga anticolinérgica elevada (haloperidol + biperideno), risco de confusão mental, retenção urinária, constipação e piora cognitiva",
  "evidencia": "Biperideno tem escore ACB=3 (alta carga anticolinérgica). Combinação com haloperidol eleva risco de síndrome anticolinérgica. Antipsicóticos atípicos (risperidona, aripiprazol) têm menor indução de parkinsonismo (NICE 2014).",
  "conduta_farmaceutica": "Discutir com psiquiatra: 1) Avaliar redução gradual do haloperidol; 2) Considerar switch para risperidona ou aripiprazol; 3) Se manutenção do haloperidol for necessária, reavaliar real necessidade do biperideno.",
  "orientacao_paciente": "O tremor pode ser um efeito colateral do seu medicamento para esquizofrenia. Converse com seu médico para ajustar o tratamento.",
  "monitoramento": "Escala AIMS (movimentos involuntários) a cada 3 meses; avaliação cognitiva semestral",
  "prazo_intervencao": "Próxima consulta",
  "necessita_prescritor": true,
  "sistema_organico": "neurologico"
}

EXEMPLO 3 — Interação CYP2C19 crítica (clopidogrel + IBP):
Paciente 62 anos, pós-stent coronário há 3 meses, em uso de AAS 100mg + clopidogrel 75mg + omeprazol 20mg (prescrito para proteção gástrica).
→ PRM identificado:
{
  "titulo": "Omeprazol reduz ativação do clopidogrel via CYP2C19 — risco de evento coronário",
  "categoria": "SAFETY",
  "risco": "URGENT",
  "descricao": "O omeprazol (e esomeprazol) inibem o CYP2C19, enzima responsável pela ativação do clopidogrel (pró-droga). A co-administração reduz a inibição plaquetária do clopidogrel em até 40%, com aumento documentado de eventos cardiovasculares em pacientes pós-stent.",
  "impacto_potencial": "Trombose de stent, IAM recorrente, óbito cardiovascular",
  "evidencia": "FDA Drug Safety Communication 2010: evitar omeprazol e esomeprazol com clopidogrel. Meta-análise JAMA 2012 (N=25.000): OR 1.41 para eventos cardiovasculares maiores. ESC 2017: preferir pantoprazol (menor inibição de CYP2C19) se IBP for necessário.",
  "conduta_farmaceutica": "Substituir omeprazol por pantoprazol 40mg/dia (menor interação com CYP2C19). Alternativa: lansoprazol. Manter IBP apenas se risco gastrointestinal elevado (história de úlcera, AAS + clopidogrel = indicação real).",
  "orientacao_paciente": "Seu remédio para o estômago (omeprazol) pode reduzir a ação do clopidogrel que protege seu stent. Pergunte ao médico se pode trocar por pantoprazol.",
  "monitoramento": "Sintomas gastrointestinais; eletrocardiograma em qualquer dor torácica",
  "prazo_intervencao": "24-48h",
  "necessita_prescritor": true,
  "sistema_organico": "cardiovascular"
}

EXEMPLO 4 — Medicamento necessário ausente + risco renal:
Paciente 58 anos, DM2 há 10 anos, HAS, TFGe 55 mL/min/1.73m², proteinúria 350mg/g. Usando: metformina 850mg 2x/dia, glibenclamida 5mg/dia, losartana 50mg/dia, hidroclorotiazida 25mg/dia.
→ PRM identificado:
{
  "titulo": "Ausência de SGLT2i com proteção renal em DM2 com nefropatia moderada",
  "categoria": "NECESSITY",
  "risco": "HIGH",
  "descricao": "Paciente com DM2, TFGe 55 e proteinúria 350mg/g (categoria A3G2) tem indicação de inibidor de SGLT2 com evidência renal comprovada (dapagliflozina ou empagliflozina) além do BRA já em uso. As evidências de CREDENCE e DAPA-CKD mostram redução de 39% na progressão renal.",
  "impacto_potencial": "Progressão para DRC G3b-G4, necessidade de diálise em 5-8 anos sem intervenção",
  "evidencia": "KDIGO 2022 e ADA Standards of Care 2024: dapagliflozina 10mg/dia indicada para TFGe ≥25 com proteinúria ≥200mg/g. CREDENCE trial: canagliflozina reduziu progressão renal em 34%. EMPA-KIDNEY 2023: empagliflozina eficaz até TFGe 20.",
  "conduta_farmaceutica": "Solicitar avaliação médica para adicionar dapagliflozina 10mg/dia ou empagliflozina 10mg/dia. Também avaliar necessidade de aumentar losartana para 100mg (dose nefroprotora plena). Monitorar TFGe e K+ após ajuste.",
  "orientacao_paciente": "Existe um medicamento novo chamado dapagliflozina que protege seus rins além de controlar o diabetes. Pergunte ao seu médico sobre isso.",
  "monitoramento": "TFGe e potássio a cada 3 meses; proteinúria semestral; glicemia mensal",
  "prazo_intervencao": "Próxima consulta",
  "necessita_prescritor": true,
  "sistema_organico": "renal"
}

EXEMPLO 5 — Triple whammy (risco renal agudo por combinação):
Paciente 72 anos, HAS, ICC leve (FE 45%), DRC G2, usando: enalapril 10mg, furosemida 40mg, ibuprofeno 400mg (automedicação para artralgia).
→ PRM identificado:
{
  "titulo": "Triple whammy: AINE + IECA + diurético com risco de insuficiência renal aguda",
  "categoria": "SAFETY",
  "risco": "URGENT",
  "descricao": "A combinação de AINE (ibuprofeno) + IECA (enalapril) + diurético (furosemida) constitui a 'tríade nefrotóxica' ou triple whammy. Cada um reduz a perfusão renal por mecanismo diferente; juntos, eliminam os mecanismos compensatórios e podem causar IRA em 24-72h, especialmente em episódios de desidratação.",
  "impacto_potencial": "Insuficiência renal aguda, necessidade de diálise, hospitalização de emergência, piora da ICC",
  "evidencia": "Triple Whammy: risco aumentado em 1.31x para IRA hospitalar (Br J Clin Pharmacol 2005). Guideline KDIGO 2012: evitar AINEs em TFGe <60. Em pacientes >70 anos com ICC, risco ainda maior por débito cardíaco reduzido.",
  "conduta_farmaceutica": "URGENTE: orientar interrupção IMEDIATA do ibuprofeno (automedicação). Oferecer paracetamol como alternativa. Verificar creatinina se sintomas (oligúria, edema agudo). Alertar paciente sobre riscos de AINEs sem prescrição.",
  "orientacao_paciente": "O ibuprofeno que você toma por conta própria pode causar uma crise renal grave com seus outros remédios. PARE de tomá-lo hoje. Use paracetamol se precisar de analgésico.",
  "monitoramento": "Creatinina e potássio em 72h se continuou uso; débito urinário diário",
  "prazo_intervencao": "Imediato",
  "necessita_prescritor": false,
  "sistema_organico": "renal"
}
=== FIM DOS EXEMPLOS ===`

// ── Build patient context string ─────────────────────────────────────────────

function buildPatientContext(context: PatientContext): string {
  const meds = context.medications.length > 0
    ? context.medications.map((m, i) =>
        `  ${i + 1}. ${m.activeIngredient}${m.tradeName ? ` (${m.tradeName})` : ''}` +
        `${m.dose ? ` — ${m.dose}${m.doseUnit || ''}` : ''}` +
        `${m.pharmaceuticalForm ? ` ${m.pharmaceuticalForm}` : ''}` +
        `${m.route ? ` | via: ${m.route}` : ''}` +
        `${m.frequency ? ` | ${m.frequency}` : ''}` +
        `${m.indication ? ` | Indicação: ${m.indication}` : ''}` +
        `${m.adherence && m.adherence !== 'UNKNOWN' ? ` | Adesão: ${m.adherence}` : ''}` +
        `${m.isSelfMedication ? ' | ⚠️ AUTOMEDICAÇÃO' : ''}` +
        `${m.adverseEffects ? ` | EA relatado: ${m.adverseEffects}` : ''}`
      ).join('\n')
    : '  Nenhum medicamento informado'

  const diagnoses = context.diagnoses.length > 0
    ? context.diagnoses.map(d => `${d.name}${(d as any).icd10Code ? ` (${(d as any).icd10Code})` : ''}${(d as any).isPrimary ? ' [PRINCIPAL]' : ''}`).join(', ')
    : 'Não informados'

  const comorbidities = context.comorbidities.length > 0
    ? context.comorbidities.map((c: any) => c.name).join(', ')
    : 'Nenhuma'

  const allergies = context.allergies.length > 0
    ? context.allergies.map((a: any) =>
        `${a.substance}${a.reaction ? ` (reação: ${a.reaction})` : ''}${a.severity ? ` [${a.severity}]` : ''}`
      ).join('; ')
    : 'Nenhuma conhecida'

  const labs = context.labResults.length > 0
    ? context.labResults.map(l =>
        `${l.examName}: ${l.value}${l.unit ? ` ${l.unit}` : ''}${l.isAbnormal ? ' ⚠️ ALTERADO' : ''}`
      ).join(' | ')
    : 'Não disponíveis'

  const renalStatus = context.renalFunction
    ? `${context.renalFunction}${context.creatinineClearance ? ` (ClCr: ${context.creatinineClearance} mL/min)` : ''}`
    : 'Não informada'

  return `=== PERFIL DO PACIENTE ===
Idade: ${context.age ? `${context.age} anos` : 'Não informada'}
Sexo biológico: ${context.sex === 'MALE' ? 'Masculino' : context.sex === 'FEMALE' ? 'Feminino' : 'Não informado'}
Peso: ${context.weight ? `${context.weight} kg` : 'Não informado'} | Altura: ${context.height ? `${context.height} cm` : 'Não informada'}
Gestante: ${context.isPregnant ? `Sim${context.gestationalAge ? ` (${context.gestationalAge} semanas)` : ''}` : 'Não'}
Lactante: ${context.isLactating ? 'Sim' : 'Não'}
Idoso (≥60 anos): ${context.isElderly ? 'Sim' : 'Não'}
Função renal: ${renalStatus}
Função hepática: ${context.hepaticFunction || 'Não informada'}

Diagnósticos: ${diagnoses}
Comorbidades: ${comorbidities}
Alergias e intolerâncias: ${allergies}
Queixa principal: ${context.chiefComplaint || 'Não informada'}
História clínica: ${context.clinicalHistory || 'Não informada'}
Exames laboratoriais: ${labs}

=== MEDICAMENTOS EM USO (${context.medications.length} no total) ===
${meds}`
}

// ── User prompt ───────────────────────────────────────────────────────────────

function buildUserPrompt(context: PatientContext, fdaData?: FDAEnrichmentResult): string {
  const patientContext = buildPatientContext(context)
  const medCount = context.medications.length
  const isComplex = medCount >= 5 || context.isElderly || context.isPregnant || context.isLactating
  const hasRenalIssue = context.renalFunction || context.creatinineClearance
  const hasMultipleMeds = medCount >= 3

  const fdaSection = fdaData?.fdaContextSummary
    ? `\n${fdaData.fdaContextSummary}\n`
    : ''

  // Raciocínio guiado por sistemas orgânicos
  const systemsChecklist = `
=== RACIOCÍNIO CLÍNICO — VERIFIQUE CADA SISTEMA ===

PASSO 1 — PESQUISA DE CASCATAS DE PRESCRIÇÃO:
Para cada medicamento, pergunte: "Este medicamento foi adicionado para tratar um efeito adverso de outro medicamento?"
• Medicamentos adicionados recentemente (menos de 3 meses após início de outro) são suspeitos de cascata
• AINEs → hipertensão → anti-hipertensivo? | Corticosteroides → hiperglicemia → hipoglicemiante?
• Antipsicóticos → parkinsonismo → biperideno/triexifenidila?
• BCC di-hidropiridínico → edema → diurético? | ISRS → disfunção sexual → medicamento para disfunção?

PASSO 2 — SISTEMA RENAL:
• Há nefrotóxico com TFGe/ClCr reduzido? (metformina <30, AINE <60, HBPM, digoxina, gabapentina)
• Há triple whammy (AINE + IECA/BRA + diurético)?
• DM2 com proteinúria/DRC: há IECA/BRA? Há indicação de SGLT2i?
• Doses precisam ajuste renal?

PASSO 3 — SISTEMA CARDIOVASCULAR:
• Medicamentos que prolongam QT combinados? (haloperidol, quinolonas, macrolídeos, antidepressivos, metadona)
• Clopidogrel com omeprazol/esomeprazol? (inibição CYP2C19)
• Estatinas com inibidores de CYP3A4? (miopatia/rabdomiólise)
• IC com FE reduzida: há betabloqueador, IECA/BRA, ARM, SGLT2i?
• Bradicardia: betabloqueador + diltiazem/verapamil?

PASSO 4 — SISTEMA NERVOSO CENTRAL:
• Carga anticolinérgica total (somar anticolinérgicos — ≥3 em escala ACB é preocupante)
• Risco de síndrome serotoninérgica? (ISRS + tramadol; ISRS + triptanos; ISRS + lítio)
• Benzodiazepínico por mais de 4 semanas?
• CYP2D6: fluoxetina/paroxetina com tramadol (convulsão), codeína, tamoxifeno (pró-drogas)?

PASSO 5 — SISTEMA ENDÓCRINO/METABÓLICO:
• Hipercalemia: IECA + BRA? (não associar!) | IECA/BRA + poupador de K+ + suplemento K+?
• Hipoglicemia: sulfonilurea em idoso frágil? | Combinação com IECA aumenta risco
• Hiponatremia: ISRS + tiazídico em idoso?
• Hiperglicemia induzida: corticosteroides, antipsicóticos atípicos, tiazídicos?
• Dislipidemia em paciente de alto risco sem estatina?

PASSO 6 — MEDICAMENTOS AUSENTES (Guidelines 2023-2024):
• DM2 + DCV ou alto risco: SGLT2i ou GLP-1 RA?
• DM2 + proteinúria: IECA/BRA em dose plena?
• IC com FEr: quadrupla terapia completa?
• Corticoide >3 meses: cálcio + vitamina D + bifosfonato?
• FA com CHA₂DS₂-VASc ≥2 (H)/≥3 (M): anticoagulação?
• Osteoporose documentada: bifosfonato prescrito?

PASSO 7 — DURAÇÃO E INDICAÇÃO:
• IBP: há indicação crônica real (DRGE, úlcera, uso de AINE crónico)? Ou candidato a deprescription?
• Benzodiazepínicos: >4 semanas de uso? Indicação atual válida?
• Antibióticos: uso >14 dias sem indicação específica?

PASSO 8 — DUPLICIDADE SUTIL:
• Dois medicamentos da mesma classe farmacológica (mesmo prescrito por médicos diferentes)?
• Dois anticolinérgicos de nomes diferentes?
• Dois serotoninérgicos?

PASSO 9 — ADESÃO E COMPLEXIDADE:
• ≥5 medicamentos? | Múltiplas tomadas diárias? | Formas farmacêuticas complexas?
• Medicamento de custo elevado sem alternativa no SUS?
• Horário de administração incompatível (levotiroxina, bisfosfonatos)?`

  return `${FEW_SHOT_EXAMPLES}

${patientContext}
${fdaSection}

=== SUA TAREFA ===
${isComplex ? `⚠️ ATENÇÃO: Este é um paciente COMPLEXO (${medCount} medicamentos${context.isElderly ? ', IDOSO' : ''}${context.isPregnant ? ', GESTANTE' : ''}${context.isLactating ? ', LACTANTE' : ''}${hasRenalIssue ? ', COM COMPROMETIMENTO RENAL' : ''}). Análise com máxima atenção é obrigatória.` : ''}
${!isComplex && hasMultipleMeds ? `Paciente com ${medCount} medicamentos. Analise interações entre todos.` : ''}

${systemsChecklist}

Após completar o raciocínio por sistemas, gere de 0 a 6 PRMs. Priorize qualidade sobre quantidade.
REGRAS:
- Só inclua PRMs com relevância clínica real
- Não repita PRMs que o motor de regras determinístico certamente já detectou
- Seja específico ao paciente (cite os medicamentos e diagnósticos dele)
- Para URGENT: risco de vida imediato ou evento grave em <24-48h
- Para HIGH: risco de dano grave mas não imediato (dias a semanas)
- Para MODERATE: impacto clínico real mas manejável
- Para LOW: relevante, deve ser documentado, sem urgência

Responda EXCLUSIVAMENTE em JSON válido, sem nenhum texto antes ou depois:
{
  "raciocinio": "Descrição do raciocínio clínico por sistemas: o que foi encontrado em cada passo (3-5 frases)",
  "prms": [
    {
      "titulo": "título conciso e específico (mencione os medicamentos envolvidos)",
      "categoria": "NECESSITY" ou "EFFECTIVENESS" ou "SAFETY" ou "ADHERENCE",
      "risco": "URGENT" ou "HIGH" ou "MODERATE" ou "LOW",
      "descricao": "descrição clara do problema com mecanismo farmacológico (2-4 frases)",
      "impacto_potencial": "consequências clínicas concretas se não corrigido",
      "evidencia": "guideline específico com ano, mecanismo farmacológico ou estudo clínico",
      "conduta_farmaceutica": "conduta acionável e realista, numerada se múltiplos passos",
      "orientacao_paciente": "linguagem simples, empática, sem termos técnicos",
      "monitoramento": "parâmetros específicos, valores-alvo e frequência de monitoramento",
      "prazo_intervencao": "Imediato" ou "24-48h" ou "7 dias" ou "Próxima consulta" ou "30 dias",
      "necessita_prescritor": true ou false,
      "sistema_organico": "renal" ou "cardiovascular" ou "neurologico" ou "endocrino" ou "hepatico" ou "geral" ou "adesao"
    }
  ],
  "observacao_geral": "avaliação clínica geral do perfil farmacoterapêutico em 1-2 frases"
}

Se não identificar PRMs adicionais após análise cuidadosa por todos os sistemas:
{"raciocinio":"Analisados os 9 passos do raciocínio por sistemas. [detalhe o que foi verificado]","prms":[],"observacao_geral":"Perfil farmacoterapêutico revisado. Nenhum PRM adicional identificado além dos detectados pelo motor de regras."}`
}

// ── KnowledgeBase injection ───────────────────────────────────────────────────

export interface KnowledgeEntry {
  title: string
  content: string
  type: string
  drugNames?: string[]
}

function buildKnowledgeSection(entries: KnowledgeEntry[]): string {
  if (!entries || entries.length === 0) return ''
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROTOCOLOS E CONHECIMENTO INSTITUCIONAL (base de conhecimento da clínica)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Os seguintes protocolos clínicos foram adicionados pela equipe farmacêutica.
Considere essas informações como complemento às diretrizes padrão.
Se algum protocolo for relevante ao caso, mencioná-lo explicitamente no campo "evidencia".

${entries.slice(0, 8).map((e, i) => `[PROTOCOLO ${i + 1}] ${e.title}${e.drugNames?.length ? ` (medicamentos: ${e.drugNames.join(', ')})` : ''}
${e.content.slice(0, 600)}${e.content.length > 600 ? '...' : ''}`).join('\n\n')}
`
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function analyzeWithGemini(
  context: PatientContext,
  fdaData?: FDAEnrichmentResult,
  knowledgeEntries?: KnowledgeEntry[]
): Promise<{
  findings: PRMFindingResult[]
  observacaoGeral: string
  success: boolean
  error?: string
}> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return { findings: [], observacaoGeral: '', success: false, error: 'GROQ_API_KEY não configurada' }
  }

  try {
    const userPrompt = buildUserPrompt(context, fdaData)
    const knowledgeSection = buildKnowledgeSection(knowledgeEntries || [])

    // Inject knowledge base into system prompt if available
    const systemPromptWithKnowledge = knowledgeSection
      ? SYSTEM_PROMPT + knowledgeSection
      : SYSTEM_PROMPT

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPromptWithKnowledge },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.12,       // mais determinístico — raciocínio clínico não deve ter variação alta
        max_tokens: 8000,        // espaço extra para raciocínio por sistemas
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(55000), // 55s timeout — prompts maiores precisam de mais tempo
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[GROQ] Erro HTTP:', response.status, errorText)
      return { findings: [], observacaoGeral: '', success: false, error: `Erro HTTP ${response.status}` }
    }

    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content

    if (!text) {
      return { findings: [], observacaoGeral: '', success: false, error: 'Resposta vazia do Groq' }
    }

    let parsed: { prms: GeminiPRM[]; observacao_geral?: string; raciocinio?: string }
    try {
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleanText)
    } catch {
      console.error('[GROQ] Erro ao parsear JSON:', text.substring(0, 500))
      return { findings: [], observacaoGeral: '', success: false, error: 'Resposta inválida do Groq' }
    }

    const findings: PRMFindingResult[] = (parsed.prms || [])
      .filter((prm: GeminiPRM) => prm.titulo && prm.descricao) // ignora PRMs vazios
      .map((prm: GeminiPRM) => ({
        category: (PRMCategory[prm.categoria] || PRMCategory.SAFETY) as PRMCategory,
        riskLevel: (RiskLevel[prm.risco] || RiskLevel.MODERATE) as RiskLevel,
        title: `[IA] ${prm.titulo}`,
        description: prm.descricao,
        clinicalEvidence: prm.evidencia,
        potentialImpact: prm.impacto_potencial || prm.descricao,
        pharmacistConduct: prm.conduta_farmaceutica,
        patientGuidance: prm.orientacao_paciente,
        needsReferral: prm.risco === 'URGENT',
        needsPrescriberContact: prm.necessita_prescritor,
        monitoring: prm.monitoramento,
        reevaluationPeriod: prm.prazo_intervencao,
        confidenceLevel: 'moderate' as const,
        validationNote: 'Análise gerada por Inteligência Artificial (Groq/Llama). Deve ser obrigatoriamente validada pelo farmacêutico antes de qualquer intervenção.',
        interventionDeadline: prm.prazo_intervencao,
      }))

    if (parsed.raciocinio) {
      console.log('[GROQ] Raciocínio clínico por sistemas:', parsed.raciocinio)
    }

    return {
      findings,
      observacaoGeral: parsed.observacao_geral || '',
      success: true,
    }
  } catch (err: any) {
    console.error('[GROQ] Erro na análise:', err)
    return { findings: [], observacaoGeral: '', success: false, error: err.message || 'Erro desconhecido' }
  }
}
