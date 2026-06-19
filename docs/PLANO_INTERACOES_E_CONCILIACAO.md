# Plano de Implementação — Módulo de Interações Medicamentosas + Relatório de Conciliação

> **PRM Care** · Apoio à decisão clínica farmacêutica (não diagnóstico/prescritivo autônomo).
> Documento de arquitetura. Autor: arquitetura sênior / saúde digital. Data-base: 2026-06.
> RT do produto: Farm. Dr. Edson Sidião de Souza Júnior.

---

## 0. Princípios inegociáveis (valem para tudo abaixo)

1. **Apoio, nunca substituição.** Toda saída clínica traz: base técnica, nível de confiança, referência, recomendação de avaliação profissional e a nota de que a conduta final é do farmacêutico (considerando paciente, dose, via, duração, comorbidades, exames, contexto).
2. **A IA não inventa.** A verdade clínica vem do **banco estruturado** + **RAG sobre fontes versionadas**. A IA generativa **só organiza, resume e explica** o que veio dessas fontes. Sem dado → "não foram encontradas interações relevantes na base disponível" e **ausência de evidência ≠ ausência de risco**.
3. **DB compartilhado.** O Supabase é compartilhado com o `prm-care-marketing`. **NUNCA `prisma db push`.** Schema novo entra por **SQL aditivo** (`prisma db execute --file`, `DATABASE_URL` na porta direta **5432**) + `prisma generate`. Tabelas novas com prefixo claro (`ddi_*`, `recon_*`).
4. **Reuso do que já existe.** Não duplicar a base clínica: o motor (`prm-engine.ts`) já tem ~130 interações (`KNOWN_INTERACTIONS`), `CLASS_INTERACTIONS`, dedup por severidade (`SEVERITY_RANK`) e `findLabBasedPRMs`. A IA já tem `callGroqWithRetry`, guardrails (`sanitizeAiFindings`), cache (`hashContext`/`getCachedAi`), trilha (`logAi`) e Zod. Reusar `AuditLog`, `ConsentRecord`, `KnowledgeBase`.
5. **LGPD by design.** Mínimo de dados, consentimento explícito para WhatsApp, anonimização parcial, trilha de auditoria, sem PII em logs/prompt-hash.

---

## 1. Diagnóstico técnico — o que já existe vs. o que falta

### Já existe (reaproveitar)
| Recurso | Onde | Uso no novo módulo |
|---|---|---|
| Base de interações (~130 pares + classe×classe) | `src/lib/prm-engine.ts` (`KNOWN_INTERACTIONS`, `CLASS_INTERACTIONS`, `findInteractions`, `SEVERITY_RANK`) | Núcleo determinístico da consulta de interações |
| Regras laboratoriais e por condição | `findLabBasedPRMs`, `STOPP/START`, `FOOD_DRUG_INTERACTIONS` | Risco renal/hepático/eletrolítico/idoso/gestante |
| IA resiliente + guardrails + cache + trilha | `src/lib/gemini-service.ts`, `ai-guardrails.ts`, `ai-cache.ts` | Camada generativa de organização/explicação |
| Auth + papéis + auditoria + consentimento | NextAuth (`lib/auth.ts`), `AuditLog`, `ConsentRecord` | Segurança, trilha, consentimento WhatsApp |
| Conciliação (UI) | `app/(dashboard)/patients/[id]/reconciliation/page.tsx`, `components/reconciliation/*` | Base da Feature 2 |
| Impressão/PDF | páginas `report`/`referral` (print CSS) + Chrome/headless no build | Relatórios |
| KnowledgeBase | `model KnowledgeBase` | Origem de RAG institucional |

### Falta criar
- **Feature 1:** módulo "Interações Medicamentosas" (rota, página, endpoint), **refator do motor** para expor `checkInteractions()`, **persistência da consulta** (`ddi_query`/`ddi_result`), **taxonomia de interação** (tipos/mecanismos), camada **RAG** (pgvector + tabela de trechos com fonte/versão), e os campos clínicos por interação que hoje o motor não traz (nível de evidência, sinais de alerta, alternativas, orientação ao paciente, referências).
- **Feature 2:** **modelo persistente de conciliação** (hoje é computada on-the-fly), **gerador de relatório** (técnico/simplificado), exportação **PDF/PNG**, **compartilhamento WhatsApp** com consentimento + anonimização, e os botões/telas de pré-visualização.
- **Transversal:** extensão `vector` no Postgres, embeddings, versionamento de fontes, feedback do farmacêutico, expansão do `AuditLog` para os novos eventos.

