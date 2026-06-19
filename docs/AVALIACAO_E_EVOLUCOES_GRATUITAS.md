# Avaliação geral + Evoluções de custo zero — PRM Care

> Avaliação de arquitetura/produto clínico. Objetivo: ampliar a **assertividade** no
> **monitoramento, detecção e correção de PRMs** e questões clínicas, usando apenas
> recursos **gratuitos** (dados públicos + técnicas sem licença). Data-base: 2026-06.

---

## 1. Onde estamos (avaliação geral)

### Forças (já implementado)
- **Motor determinístico robusto:** ~130 interações + classe×classe, triple whammy, cascatas, potássio alto/baixo, indutores/inibidores enzimáticos, MTX, DOAC×CYP3A4, quelação; **Beers 2023, STOPP/START v3**, contraindicações renal/hepática/gestação/lactação, **carga anticolinérgica (ACB)**, QT cumulativo, **regras laboratoriais** (HbA1c, K⁺, INR, Na⁺, LDL, TSH, TFG, digoxina, transaminases). Dedup por severidade. 87 testes.
- **IA híbrida correta:** Groq como camada **explicadora/grounded** (guardrails anti-alucinação, cache, trilha, Zod) — nunca inventa.
- **RAG inicial:** KnowledgeBase validada + **openFDA** + **rerank semântico (HF, grátis)**.
- **Farmacogenômica CPIC** integrada (alertas automáticos na análise e conciliação).
- **Módulos:** Interações, Conciliação (relatório/PDF/PNG/WhatsApp com consentimento), Calculadoras, Escalas.
- **LGPD/segurança:** auth + papéis, auditoria, consentimento, anonimização.

### Lacunas que limitam a assertividade (oportunidades)
1. **Interações são name-only:** não consideram **dose, via e duração** (ex.: AINE tópico ≠ oral; uso agudo ≠ crônico) → falsos positivos/negativos.
2. **Severidade não é ajustada ao paciente real:** idade/TFG/genótipo poderiam **reescalonar** a gravidade.
3. **Monitoramento é pontual, não longitudinal:** não há **tendência temporal** de exames (ex.: creatinina subindo) nem **re-alerta** automático.
4. **Detecção é sob demanda:** alertas só quando o farmacêutico roda a análise — falta **alerta proativo no cadastro/prescrição**.
5. **Normalização de fármacos frágil:** sem **ATC/RxNorm** — sinônimos/nomes comerciais podem escapar do matcher.
6. **Sem detecção de eventos adversos por "trigger tools"** (ex.: vitamina K/naloxona/antídotos como gatilho de evento).
7. **Orientação ao paciente** é gerada pela IA; falta fonte leiga padronizada citável.
8. **Sem sinal de farmacovigilância** (FAERS) nem **recalls/desabastecimento**.
9. **Feedback do farmacêutico** existe (ddi_feedback) mas não realimenta priorização.

---

## 2. Varredura de recursos GRATUITOS (dados públicos + técnicas)

### 2a. Fontes de dados públicas/gratuitas
| Fonte | O que oferece (grátis) | Uso no PRM Care | Obs. |
|---|---|---|---|
| **RxNorm / RxNav (NLM)** | Normalização de fármacos, RxCUI, **RxClass** (ATC/MoA/EPC) | Normalizar princípio ativo + classe → matcher mais robusto | API REST gratuita. ⚠️ a *DDI API* da NLM foi descontinuada (2024) — usar só normalização/classes |
| **WHO ATC/DDD** | Códigos ATC + DDD | Classificação canônica + checagem de dose por DDD | Índice público |
| **openFDA** (já integrado) | Labels, **FAERS** (eventos adversos), **recalls**, **shortages**, NDC | Sinais de farmacovigilância + alertas de recall/desabastecimento | API gratuita |
| **DailyMed (NLM)** | Bulas estruturadas (SPL) | Texto de interação/contraindicação citável | Gratuito |
| **ANVISA / Bulário** | Bulas BR, RENAME, listas | Fonte BR citável | Público |
| **PCDT (Ministério da Saúde)** | Protocolos Clínicos e Diretrizes Terapêuticas | Diretrizes BR para "medicamento ausente"/conduta | Público/PDF |
| **CPIC / PharmGKB** | Farmacogenômica | CPIC já feito; PharmGKB amplia pares | PharmGKB free p/ uso acadêmico |
| **NIH LiverTox** | Hepatotoxicidade (DILI) | Enriquecer risco hepático | Gratuito |
| **CredibleMeds (QTdrugs)** | Lista de fármacos QT | Já referenciado; manter atualizado | Registro gratuito (cadastro) |
| **MedlinePlus Connect** | Educação ao paciente (leigo) | Orientação ao paciente citável | API gratuita (EN/ES) |
| **LOINC** | Códigos de exames | Padronizar labResults | Gratuito |
| **CID-10 (já usado)** | Diagnósticos | Já no autocomplete | — |

