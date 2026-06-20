# Cobertura Clínica — Motor de Análise Farmacoterapêutica (PRM Care)

> Documento de referência para a equipe farmacêutica e responsável técnico (RT).
> Descreve **o que o motor determinístico** (`src/lib/prm-engine.ts`) detecta automaticamente.
> Atualizado em 2026-06-16. Coberto por **49 testes automatizados** (`src/lib/*.test.ts`, vitest).

## Princípios

- **Motor determinístico + IA complementar.** O motor (regras) roda sempre e é a fonte
  primária. A IA (Groq) recebe os achados do motor como *grounding* e é instruída a
  **complementar, não repetir** (cascatas sutis, raciocínio clínico fino).
- **Apoio à decisão, não substituição.** Toda saída exige validação do farmacêutico.
  Os achados trazem `confidenceLevel`, `validationNote` e conduta acionável.
- **Nomes normalizados** (minúsculas, sem acento) — o matcher usa princípio ativo.

## 1. Interações medicamentosas

### 1a. Pares específicos (`KNOWN_INTERACTIONS`, 60+ pares)
Por nome de princípio ativo, com severidade (minor/moderate/major/contraindicated),
mecanismo, efeito clínico e manejo. Cobre, entre outros:
- Anticoagulação/antiagregação (varfarina + AAS, etc.)
- **Clopidogrel + omeprazol/esomeprazol** (CYP2C19)
- Síndrome serotoninérgica (ISRS/IRSN + tramadol; IMAO + ISRS)
- Prolongamento de QT (haloperidol/amiodarona/quinolonas/quetiapina + …)
- Duplo bloqueio do SRAA (IECA + BRA)
- Inibidores de CYP3A4 (fluconazol + midazolam/quetiapina), sulfonilureia + fluconazol
- **Nitrato + inibidor de PDE5** (contraindicado)
- **Opioide + benzodiazepínico** (depressão respiratória)
- **Indutores enzimáticos** (rifampicina/carbamazepina/fenitoína/fenobarbital/topiramato/erva-de-são-joão) + anticoncepcional → falha contraceptiva; + varfarina → perda de anticoagulação

### 1b. Interações por **classe × classe** (`CLASS_INTERACTIONS`, 5 pares)
Disparam para **qualquer membro** de cada classe (não só pares enumerados):
| Classe A | Classe B | Severidade | Risco |
|---|---|---|---|
| Opioide | Benzodiazepínico | major | Depressão respiratória |
| Opioide | Hipnótico Z | major | Depressão SNC |
| Nitrato | Inibidor de PDE5 | contraindicado | Hipotensão grave |
| IECA | BRA-II | major | Hipercalemia/IRA (duplo SRAA) |
| Benzodiazepínico | Hipnótico Z | moderate | Sedação excessiva |
| Betabloqueador | BCC não-diidropiridínico (verapamil/diltiazem) | major | Bradicardia/BAV |
| AINE | Anticoagulante oral | major | Hemorragia digestiva |
| AINE | Antiagregante | moderate | Sangramento GI |
| Anticoagulante oral | Antiagregante | major | Sangramento (verificar indicação) |

### 1c. Combinações de QT longo (cumulativo)
≥2 fármacos de alto risco → URGENT; alto + moderado → HIGH; ≥2 moderados → MODERATE.

### 1d. Interações alimento–medicamento (`FOOD_DRUG_INTERACTIONS`).

## 1e. Suplemento de potássio + fármaco que retém K⁺
Suplemento de potássio (KCl/citrato) com IECA/BRA ou poupador de potássio
(espironolactona/eplerenona/amilorida/triantereno) → alto risco de hipercalemia (HIGH).

## 1f. Módulo de consulta de Interações (`/interactions`, `checkInteractions`)
Ferramenta dedicada de checagem fármaco×fármaco (≥2 medicamentos), em camadas:

1. **Base curada própria** (`KNOWN_INTERACTIONS`, ~200 pares + classe×classe) — mecanismo,
   efeito e manejo redigidos; **evidência "Alta"**.
2. **Camada externa DDInter 2.0** (CC BY-NC-SA) — **~89.600 pares** cobrindo **1.011
   princípios ativos** (ponte PT↔EN). Só aparece para pares ainda não cobertos pela base curada.
3. **Camada qualitativa de mecanismo** — atribui *tags* farmacológicas aos princípios ativos
   (**48 tags**) e, por **35 regras tag×tag**, infere mecanismo/efeito/conduta ESPECÍFICOS
   para os pares externos (serotoninérgico, QT, depressor SNC, anticolinérgico, sangramento,
   hipercalemia, nefrotóxico, bradicardizante, hipoglicemiante, CYP3A4/2D6/2C9/2C19, P-gp,
   quelação, mielossupressão, fotossensibilidade, xantina-oxidase×tiopurina, CYP1A2,
   UGT-lamotrigina, etc.). Pode **elevar** (nunca rebaixar) a severidade da DDInter.