---

## 2. Arquitetura funcional

```
┌─────────────────────────── PRM Care (Next.js App Router) ───────────────────────────┐
│  UI (React/TS)                                                                       │
│   • /interactions            • /patients/[id]/reconciliation (+ /report)             │
│   • <InteractionChecker/>    • <ReconciliationReport/> + <SharePreview/>             │
├──────────────────────────────────────────────────────────────────────────────────── │
│  API Routes (server, autenticadas)                                                   │
│   • POST /api/interactions/check        • POST /api/reconciliation                    │
│   • POST /api/interactions/:id/decision • GET  /api/reconciliation/:id                │
│   • POST /api/interactions/:id/feedback • POST /api/reconciliation/:id/report         │
│                                          • POST /api/reconciliation/:id/share         │
├──────────────────────────────────────────────────────────────────────────────────── │
│  Domínio / Serviços                                                                  │
│   ddi-service (núcleo determinístico)  ── reusa prm-engine.checkInteractions()       │
│   rag-service (embeddings + retrieval) ── pgvector                                    │
│   ai-explainer (Groq) ── callGroqWithRetry + guardrails + cache + logAi               │
│   reconciliation-service ── diff em uso × prescrição, persistência                    │
│   report-service ── HTML→PDF (Chrome headless) / PNG (canvas) / texto WhatsApp        │
│   consent/anonymize ── ConsentRecord + máscara de PII                                 │
├──────────────────────────────────────────────────────────────────────────────────── │
│  Dados (Supabase/Postgres + Prisma)                                                  │
│   ddi_* (base de interações, taxonomia, fontes, RAG)  recon_* (conciliação, itens)   │
│   reuso: users, patients, medications, allergies, audit_logs, consent_records        │
└──────────────────────────────────────────────────────────────────────────────────── ┘
```

**Pipeline híbrido da consulta de interações (ordem importa):**
```
medicamentos → normalização (ATC/princípio ativo)
   → [1] consulta determinística (ddi_interaction + motor)        ← fonte primária
   → [2] RAG: recupera trechos das fontes versionadas (pgvector)  ← contexto factual
   → [3] IA generativa: SÓ organiza/resume/explica [1]+[2]         ← nunca cria interação
   → guardrails (dedup, anti-alucinação) → Zod → cache → logAi
   → resposta (técnica + simplificada) + síntese de risco global
```

---

## 3. Fluxos de usuário

### 3.1 Consulta de interações
1. Farmacêutico abre **Interações Medicamentosas** (avulso) ou a partir de um paciente.
2. Adiciona ≥2 medicamentos (autocomplete por princípio ativo/nome comercial/ATC). Opcional: vincular paciente (idade, gestação, função renal/hepática, exames) → habilita riscos contextuais.
3. Clica **Consultar**. Sistema cruza todos os pares + checagens de classe/condição/lab.
4. Resultado: **cards por interação** (cor por gravidade) + **síntese de risco global** + advertência.
5. Ações: salvar no prontuário, PDF, imprimir, copiar resumo, gerar orientação ao paciente, **registrar decisão clínica** (houve intervenção? contato com prescritor? desfecho?), **feedback de utilidade**.

### 3.2 Conciliação → relatório → compartilhamento
1. Na conciliação do paciente, monta colunas **Em uso × Prescrição** (já existe a UI) e marca confirmados/suspensos/adicionados/dose/horário/duplicidade/PRM.
2. **Gerar relatório** → pré-visualização (alternar **técnica ⇄ simplificada**).
3. Exportar: **Imprimir / PDF / PNG (WhatsApp)**.
4. **Enviar ao paciente (WhatsApp)**: tela de pré-visualização → alerta de dados sensíveis → opção de **anonimização parcial** → **registrar consentimento** → gera `wa.me` com texto seguro → registra data/hora do envio no `AuditLog`.
5. Anexar ao prontuário; plano de acompanhamento.

---

## 4–5. Banco de dados (modelos sugeridos)