### 2b. Técnicas/algoritmos sem licença (open knowledge)
| Técnica | Ganho de assertividade |
|---|---|
| **Drug Burden Index (DBI)** + ACB | Carga sedativa+anticolinérgica cumulativa (quedas/cognição em idosos) |
| **MAI (Medication Appropriateness Index)** | Avaliação estruturada de adequação por medicamento |
| **STOPPFrail / deprescrição** | Sinalização de deprescrição em frágeis/cuidados paliativos |
| **Trigger Tools (IHI Global Trigger Tool)** | Detecta evento adverso provável por "gatilhos" (antídotos, labs críticos) |
| **Cockcroft-Gault / CKD-EPI** (já há calculadora) | Reescalonar dose/contraindicação renal automaticamente |
| **Monitoramento temporal de exames** | Tendência (creatinina/K⁺/INR/HbA1c) → re-alerta proativo |
| **Severidade ajustada ao contexto** | Reescalonar gravidade por idade/TFG/genótipo |
| **Dose/duração-aware** | Reduz falso +/- nas interações |
| **NLP via LLM (já temos Groq)** | Extrair meds/condições de texto livre/recortes |
| **Active learning com feedback** | Usar ddi_feedback p/ priorizar/ocultar ruído |
| **Embeddings HF (já temos)** | Busca semântica de protocolos/condições |

---

## 3. Roadmap priorizado (tudo gratuito) — por valor ÷ esforço

### 🟢 Quick wins (alto valor, baixo esforço)
1. **Normalização RxNorm/ATC** dos fármacos no cadastro/consulta → matcher pega sinônimos/comerciais (reduz **falso negativo**). *(API gratuita; cache local.)*
2. **Monitoramento temporal de exames** → comparar valor atual vs anterior; **re-alertar** quando piora (creatinina↑, K⁺↑, INR fora de faixa, HbA1c↑). *(Só usa dados já no banco.)*
3. **Severidade ajustada ao paciente** → reescalonar gravidade de interações/regras por **idade + TFG real + gestação** (já temos os dados). Reduz **falso positivo** e prioriza o que importa.
4. **Alerta proativo no cadastro de medicamento** → rodar `checkInteractions` ao adicionar um fármaco, avisando na hora (não só na análise sob demanda).
5. **Recalls/desabastecimento (openFDA)** → flag quando um fármaco do paciente tem recall/shortage ativo.

### 🟡 Médio prazo (alto valor, esforço médio)
6. **Dose/duração-aware** nas interações e regras (campos já existem em `Medication`): ex.: AINE crônico vs SOS, paracetamol >2 g/dia, benzodiazepínico >4 semanas.
7. **Drug Burden Index + MAI** como índices estruturados (idosos/polifarmácia).
8. **FAERS (openFDA) como sinal de farmacovigilância** → "efeito X é sinal conhecido deste fármaco".
9. **Orientação ao paciente padronizada** (MedlinePlus/PCDT) citável, além da IA.
10. **PCDT/RENAME** como base de "medicamento indicado ausente" (START brasileiro) + condutas SUS.

### 🔵 Estrutural (alto valor, maior esforço)
11. **pgvector + corpus pré-embedado** (DailyMed/PCDT/bulas) → RAG semântico real e citável (já temos embeddings HF; falta indexar corpus).
12. **Camada de verificação adversarial** ampliada (multi-perspectiva) para achados de alto risco.
13. **Painel de farmacovigilância/indicadores** (intervenções aceitas, desfechos, PRMs por classe) — valor para a Secretaria.
14. **Trigger tools** para detecção retrospectiva de eventos adversos.
15. **Interoperabilidade FHIR** (MedicationStatement/DetectedIssue) — exportação.

---

## 4. Top 5 recomendações (maior impacto na assertividade, custo zero)

1. **Normalização RxNorm/ATC** — sem isso, todo o resto perde fármacos por nome. *(Fundacional.)*
2. **Monitoramento temporal + re-alerta** — transforma a ferramenta de "pontual" em "vigilância contínua" (o coração do "monitoramento" que o usuário pediu).
3. **Severidade ajustada ao paciente (idade/TFG/genótipo)** — combate a fadiga de alerta e eleva a precisão.
4. **Alerta proativo no cadastro** — detecta o PRM no momento da prescrição/registro, não depois.
5. **Dose/duração-aware** — elimina uma classe inteira de falsos positivos/negativos.

> Todas usam **dados já no banco** ou **APIs públicas gratuitas** + a infra que já temos (motor, Groq, embeddings HF, openFDA). Nenhuma exige licença paga.

---

## 5. Princípios mantidos
Apoio à decisão (nunca prescritivo/diagnóstico autônomo); IA só organiza/explica fontes; toda saída com base técnica, nível de confiança, referência e ressalva de avaliação profissional; LGPD; DB compartilhado → schema só por SQL aditivo.
