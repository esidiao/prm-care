-- Módulo Interações Medicamentosas — Fase 1 (persistência)
-- ADITIVO E SEGURO: apenas CREATE TABLE IF NOT EXISTS com nomes novos (ddi_*).
-- NÃO altera/derruba nenhuma tabela existente (clínicas ou mkt_*).
-- Aplicar via: prisma db execute --file prisma/sql/ddi_tables.sql --url "$DIRECT_URL"

CREATE TABLE IF NOT EXISTS "ddi_queries" (
  "id"          TEXT PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  "patientId"   TEXT,
  "inputDrugs"  JSONB NOT NULL,
  "globalRisk"  TEXT,
  "count"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ddi_queries_userId_idx"    ON "ddi_queries" ("userId");
CREATE INDEX IF NOT EXISTS "ddi_queries_patientId_idx" ON "ddi_queries" ("patientId");

CREATE TABLE IF NOT EXISTS "ddi_results" (
  "id"        TEXT PRIMARY KEY,
  "queryId"   TEXT NOT NULL,
  "severity"  TEXT NOT NULL,
  "payload"   JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ddi_results_queryId_idx" ON "ddi_results" ("queryId");

CREATE TABLE IF NOT EXISTS "ddi_decisions" (
  "id"          TEXT PRIMARY KEY,
  "queryId"     TEXT NOT NULL UNIQUE,
  "note"        TEXT,
  "intervened"  BOOLEAN NOT NULL DEFAULT false,
  "contactedMD" BOOLEAN NOT NULL DEFAULT false,
  "outcome"     TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ddi_feedback" (
  "id"        TEXT PRIMARY KEY,
  "queryId"   TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "useful"    BOOLEAN NOT NULL,
  "comment"   TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