> Convenção: tabelas novas com prefixo `ddi_` (drug–drug interactions) e `recon_`. Criadas por **SQL aditivo**. Abaixo em sintaxe Prisma (referência) — gerar o SQL correspondente para `db execute`.

### 4.1 Base farmacológica e taxonomia
```prisma
model DdiDrug {                       // @@map("ddi_drugs")
  id            String  @id @default(cuid())
  activeName    String  @unique       // princípio ativo normalizado (lower, sem acento)
  atcCode       String?               // WHO ATC
  therapClass   String?               // classe terapêutica
  cypSubstrate  String[]              // ex.: ["CYP2C19","CYP3A4"]
  cypInhibitor  String[]
  cypInducer    String[]
  transporters  String[]              // P-gp, OATP...
  tradeNames    DdiTradeName[]
  forms         String[]              // comprimido, solução...
  routes        String[]              // oral, IV...
  pregnancyCat  String?               // A/B/C/D/X (quando aplicável)
  renalAdjust   Boolean @default(false)
  hepaticAdjust Boolean @default(false)
  updatedAt     DateTime @updatedAt
}
model DdiTradeName { id String @id @default(cuid()) drugId String name String  @@map("ddi_trade_names") }

model DdiInteraction {               // @@map("ddi_interactions")  — par medicamento×medicamento
  id            String  @id @default(cuid())
  drugAId       String
  drugBId       String
  // taxonomia exigida:
  kinetic       Boolean @default(false)   // farmacocinética
  dynamic       Boolean @default(false)   // farmacodinâmica
  phase         String[]                   // absorcao, distribuicao, metabolismo, excrecao
  effectType    String[]                   // sinergismo, antagonismo, toxicidade, reducao_efeito
  riskTags      String[]                   // sangramento, cardiovascular, renal, hepatico, neurologico, gi, eletrolitico, idoso, gestante
  mechanism     String                     // mecanismo provável
  severity      DdiSeverity                // LEVE | MODERADA | GRAVE | CONTRAINDICADA
  evidenceLevel DdiEvidence                // ALTA | MODERADA | BAIXA | TEORICA
  clinicalEffect String                    // consequência esperada
  warningSigns  String                     // sinais/sintomas de alerta
  conduct       String                     // conduta farmacêutica
  needsReferral Boolean @default(false)
  alternatives  String?                    // alternativas terapêuticas
  monitoring    String?                    // parâmetros lab/clínicos
  patientMsg    String?                    // orientação simplificada
  sources       DdiInteractionSource[]
  version       Int     @default(1)        // versionamento do conteúdo
  isActive      Boolean @default(true)
  updatedAt     DateTime @updatedAt
  @@unique([drugAId, drugBId, version])
  @@index([drugAId]) @@index([drugBId])
}
enum DdiSeverity { LEVE MODERADA GRAVE CONTRAINDICADA }
enum DdiEvidence { ALTA MODERADA BAIXA TEORICA }

model DdiClassInteraction { id String @id @default(cuid()) classA String classB String /* idem campos de DdiInteraction */  @@map("ddi_class_interactions") }
model DdiFoodInteraction  { id String @id @default(cuid()) drugId String agent String /* alimento/álcool */ severity DdiSeverity mechanism String conduct String sources DdiInteractionSource[]  @@map("ddi_food_interactions") }
model DdiConditionInteraction { id String @id @default(cuid()) drugId String conditionKeywords String[] severity DdiSeverity warning String  @@map("ddi_condition_interactions") }
```

### 4.2 Fontes, RAG e versionamento
```prisma
model DdiSource {                    // @@map("ddi_sources")  — rastreabilidade da fonte
  id        String @id @default(cuid())
  kind      String        // BULA | ANVISA | FDA | EMA | WHO_ATC | PUBMED | DIRETRIZ | PROTOCOLO | MICROMEDEX | LEXICOMP | DRUGBANK
  title     String
  citation  String        // referência formatada
  url       String?
  retrievedAt DateTime?
  version   String?       // versão/edição da fonte
}
model DdiInteractionSource { id String @id @default(cuid()) interactionId String sourceId String  @@map("ddi_interaction_sources") }

model DdiRagChunk {                  // @@map("ddi_rag_chunks")  — RAG vetorial
  id        String @id @default(cuid())
  sourceId  String
  content   String              // trecho técnico
  // embedding vector(1536)  — coluna pgvector criada via SQL aditivo (ver §11)
  drugRefs  String[]            // princípios ativos citados (filtro pré-busca)
  version   Int    @default(1)
  createdAt DateTime @default(now())
}
```

