-- ⚠️ CORREÇÃO DE PRODUÇÃO — três tabelas declaradas no schema.prisma NUNCA foram
-- criadas no banco. Descoberto em 31/08/2026 por inspeção do information_schema.
--
-- FUNCIONALIDADES QUEBRADAS EM PRODUÇÃO ENQUANTO ISTO NÃO FOR APLICADO:
--   • clinical_notes     → Notas clínicas do paciente
--       /api/patients/[id]/notes, /api/patients/[id]/notes/[noteId]
--       components/patients/PatientNotes.tsx
--   • scale_assessments  → Escalas clínicas (PHQ-9, GAD-7, AUDIT-C, Morisky-4)
--       /api/patients/[id]/scales, /api/patients/[id]/scales/[assessmentId]
--       components/patients/ClinicalScales.tsx, /patients/[id]/scales/report
--   • patient_reviews    → Revisões e agendamentos de acompanhamento
--       /api/patients/[id]/reviews, /api/patients/[id]/reviews/[reviewId],
--       /api/reviews/upcoming, /api/notifications (alertas do dashboard),
--       components/patients/PatientReviews.tsx, dashboard/UpcomingReviews.tsx
--
-- Toda chamada a essas rotas hoje devolve erro 42P01 ("relation does not exist").
-- O /api/notifications falha inteiro, o que derruba o sino de alertas do topo.
--
-- ORDEM DE APLICAÇÃO: este arquivo PRIMEIRO, depois
-- prisma/sql/patient_reviews_constraints.sql — que adiciona CHECK em
-- patient_reviews e hoje falharia, porque a tabela não existe.
--
-- ADITIVO E SEGURO: só cria tabelas novas. Não altera nem lê nenhuma tabela
-- existente, e nenhuma tabela do prm-care-marketing (prefixo mkt_).
--
-- ⚠️ BANCO COMPARTILHADO com o prm-care-marketing. Aplicar manualmente pelo
-- DIRECT_URL (porta 5432). NUNCA `prisma db push` nem `prisma migrate dev` —
-- os dois comparam o schema inteiro e podem propor DROP nas tabelas do marketing,
-- que não estão neste schema.prisma.

-- ── PASSO 1 — PRÉ-VOO (não altera nada) ─────────────────────────────────────
-- Confirma que as três realmente não existem. Esperado: 0 linhas.
--
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema='public'
--      AND table_name IN ('clinical_notes','scale_assessments','patient_reviews');

-- ── PASSO 2 — CRIAR ─────────────────────────────────────────────────────────

BEGIN;

-- ── clinical_notes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "clinical_notes" (
  "id"        TEXT         NOT NULL,
  "patientId" TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "content"   TEXT         NOT NULL,
  "isPinned"  BOOLEAN      NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinical_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "clinical_notes_patientId_createdAt_idx"
  ON "clinical_notes" ("patientId", "createdAt" DESC);

-- ── scale_assessments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "scale_assessments" (
  "id"         TEXT         NOT NULL,
  "patientId"  TEXT         NOT NULL,
  "userId"     TEXT         NOT NULL,
  "scaleType"  TEXT         NOT NULL,
  "answers"    JSONB        NOT NULL,
  "totalScore" INTEGER      NOT NULL,
  "severity"   TEXT         NOT NULL,
  "notes"      TEXT,
  "appliedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scale_assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "scale_assessments_patientId_scaleType_appliedAt_idx"
  ON "scale_assessments" ("patientId", "scaleType", "appliedAt" DESC);

-- ── patient_reviews ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "patient_reviews" (
  "id"            TEXT         NOT NULL,
  "patientId"     TEXT         NOT NULL,
  "userId"        TEXT         NOT NULL,
  "scheduledDate" TIMESTAMP(3) NOT NULL,
  "type"          TEXT         NOT NULL,
  "title"         TEXT         NOT NULL,
  "notes"         TEXT,
  "status"        TEXT         NOT NULL DEFAULT 'PENDING',
  "completedAt"   TIMESTAMP(3),
  "completedNote" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "patient_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "patient_reviews_userId_scheduledDate_idx"
  ON "patient_reviews" ("userId", "scheduledDate");

CREATE INDEX IF NOT EXISTS "patient_reviews_patientId_scheduledDate_idx"
  ON "patient_reviews" ("patientId", "scheduledDate");

-- ── Chaves estrangeiras ─────────────────────────────────────────────────────
-- patientId com ON DELETE CASCADE (o registro clínico morre com o paciente);
-- userId com RESTRICT, como no schema.prisma — não se apaga um farmacêutico que
-- tem registro clínico em seu nome.

ALTER TABLE "clinical_notes"
  ADD CONSTRAINT "clinical_notes_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clinical_notes"
  ADD CONSTRAINT "clinical_notes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "scale_assessments"
  ADD CONSTRAINT "scale_assessments_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scale_assessments"
  ADD CONSTRAINT "scale_assessments_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patient_reviews"
  ADD CONSTRAINT "patient_reviews_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "patient_reviews"
  ADD CONSTRAINT "patient_reviews_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

-- ── PASSO 3 — CONFERIR ──────────────────────────────────────────────────────
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema='public'
--      AND table_name IN ('clinical_notes','scale_assessments','patient_reviews');
--   -- esperado: 3 linhas
--
-- Depois disso, aplicar prisma/sql/patient_reviews_constraints.sql.

-- ── REVERTER ────────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS "clinical_notes", "scale_assessments", "patient_reviews";
--   (seguro apenas enquanto estiverem vazias — depois, perde registro clínico)
