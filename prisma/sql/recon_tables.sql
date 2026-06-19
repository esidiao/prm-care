-- Conciliação medicamentosa — Fase 2 (persistência + relatório)
-- ADITIVO E SEGURO: apenas CREATE TABLE IF NOT EXISTS com nomes novos (recon_*).

CREATE TABLE IF NOT EXISTS "reconciliations" (
  "id"            TEXT PRIMARY KEY,
  "patientId"     TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "source"        TEXT,
  "snapshot"      JSONB NOT NULL,          -- itens (em uso/confirmado/suspenso/adicionado/dose/horário)
  "riscos"        TEXT,
  "intervencoes"  TEXT,
  "orientacoes"   TEXT,
  "recomendacoes" TEXT,
  "plano"         TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "reconciliations_patientId_idx" ON "reconciliations" ("patientId");
CREATE INDEX IF NOT EXISTS "reconciliations_userId_idx"    ON "reconciliations" ("userId");

CREATE TABLE IF NOT EXISTS "reconciliation_reports" (
  "id"               TEXT PRIMARY KEY,
  "reconciliationId" TEXT NOT NULL,
  "variant"          TEXT NOT NULL,        -- TECNICA | SIMPLIFICADA
  "format"           TEXT NOT NULL,        -- PDF | PNG | TEXT | WHATSAPP
  "sharedChannel"    TEXT,                 -- WHATSAPP | DOWNLOAD | PRINT
  "anonymized"       BOOLEAN NOT NULL DEFAULT false,
  "consentGiven"     BOOLEAN NOT NULL DEFAULT false,
  "consentAt"        TIMESTAMPTZ,
  "sharedAt"         TIMESTAMPTZ,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "reconciliation_reports_reconciliationId_idx" ON "reconciliation_reports" ("reconciliationId");