### 4.3 Consultas, decisão clínica, auditoria de IA e feedback
```prisma
model DdiQuery {                     // @@map("ddi_queries")
  id          String @id @default(cuid())
  userId      String                 // farmacêutico
  patientId   String?                // opcional
  inputDrugs  Json                   // [{activeName, dose?, route?}]
  context     Json?                  // {age,isPregnant,renal,hepatic,labs}
  riskGlobal  DdiSeverity?           // síntese
  createdAt   DateTime @default(now())
  results     DdiResult[]
  decision    DdiDecision?
}
model DdiResult {                    // @@map("ddi_results")  — 1 por interação encontrada
  id           String @id @default(cuid())
  queryId      String
  source       String               // "ENGINE" | "DB" | "RAG"  (proveniência)
  payload      Json                  // snapshot completo da interação renderizada
  severity     DdiSeverity
  aiExplained  Boolean @default(false)
}
model DdiDecision {                  // @@map("ddi_decisions")  — registro da conduta
  id            String @id @default(cuid())
  queryId       String @unique
  note          String
  intervened    Boolean @default(false)   // houve intervenção farmacêutica?
  contactedMD   Boolean @default(false)   // contato com prescritor?
  outcome       String?                   // desfecho da intervenção
  createdAt     DateTime @default(now())
}
model AiResponseAudit {              // @@map("ai_response_audits")  — auditoria das respostas de IA
  id          String @id @default(cuid())
  feature     String       // "DDI" | "RECON_REPORT"
  refId       String       // queryId/reconciliationId
  model       String
  promptHash  String       // sem PII
  inputTokens Int?
  outputTokens Int?
  status      String       // SUCCESS | FALLBACK | CACHED | FAILED | BLOCKED_GUARDRAIL
  createdAt   DateTime @default(now())
}
model DdiFeedback {                  // @@map("ddi_feedback")  — utilidade percebida
  id        String @id @default(cuid())
  queryId   String
  userId    String
  useful    Boolean
  comment   String?
  createdAt DateTime @default(now())
}
```

### 4.4 Conciliação (persistência — hoje inexistente)
```prisma
model Reconciliation {              // @@map("reconciliations")
  id            String @id @default(cuid())
  patientId     String
  userId        String              // farmacêutico responsável
  reconciledAt  DateTime @default(now())
  source        String?             // admissão | alta | ambulatorial | troca de serviço
  riskSummary   String?
  followUpPlan  String?
  prescriberRecs String?
  patientGuidance String?
  items         ReconciliationItem[]
  reports       ReconciliationReport[]
  createdAt     DateTime @default(now())
}
model ReconciliationItem {          // @@map("reconciliation_items")
  id            String @id @default(cuid())
  reconciliationId String
  activeName    String
  doseBefore    String?
  doseAfter     String?
  scheduleBefore String?
  scheduleAfter String?
  status        ReconStatus          // CONFIRMADO | SUSPENSO | ADICIONADO | DOSE_ALTERADA | HORARIO_ALTERADO | DUPLICIDADE
  isSelfMed     Boolean @default(false)
  isHerbalSupp  Boolean @default(false)
  prmNote       String?              // problema relacionado a medicamento
  intervention  String?              // intervenção farmacêutica
}
enum ReconStatus { CONFIRMADO SUSPENSO ADICIONADO DOSE_ALTERADA HORARIO_ALTERADO DUPLICIDADE }

model ReconciliationReport {        // @@map("reconciliation_reports")
  id            String @id @default(cuid())
  reconciliationId String
  variant       String              // "TECNICA" | "SIMPLIFICADA"
  format        String              // "PDF" | "PNG" | "TEXT"
  storagePath   String?             // Supabase Storage (privado)
  sharedAt      DateTime?
  sharedChannel String?             // "WHATSAPP" | "DOWNLOAD" | "PRINT"
  consentId     String?             // FK ConsentRecord (envio WhatsApp)
  anonymized    Boolean @default(false)
  createdAt     DateTime @default(now())
}
```