4. **Evidência e monitoramento** — todo resultado traz nível de evidência (Alta/Moderada/Baixa,
   conforme a origem) e os **parâmetros a monitorar**, derivados da base de medicamentos de alta
   vigilância (ISMP/MAR) ou do mecanismo (INR, QTc/eletrólitos, K⁺, litemia, digoxinemia, hemograma…).
5. **Ajuste ao paciente** — flags por idade (≥65: sedação/quedas, carga anticolinérgica, QT) e
   função renal (TFG<60: lítio/digoxina/metotrexato/nefrotóxicos), sem alterar a severidade.
6. **Fonte citável** — pares com risco de QT citam **CredibleMeds® (QTdrugs.org/AZCERT)**.
7. **Alimentos/álcool/suplementos** (`checkFoodAndSupplements`) e **farmacogenômica CPIC**
   (`PgxAlerts`) integrados na mesma consulta; **IA explicadora** opcional (Groq) enriquece
   sinais de alerta/alternativas/orientação, com evidência calibrada por fonte e guardrail anti-alucinação.

## 2. "Triple whammy"
AINE + (IECA **ou** BRA) + diurético (alça/tiazídico) em uso simultâneo → risco de
**lesão renal aguda** (HIGH). Distinto da regra de AINE em DRC.

## 3. Cascatas de prescrição (`PRESCRIPTION_CASCADES`, 5)
Sinaliza quando um "tratamento" pode estar manejando o efeito adverso de um "gatilho"
(candidato a desprescrição):
| Gatilho | Efeito suspeito | Tratamento sinalizado |
|---|---|---|
| BCC di-hidropiridínico | Edema periférico | Diurético |
| Antipsicótico/antidopaminérgico | Sintomas extrapiramidais | Biperideno/tri-hexifenidil |
| Diurético tiazídico | Hiperuricemia/gota | Alopurinol/colchicina |
| IECA | Tosse seca | Antitussígeno |
| ISRS/IRSN | Disfunção sexual | Inibidor de PDE5 |

## 4. Achados guiados por exames laboratoriais (`findLabBasedPRMs`)
| Exame | Gatilho | Gate de medicamento | Categoria/Risco |
|---|---|---|---|
| HbA1c | ≥7% (≥9% grave) em diabético | — | EFFECTIVENESS · MOD/HIGH |
| HbA1c | <7% (<6,5%) em **idoso** | Sulfonilureia/insulina | SAFETY · MOD/HIGH (supertratamento) |
| K⁺ alto | ≥5,5 (≥6 grave) | Agravado por IECA/BRA/espironolactona | SAFETY · HIGH/URGENT |
| K⁺ baixo | <3,5 (<3,0 grave) | Digoxina / prolongador de QT / diurético espoliador | SAFETY · MOD/HIGH |
| INR | >4 / <2 | Varfarina | SAFETY/EFFECTIVENESS · HIGH/URGENT |
| Na⁺ | <130 (<125) | Agravado por ISRS/tiazídico | SAFETY · HIGH/URGENT |
| LDL | ≥100 em alto risco CV (ou ≥190) | Sem estatina | NECESSITY · MOD/HIGH |
| TSH | >4,5 / <0,4 | Levotiroxina | EFFECTIVENESS/SAFETY · MOD/HIGH |
| TFG | <30 | Metformina (contraindicada) | SAFETY · HIGH |
| TFG | <60 | AINE | SAFETY · HIGH |
| TFG | <30 (<15 grave) | DOAC (dabigatrana = URGENT) | SAFETY · HIGH/URGENT |
| Digoxinemia | ≥2 ng/mL | Digoxina | SAFETY · URGENT |
| ALT/AST | ≥120 U/L (~3×LSN) | Fármaco hepatotóxico | SAFETY · HIGH |

## 5. Critérios geriátricos e de adequação
- **Beers 2023** — medicamentos potencialmente inadequados em idosos.
- **STOPP v3** — prescrições potencialmente inapropriadas (interação fármaco-doença),
  incluindo anticolinérgicos em **HPB/retenção urinária** e em **glaucoma de ângulo fechado**.
- **START v3** — tratamentos indicados possivelmente ausentes (subtratamento), com
  **gating composto** (`alsoRequiresAnyOf`, ex.: DM2 **E** DCV/DRC para iSGLT2/GLP-1) e
  **gating por medicamento** (`requiresMedAnyOf`, ex.: gastroproteção só se há AINE em uso).
- **Carga anticolinérgica (ACB)** — score cumulativo.

## 6. Populações especiais
- Gestação e lactação (contraindicados/cautela).
- Ajuste/contraindicação **renal** e **hepática** por fármaco.

## 7. Necessidade, efetividade e adesão
- Automedicação sem indicação; duplicidade terapêutica (por classe).
- Baixa adesão → efetividade comprometida.
- Barreiras financeiras e de forma farmacêutica (a partir do relato do paciente).

---
*Manutenção:* novas regras devem vir acompanhadas de teste em `src/lib/prm-engine.test.ts`.
Alterações de schema do banco são **aditivas** (nunca `prisma db push` — DB compartilhado).
