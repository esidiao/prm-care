-- Restringe `type` e `status` de patient_reviews aos valores válidos.
--
-- CONTEXTO: as duas colunas são TEXT e os valores aceitos existiam apenas num
-- comentário do schema.prisma. Qualquer valor era persistido, e um valor fora da
-- lista quebra silenciosamente os mapas de ícone/rótulo da UI
-- (components/patients/PatientReviews.tsx e dashboard/UpcomingReviews.tsx).
-- A rota POST já valida com Zod desde a auditoria de 29/08/2026; isto fecha a
-- garantia na camada do banco, para qualquer outro caminho de escrita.
--
-- POR QUE CHECK E NÃO ENUM: converter para um ENUM do Postgres exige
-- `ALTER COLUMN ... USING type::"ReviewType"`, que FALHA se existir uma única
-- linha com valor fora da lista — e este banco é COMPARTILHADO com o
-- prm-care-marketing. CHECK ... NOT VALID passa a valer para toda escrita nova
-- imediatamente, sem tocar nem falhar nas linhas já gravadas.
--
-- ADITIVO E SEGURO: não altera tipo de coluna, não reescreve a tabela, não
-- bloqueia leitura. Reversível com DROP CONSTRAINT.

-- ── PASSO 1 — PRÉ-VOO (rodar antes; não altera nada) ────────────────────────
-- Mostra as linhas que hoje violariam as regras. Se vier vazio, o PASSO 3
-- (VALIDATE) pode ser executado com segurança logo em seguida.
--
--   SELECT "type", "status", count(*) AS linhas
--     FROM "patient_reviews"
--    WHERE "type"   NOT IN ('MEDICATION_REVIEW','FOLLOW_UP','LAB_CHECK','ADHERENCE','CUSTOM')
--       OR "status" NOT IN ('PENDING','COMPLETED','CANCELLED','OVERDUE')
--    GROUP BY 1, 2;

-- ── PASSO 2 — APLICAR (seguro mesmo com dados legados inválidos) ────────────
ALTER TABLE "patient_reviews"
  DROP CONSTRAINT IF EXISTS "patient_reviews_type_check";

ALTER TABLE "patient_reviews"
  ADD CONSTRAINT "patient_reviews_type_check"
  CHECK ("type" IN ('MEDICATION_REVIEW','FOLLOW_UP','LAB_CHECK','ADHERENCE','CUSTOM'))
  NOT VALID;

ALTER TABLE "patient_reviews"
  DROP CONSTRAINT IF EXISTS "patient_reviews_status_check";

ALTER TABLE "patient_reviews"
  ADD CONSTRAINT "patient_reviews_status_check"
  CHECK ("status" IN ('PENDING','COMPLETED','CANCELLED','OVERDUE'))
  NOT VALID;

-- ── PASSO 3 — VALIDAR O HISTÓRICO (opcional, só se o PASSO 1 veio vazio) ────
-- Faz o Postgres conferir também as linhas antigas. Se houver alguma inválida,
-- estes comandos falham sem deixar efeito — corrija os dados e repita.
--
--   ALTER TABLE "patient_reviews" VALIDATE CONSTRAINT "patient_reviews_type_check";
--   ALTER TABLE "patient_reviews" VALIDATE CONSTRAINT "patient_reviews_status_check";

-- ── REVERTER ────────────────────────────────────────────────────────────────
--   ALTER TABLE "patient_reviews" DROP CONSTRAINT "patient_reviews_type_check";
--   ALTER TABLE "patient_reviews" DROP CONSTRAINT "patient_reviews_status_check";