> **Migração de conteúdo:** os ~130 pares de `KNOWN_INTERACTIONS` + `CLASS_INTERACTIONS` são a **semente** de `ddi_interactions`/`ddi_class_interactions` (script `seed-ddi.ts`). A taxonomia rica (tipo/mecanismo/evidência/alerta/alternativas) é preenchida incrementalmente — começar pelas GRAVE/CONTRAINDICADA.

---

## 6. APIs / endpoints

| Método | Rota | Função | Auth |
|---|---|---|---|
| POST | `/api/interactions/check` | Recebe lista de medicamentos (+contexto), retorna interações + risco global | farmacêutico |
| POST | `/api/interactions/:id/decision` | Registra decisão clínica (intervenção/contato/desfecho) | farmacêutico |
| POST | `/api/interactions/:id/feedback` | Feedback de utilidade | farmacêutico |
| GET | `/api/interactions/:id` | Recupera consulta salva | dono/instituição |
| GET | `/api/drugs/search?q=` | Autocomplete (ddi_drugs + trade names) | farmacêutico |
| POST | `/api/reconciliation` | Cria/atualiza conciliação + itens | farmacêutico |
| GET | `/api/reconciliation/:id` | Lê conciliação | dono |
| POST | `/api/reconciliation/:id/report` | Gera relatório (variant técnica/simplificada; format PDF/PNG/TEXT) | farmacêutico |
| POST | `/api/reconciliation/:id/share` | Registra consentimento + gera link `wa.me`/log de envio | farmacêutico |
| (admin) | `/api/ddi/sources`, `/api/ddi/import` | Curadoria/versionamento da base e RAG | ADMIN |

**Contratos (resumo):**
```ts
// POST /api/interactions/check
type CheckBody = { drugs: {activeName:string; dose?:string; route?:string}[]; patientId?:string;
                   context?: {age?:number; isPregnant?:boolean; renal?:string; hepatic?:string; labs?:{name:string;value:string}[]} }
type CheckResp = { riskGlobal: DdiSeverity; advisory: string;
  interactions: InteractionCard[]; notFound?: boolean; meta:{model?:string; cached:boolean} }
```

---

## 7. Componentes de interface

**Feature 1**
- `app/(dashboard)/interactions/page.tsx` — entrada do módulo.
- `<DrugMultiInput/>` — autocomplete multi-seleção (ATC/comercial), chips removíveis.
- `<PatientContextToggle/>` — vincular paciente p/ riscos contextuais.
- `<InteractionCard/>` — cor por gravidade (verde/amarelo/laranja/vermelho), abas: técnica | paciente; mostra todos os campos (mecanismo, evidência, alerta, conduta, alternativas, monitorar, referências, advertência).
- `<RiskGlobalBanner/>` — síntese (gravidade máxima + contagem).
- `<DecisionForm/>` — intervenção? contato MD? desfecho.
- `<UsefulnessFeedback/>` — 👍/👎 + comentário.
- Ações: `<ExportBar/>` (PDF/Imprimir/Copiar/Orientação ao paciente/Salvar no prontuário).

**Feature 2** (estende `components/reconciliation/*`)
- `<ReconciliationBoard/>` (já há `MedScheduleGrid`) — colunas Em uso × Prescrição + status.
- `<ReconciliationReport/>` — layout institucional (cards de medicamentos/intervenções, destaque de alertas), responsivo, com `@media print`.
- `<ReportVariantSwitch/>` — técnica ⇄ simplificada.
- `<SharePreview/>` — pré-visualização + alerta de PII + toggle anonimização + checkbox consentimento → botão "Enviar ao paciente" (`wa.me`).
- `<CompactImageCard/>` — versão compacta para PNG (html-to-image/canvas).
- Botões: Gerar relatório · Imprimir · Baixar PDF · Gerar imagem WhatsApp · Enviar ao paciente.

---

