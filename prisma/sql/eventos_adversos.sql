-- Registro estruturado de suspeita de reação adversa a medicamento (lacuna 10).
--
-- O PROBLEMA: o sistema detecta a suspeita com todos os dados já estruturados —
-- paciente, fármaco, desfecho — e depois abandona o farmacêutico, que redigita
-- tudo no portal da ANVISA. Na prática, a notificação não acontece.
--
-- O QUE ESTA TABELA É: o registro clínico da suspeita, no prontuário, com os
-- campos que o VigiMed exige. NÃO é submissão automática — o VigiMed não expõe
-- API pública para notificação por profissional; o envio segue pelo formulário
-- aberto da ANVISA. O que entregamos é a ficha pronta para transcrição, mais o
-- registro de que a notificação foi feita e sob qual protocolo.
--
-- CAMPOS OBRIGATÓRIOS DO VIGIMED (verificados em 02/09/2026): iniciais do
-- paciente, sexo, data de nascimento ou idade na reação, descrição do evento com
-- data de início, medicamento suspeito, e profissão + contato do notificador.
-- Guardamos INICIAIS na ficha, nunca o nome — é o que a norma pede e reduz
-- exposição desnecessária.
--
-- ⚠️ BANCO COMPARTILHADO com o prm-care-marketing. Aplicar pelo DIRECT_URL
-- (porta 5432). Nunca `prisma db push` nem `prisma migrate dev`.

-- ── PASSO 1 — PRÉ-VOO ───────────────────────────────────────────────────────
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema='public' AND table_name='adverse_event_reports';
--   -- esperado: 0 linhas

BEGIN;

CREATE TABLE IF NOT EXISTS "adverse_event_reports" (
  "id"             TEXT NOT NULL,
  "patientId"      TEXT NOT NULL,
  "userId"         TEXT NOT NULL,

  -- Suspeita ------------------------------------------------------------------
  "medicamentos"   TEXT NOT NULL,          -- fármacos suspeitos, um por linha
  "reacao"         TEXT NOT NULL,          -- descrição do evento e sintomas
  "dataInicio"     TIMESTAMP(3) NOT NULL,
  "dataFim"        TIMESTAMP(3),

  -- Classificação — valores restringidos por CHECK abaixo ---------------------
  "gravidade"      TEXT NOT NULL,          -- NAO_GRAVE | OBITO | AMEACA_VIDA |
                                           -- HOSPITALIZACAO | INCAPACIDADE |
                                           -- ANOMALIA_CONGENITA | CLINICAMENTE_RELEVANTE
  "desfecho"       TEXT NOT NULL,          -- RECUPERADO | RECUPERANDO | NAO_RECUPERADO |
                                           -- SEQUELA | OBITO | DESCONHECIDO
  "acaoTomada"     TEXT NOT NULL,          -- SUSPENSO | DOSE_REDUZIDA | DOSE_AUMENTADA |
                                           -- MANTIDO | DESCONHECIDO
  "reexposicao"    TEXT NOT NULL DEFAULT 'NAO_APLICA',  -- REAPARECEU | NAO_REAPARECEU |
                                                        -- NAO_APLICA | DESCONHECIDO

  "historicoRelevante" TEXT,               -- doença prévia/atual (opcional no VigiMed)
  "observacoes"        TEXT,

  -- Rastreio da notificação ---------------------------------------------------
  -- Nulo enquanto a notificação não foi enviada. O sistema não submete: registra.
  "notificadoEm"       TIMESTAMP(3),
  "protocoloVigimed"   TEXT,

  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "adverse_event_reports_pkey" PRIMARY KEY ("id")
);

-- Valores fechados no banco: a UI valida, mas outro caminho de escrita não.
ALTER TABLE "adverse_event_reports"
  ADD CONSTRAINT "aer_gravidade_check" CHECK ("gravidade" IN (
    'NAO_GRAVE','OBITO','AMEACA_VIDA','HOSPITALIZACAO','INCAPACIDADE',
    'ANOMALIA_CONGENITA','CLINICAMENTE_RELEVANTE'));

ALTER TABLE "adverse_event_reports"
  ADD CONSTRAINT "aer_desfecho_check" CHECK ("desfecho" IN (
    'RECUPERADO','RECUPERANDO','NAO_RECUPERADO','SEQUELA','OBITO','DESCONHECIDO'));

ALTER TABLE "adverse_event_reports"
  ADD CONSTRAINT "aer_acao_check" CHECK ("acaoTomada" IN (
    'SUSPENSO','DOSE_REDUZIDA','DOSE_AUMENTADA','MANTIDO','DESCONHECIDO'));

ALTER TABLE "adverse_event_reports"
  ADD CONSTRAINT "aer_reexposicao_check" CHECK ("reexposicao" IN (
    'REAPARECEU','NAO_REAPARECEU','NAO_APLICA','DESCONHECIDO'));

-- Consulta central: "o que ainda não foi notificado", que é a pendência real.
CREATE INDEX IF NOT EXISTS "aer_userId_notificadoEm_idx"
  ON "adverse_event_reports" ("userId", "notificadoEm");
CREATE INDEX IF NOT EXISTS "aer_patientId_dataInicio_idx"
  ON "adverse_event_reports" ("patientId", "dataInicio" DESC);

-- patientId em CASCADE (o registro morre com o paciente); userId em RESTRICT —
-- não se apaga um farmacêutico que tem notificação em seu nome.
ALTER TABLE "adverse_event_reports"
  ADD CONSTRAINT "aer_patientId_fkey" FOREIGN KEY ("patientId")
  REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "adverse_event_reports"
  ADD CONSTRAINT "aer_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

-- ── PASSO 2 — CONFERIR ──────────────────────────────────────────────────────
--   SELECT conname FROM pg_constraint WHERE conrelid='adverse_event_reports'::regclass;
--   -- esperado: pkey + 4 CHECK + 2 FK

-- ── REVERTER ────────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS "adverse_event_reports";
--   (contém registro clínico — só apagar se estiver vazia)
