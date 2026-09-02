-- Lógica de banco que o schema.prisma NÃO expressa.
--
-- POR QUE ESTE ARQUIVO EXISTE: `prisma db push` recria tabelas, colunas e
-- índices — e mais nada. CHECK constraints, funções e triggers ficam de fora.
-- Um banco criado só por `db push` ACEITA valor que produção rejeita e NÃO
-- encadeia a trilha de auditoria: teste passaria ali e falharia em produção,
-- que é confiança falsa — pior que não ter teste.
--
-- Verificado em 02/09/2026: produção tinha 6 CHECKs e 1 trigger; um banco novo
-- criado por `db push` tinha ZERO de ambos.
--
-- Tudo aqui é IDEMPOTENTE: aplicar de novo não quebra nada.
--
-- Uso:
--   banco de teste  — aplicado por scripts/preparar-banco-teste.mjs
--   produção        — já aplicado pelos SQL originais; rodar de novo é no-op

-- ── Valores fechados: patient_reviews ───────────────────────────────────────
ALTER TABLE "patient_reviews" DROP CONSTRAINT IF EXISTS "patient_reviews_type_check";
ALTER TABLE "patient_reviews" ADD CONSTRAINT "patient_reviews_type_check"
  CHECK ("type" IN ('MEDICATION_REVIEW','FOLLOW_UP','LAB_CHECK','ADHERENCE','CUSTOM')) NOT VALID;

ALTER TABLE "patient_reviews" DROP CONSTRAINT IF EXISTS "patient_reviews_status_check";
ALTER TABLE "patient_reviews" ADD CONSTRAINT "patient_reviews_status_check"
  CHECK ("status" IN ('PENDING','COMPLETED','CANCELLED','OVERDUE')) NOT VALID;

-- ── Valores fechados: adverse_event_reports ─────────────────────────────────
ALTER TABLE "adverse_event_reports" DROP CONSTRAINT IF EXISTS "aer_gravidade_check";
ALTER TABLE "adverse_event_reports" ADD CONSTRAINT "aer_gravidade_check"
  CHECK ("gravidade" IN ('NAO_GRAVE','OBITO','AMEACA_VIDA','HOSPITALIZACAO',
    'INCAPACIDADE','ANOMALIA_CONGENITA','CLINICAMENTE_RELEVANTE')) NOT VALID;

ALTER TABLE "adverse_event_reports" DROP CONSTRAINT IF EXISTS "aer_desfecho_check";
ALTER TABLE "adverse_event_reports" ADD CONSTRAINT "aer_desfecho_check"
  CHECK ("desfecho" IN ('RECUPERADO','RECUPERANDO','NAO_RECUPERADO','SEQUELA',
    'OBITO','DESCONHECIDO')) NOT VALID;

ALTER TABLE "adverse_event_reports" DROP CONSTRAINT IF EXISTS "aer_acao_check";
ALTER TABLE "adverse_event_reports" ADD CONSTRAINT "aer_acao_check"
  CHECK ("acaoTomada" IN ('SUSPENSO','DOSE_REDUZIDA','DOSE_AUMENTADA','MANTIDO',
    'DESCONHECIDO')) NOT VALID;

ALTER TABLE "adverse_event_reports" DROP CONSTRAINT IF EXISTS "aer_reexposicao_check";
ALTER TABLE "adverse_event_reports" ADD CONSTRAINT "aer_reexposicao_check"
  CHECK ("reexposicao" IN ('REAPARECEU','NAO_REAPARECEU','NAO_APLICA','DESCONHECIDO')) NOT VALID;

-- ── Encadeamento da trilha de auditoria ─────────────────────────────────────
-- A sequência não vem do Prisma: `sequencia` é BigInt? no schema, sem default.
CREATE SEQUENCE IF NOT EXISTS "audit_logs_sequencia_seq" OWNED BY "audit_logs"."sequencia";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name='audit_logs' AND column_name='sequencia' AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE "audit_logs" ALTER COLUMN "sequencia" SET DEFAULT nextval('audit_logs_sequencia_seq');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "audit_logs_sequencia_key" ON "audit_logs" ("sequencia");

-- `search_path` explícito em vez de qualificar `extensions.digest`: em produção
-- o pgcrypto vive no schema `extensions`, e num banco novo cai em `public`.
-- Fixar um dos dois quebra no outro — e quebra em silêncio, na hora de gravar.
CREATE OR REPLACE FUNCTION "audit_logs_hash"(
  p_sequencia BIGINT, p_id TEXT, p_user TEXT, p_action TEXT, p_resource TEXT,
  p_resource_id TEXT, p_details TEXT, p_created TIMESTAMP, p_anterior TEXT
) RETURNS TEXT AS $$
  SELECT encode(digest(
    COALESCE(p_sequencia::text, '') || '|' || COALESCE(p_id, '') || '|' ||
    COALESCE(p_user, '')            || '|' || COALESCE(p_action, '') || '|' ||
    COALESCE(p_resource, '')        || '|' || COALESCE(p_resource_id, '') || '|' ||
    COALESCE(p_details, '')         || '|' ||
    COALESCE(to_char(p_created AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS'), '') || '|' ||
    COALESCE(p_anterior, ''),
    'sha256'), 'hex')
$$ LANGUAGE sql IMMUTABLE SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION "audit_logs_encadear"() RETURNS TRIGGER AS $$
DECLARE anterior TEXT;
BEGIN
  -- Serializa a ponta: sem isto, duas inserções simultâneas leem o mesmo hash
  -- anterior e a cadeia bifurca.
  PERFORM pg_advisory_xact_lock(hashtext('audit_logs_chain'));

  IF NEW."sequencia" IS NULL THEN
    NEW."sequencia" := nextval('audit_logs_sequencia_seq');
  END IF;

  SELECT a."hash" INTO anterior FROM "audit_logs" a
   WHERE a."sequencia" < NEW."sequencia" ORDER BY a."sequencia" DESC LIMIT 1;

  NEW."hashAnterior" := COALESCE(anterior, 'genesis');
  NEW."hash" := "audit_logs_hash"(NEW."sequencia", NEW."id", NEW."userId", NEW."action",
                 NEW."resource", NEW."resourceId", NEW."details"::text, NEW."createdAt",
                 NEW."hashAnterior");
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "audit_logs_encadear_trg" ON "audit_logs";
CREATE TRIGGER "audit_logs_encadear_trg"
  BEFORE INSERT ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_encadear"();
