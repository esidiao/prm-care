-- Atesto formal do registro SOAP pelo farmacêutico.
--
-- CONTEXTO: desde 31/08/2026 o farmacêutico pode revisar e editar o SOAP
-- (PATCH /api/analysis/[id]/soap). A revisão é hoje INFERIDA de
-- `updatedAt > createdAt`, o que é frágil: não diz QUEM revisou, e uma correção
-- de digitação é indistinguível de um atesto clínico deliberado.
--
-- A Resolução CFF nº 751/2022 exige identificação do farmacêutico no registro do
-- atendimento. Estas colunas tornam o atesto explícito e atribuível.
--
-- ADITIVO E SEGURO: só adiciona colunas anuláveis. Não altera tipo, não reescreve
-- a tabela, não bloqueia leitura, não toca em nenhuma tabela do marketing.
-- Reversível com DROP COLUMN.
--
-- ⚠️ O BANCO É COMPARTILHADO com o prm-care-marketing. Aplicar manualmente pelo
-- DIRECT_URL (porta 5432), NUNCA via `prisma db push` ou `prisma migrate dev`.

-- ── PASSO 1 — APLICAR ───────────────────────────────────────────────────────
ALTER TABLE "soap_records"
  ADD COLUMN IF NOT EXISTS "attestedById" TEXT,
  ADD COLUMN IF NOT EXISTS "attestedAt"   TIMESTAMP(3);

-- FK para o farmacêutico que atestou. ON DELETE SET NULL: se a conta for
-- removida, o registro clínico permanece — apenas perde o vínculo.
ALTER TABLE "soap_records"
  DROP CONSTRAINT IF EXISTS "soap_records_attestedById_fkey";

ALTER TABLE "soap_records"
  ADD CONSTRAINT "soap_records_attestedById_fkey"
  FOREIGN KEY ("attestedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Consulta típica: "registros ainda não atestados" (pendência de conformidade).
CREATE INDEX IF NOT EXISTS "soap_records_attestedAt_idx"
  ON "soap_records" ("attestedAt");

-- ── PASSO 2 — SCHEMA.PRISMA (aplicar junto, no mesmo commit) ───────────────
--   model SOAPRecord {
--     ...
--     attestedById String?
--     attestedAt   DateTime?
--     attestedBy   User?  @relation("SoapAttestedBy", fields: [attestedById], references: [id], onDelete: SetNull)
--     @@index([attestedAt])
--   }
--   E em User:  soapAttestations SOAPRecord[] @relation("SoapAttestedBy")

-- ── REVERTER ────────────────────────────────────────────────────────────────
--   ALTER TABLE "soap_records" DROP CONSTRAINT IF EXISTS "soap_records_attestedById_fkey";
--   DROP INDEX IF EXISTS "soap_records_attestedAt_idx";
--   ALTER TABLE "soap_records" DROP COLUMN IF EXISTS "attestedById", DROP COLUMN IF EXISTS "attestedAt";
