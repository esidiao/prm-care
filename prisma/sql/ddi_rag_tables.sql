-- Fase 3b — Fontes e RAG para o módulo de Interações (rastreabilidade + versionamento)
-- ADITIVO E SEGURO: CREATE TABLE IF NOT EXISTS com nomes novos (ddi_*).
-- A coluna de embedding (pgvector) será adicionada na Fase 3c, quando houver provedor
-- de embeddings definido — por ora a recuperação é lexical (drugRefs + conteúdo).

CREATE TABLE IF NOT EXISTS "ddi_sources" (
  "id"          TEXT PRIMARY KEY,
  "kind"        TEXT NOT NULL,            -- BULA | ANVISA | FDA | EMA | WHO_ATC | PUBMED | DIRETRIZ | PROTOCOLO | INTERNA
  "title"       TEXT NOT NULL,
  "citation"    TEXT NOT NULL,
  "url"         TEXT,
  "version"     TEXT,
  "retrievedAt" TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ddi_rag_chunks" (
  "id"        TEXT PRIMARY KEY,
  "sourceId"  TEXT NOT NULL,
  "content"   TEXT NOT NULL,
  "drugRefs"  TEXT[] NOT NULL DEFAULT '{}',  -- princípios ativos citados (filtro lexical)
  "version"   INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ddi_rag_chunks_sourceId_idx" ON "ddi_rag_chunks" ("sourceId");
CREATE INDEX IF NOT EXISTS "ddi_rag_chunks_drugRefs_idx" ON "ddi_rag_chunks" USING GIN ("drugRefs");