## 8. Segurança e privacidade
- **AuthZ:** só `PROFESSIONAL`/`ADMIN`/`INSTITUTIONAL_MANAGER`; cada consulta/conciliação amarrada ao `userId`; leitura restrita ao dono/instituição (evitar IDOR — checar `where:{id, userId}` como já feito em `/api/analysis`).
- **Auditoria:** `AuditLog` para CHECK_INTERACTION, SAVE_DECISION, GENERATE_REPORT, SHARE_WHATSAPP (com data/hora, sem PII desnecessária); `AiResponseAudit` para toda chamada de IA.
- **Consentimento WhatsApp:** `ConsentRecord` obrigatório antes do envio (escopo "envio de relatório por mensagem"), com expiração/registro.
- **Anonimização parcial:** mascarar nome (iniciais), nunca expor CPF; texto WhatsApp sem dados clínicos sensíveis desnecessários; opção "ocultar dados sensíveis".
- **Sem PII em prompts/logs:** prompt hash sem identificadores; embeddings só de conteúdo técnico (não de dados do paciente).
- **Transporte/armazenamento:** PDFs/PNGs em **Supabase Storage privado** (signed URL curta); HTTPS; rate-limit em `/check`.
- **wa.me** abre o WhatsApp do usuário com texto pré-montado — **nenhum dado trafega por servidor de terceiros** além do que o farmacêutico confirma enviar.

---

## 9. Regras de IA clínica
1. **Fonte da verdade = determinístico + RAG.** A IA recebe os achados já estruturados e os trechos recuperados; **proibido** adicionar interação fora desse conjunto (guardrail: descartar/*flag* item cujo par não esteja em `[engine]∪[db]∪[rag-citado]`).
2. **Sempre** retornar: base técnica, **nível de confiança/evidência**, **referência**, recomendação de avaliação profissional, e a nota de conduta final do farmacêutico.
3. **Ausência de dado:** declarar explicitamente "não encontradas interações relevantes na base disponível" e que **ausência de evidência ≠ ausência de risco**.
4. **Duas vozes:** versão **técnica** (farmacêutico) e **simplificada** (paciente) — esta sem jargão, sem alarmismo, com o que observar e "procure orientação".
5. Reusar `sanitizeAiFindings` (anti-alucinação), `verifyHighRiskFindings` (2º passe cético em GRAVE/CONTRAINDICADA), `getCachedAi` (cache 24h por hash do contexto), `logAi`/`AiResponseAudit` (trilha), validação **Zod** da saída.
6. **Temperatura baixa** (≤0.15), `response_format: json`, retries+fallback de modelo (`callGroqWithRetry`).

---

## 10. Prompt base — IA de Interações (camada explicadora)

```text
SYSTEM:
Você é farmacêutico clínico sênior. Sua tarefa é ORGANIZAR, RESUMIR e EXPLICAR
interações medicamentosas que JÁ FORAM IDENTIFICADAS por um motor determinístico e por
trechos técnicos recuperados (RAG). VOCÊ NÃO PODE INVENTAR, INFERIR OU ADICIONAR
qualquer interação que não esteja explicitamente nos dados fornecidos.

REGRAS:
- Use SOMENTE os ACHADOS e as FONTES fornecidos. Não cite fonte que não esteja na lista.
- Se a lista de achados estiver vazia, responda: "Não foram encontradas interações
  relevantes na base disponível" e acrescente que ausência de evidência não é ausência de risco.
- Para CADA interação, produza os campos do schema (mecanismo, gravidade, evidência,
  efeito clínico, sinais de alerta, conduta, encaminhamento, alternativas, monitoramento,
  mensagem ao paciente, referências) — derivados APENAS dos dados.
- Diferencie farmacocinética/farmacodinâmica e os riscos (sangramento, renal, hepático,
  cardiovascular, neurológico, GI, eletrolítico, idoso, gestante) conforme as tags fornecidas.
- Gere uma SÍNTESE DE RISCO GLOBAL (gravidade máxima + principais focos de monitoramento).
- Sempre inclua a advertência: esta informação é apoio à decisão e não substitui a
  avaliação clínica individualizada; a conduta final é do farmacêutico, considerando
  paciente, dose, via, duração, comorbidades, exames e contexto.
- Responda em JSON válido conforme o schema. Linguagem técnica em "tecnica" e leiga em "paciente".

USER (montado pelo servidor):
CONTEXTO DO PACIENTE: {idade, gestação, função renal/hepática, exames}  // se houver
ACHADOS DETERMINÍSTICOS (não altere, apenas explique):
{json dos pares: medicamentos, tipo, mecanismo, gravidade, evidência, tags, conduta...}
TRECHOS DE FONTES (RAG, com citação):
{[{citation, content}]}
TAREFA: organizar/explicar e gerar a síntese global + versão ao paciente.
```

## 11-prompt. Prompt base — Relatório de Conciliação

```text
SYSTEM:
Você é farmacêutico clínico. Gere o TEXTO do relatório de conciliação medicamentosa a
partir EXCLUSIVAMENTE dos dados estruturados fornecidos (não invente medicamentos,
doses ou condutas). Produza DUAS variantes quando solicitado:
- TECNICA: linguagem profissional, formato institucional (SOAP-like), para prontuário/prescritor.
- SIMPLIFICADA: linguagem clara e empática ao paciente, sem jargão, com o que fazer e o que observar.
REGRAS:
- Estruture: identificação, data, farmacêutico responsável; medicamentos antes/confirmados/
  suspensos/adicionados/dose/horário; duplicidades; PRMs; alergias; automedicação;
  fitoterápicos/suplementos; adesão; riscos; intervenções; orientações ao paciente;
  recomendações ao prescritor; plano de acompanhamento.
- Para a versão WhatsApp/simplificada: NÃO inclua dados sensíveis desnecessários; respeite
  a anonimização solicitada (iniciais; sem CPF; sem diagnósticos sensíveis).
- Encerre SEMPRE com: "Instrumento de cuidado farmacêutico; não substitui avaliação médica."
USER (montado pelo servidor): {json da conciliação + variante + flags de anonimização}
```

---

## 12. Pseudocódigo / exemplos

### 12.1 Refator do motor (expor reuso) — `prm-engine.ts`
```ts
// tornar reutilizável fora do analyzePRM:
export function checkInteractions(meds: MedContext[], ctx?: PatientCtx): RawInteraction[] {
  const pairs = findInteractions(meds)          // já com dedup por par + SEVERITY_RANK
  // + risco contextual via findLabBasedPRMs/STOPP/condition quando ctx presente
  return pairs.map(toRawInteraction)
}
```

### 12.2 Serviço de consulta (`ddi-service.ts`)
```ts
export async function runInteractionCheck(body: CheckBody, user: SessionUser) {
  const meds = await normalizeDrugs(body.drugs)             // → activeName + ATC (ddi_drugs)
  const engine = checkInteractions(meds, body.context)      // [1] determinístico (fonte de verdade)
  const dbHits = await queryDdiInteractions(meds)           // [2] base curada (taxonomia rica)
  const merged = dedupeBySeverity([...engine, ...dbHits])   // mantém maior gravidade
  if (merged.length === 0)
    return { riskGlobal: null, interactions: [], notFound: true, advisory: ADVISORY }

  const chunks = await ragRetrieve(meds, merged)            // [3] trechos versionados (pgvector)
  const hash = hashContext({ meds, ctx: body.context, ids: merged.map(m=>m.id) })
  const ai = await getCachedAi(hash) ?? await explainWithGroq(merged, chunks, body.context) // organiza/explica
  const safe = sanitizeAiFindings(ai, merged)               // guardrail: nada fora de `merged`
  const validated = DdiResponseSchema.safeParse(safe)       // Zod
  await persistQuery(user, body, merged, validated)         // ddi_queries/ddi_results
  await logAiAudit({ feature:'DDI', ... })                  // AiResponseAudit
  return buildResponse(merged, validated, computeGlobalRisk(merged))
}
```

### 12.3 Compartilhamento WhatsApp seguro
```ts
async function shareReconciliation(id, { anonymize, consent }, user) {
  if (!consent) throw new Error('Consentimento obrigatório')
  await recordConsent(patientId, 'WHATSAPP_REPORT', user.id)        // ConsentRecord
  const text = buildWhatsAppText(report, { anonymize })            // sem PII desnecessária
  await audit('SHARE_WHATSAPP', { reconciliationId:id, anonymize, at:new Date() })
  return `https://wa.me/${e164(phone)}?text=${encodeURIComponent(text)}`
}
```

### 12.4 pgvector (SQL aditivo — porta 5432)
```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE ddi_rag_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536);
CREATE INDEX IF NOT EXISTS ddi_rag_chunks_embedding_idx
  ON ddi_rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## 13. Critérios de aceite
**Feature 1**
- [ ] Consultar ≥2 medicamentos e ver interações cruzadas (todos os pares).
- [ ] Cada card traz os 14 campos exigidos + advertência; cor por gravidade; síntese global.
- [ ] Versão técnica e versão ao paciente.
- [ ] Sem dado → mensagem explícita de "nenhuma interação relevante na base" + ressalva de risco.
- [ ] IA nunca cria interação fora de engine∪db∪rag (validado por teste de guardrail).
- [ ] Salvar no prontuário, PDF, imprimir, copiar, registrar decisão/intervenção/contato/desfecho, feedback.
- [ ] Toda resposta tem base técnica + nível de confiança + referência + ressalva profissional.

**Feature 2**
- [ ] Relatório contém todos os blocos listados (identificação → plano de acompanhamento + ressalva).
- [ ] Variantes técnica/simplificada; imprimir, PDF, PNG.
- [ ] WhatsApp: confirmação, alerta de PII, anonimização, consentimento, log de data/hora.
- [ ] Layout responsivo (desktop/tablet/celular) e versão compacta para imagem.

**Transversal**
- [ ] AuthZ sem IDOR; auditoria de todas as ações e respostas de IA; sem PII em logs.
- [ ] Nenhuma alteração de schema via `db push`; só SQL aditivo (CI verifica).

## 14. Checklist de testes
- **Unidade:** `checkInteractions` (pares, classe, dedup severidade); normalização ATC; `computeGlobalRisk`; mascaramento/anonimização; `buildWhatsAppText` (sem PII).
- **Guardrail/IA:** prompt com achados vazios → "não encontradas"; IA tentando adicionar par inexistente → descartado; saída fora do schema Zod → rejeitada; cache hit não rechama Groq.
- **Integração (API):** `/check` (≥2 meds, com/sem paciente), `/decision`, `/feedback`, `/reconciliation` CRUD, `/report` (PDF/PNG/TEXT), `/share` (sem consentimento → 4xx).
- **Segurança:** acesso a consulta de outro usuário → 403; ausência de role → bloqueio; rate-limit.
- **E2E (Playwright):** fluxo completo de interações; fluxo conciliação→relatório→pré-visualização→WhatsApp.
- **Acessibilidade/responsivo:** contraste das cores de gravidade; layout em 360px.
- **Regressão clínica:** as 130+ interações existentes continuam detectadas (suíte vitest atual: 78 testes).

## 15. Melhorias futuras
- Licenciar **Micromedex/Lexicomp/DrugBank** e mapear para `ddi_sources` com versionamento.
- **Interação medicamento-genótipo** (farmacogenômica, CYP2C19/2D6).
- **Severidade ajustada ao paciente** (idade/função renal real → reescalonar gravidade).
- **Alertas proativos** ao prescrever (no cadastro de medicamento, não só sob demanda).
- **WhatsApp Business API** oficial (em vez de `wa.me`) com templates aprovados + opt-in gerenciado.
- **Painel de curadoria** da base (revisão por pares, fila de validação, diff de versões).
- **Métricas de impacto** (intervenções aceitas, desfechos) para indicadores da Secretaria.
- **Exportação FHIR** (MedicationStatement/DetectedIssue) para interoperabilidade.

---

### Faseamento sugerido (entregas incrementais)
1. **Fase 1 (MVP determinístico):** refator `checkInteractions`, módulo `/interactions` + `/api/check` reusando a base atual, cards+síntese+PDF/print, persistência `ddi_queries`/decisão/feedback. *(Sem RAG/IA ainda — já é clinicamente útil.)*
2. **Fase 2 (Conciliação pro):** persistência `recon_*`, gerador de relatório (técnica/simplificada), PDF/PNG, WhatsApp com consentimento/anonimização.
3. **Fase 3 (RAG + IA explicadora):** `ddi_sources`/`ddi_rag_chunks` + pgvector, embeddings, camada Groq de explicação com guardrails/auditoria; curadoria da taxonomia rica.
4. **Fase 4 (escala):** licenças de base, farmacogenômica, alertas proativos, FHIR, painel de curadoria.
