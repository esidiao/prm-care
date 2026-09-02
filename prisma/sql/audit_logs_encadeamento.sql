-- Integridade verificável da trilha de auditoria (lacuna 09).
--
-- O PROBLEMA: `audit_logs` é tabela comum. Qualquer escrita com acesso ao banco
-- pode alterar ou apagar um registro sem deixar rastro — e o banco é
-- COMPARTILHADO com o prm-care-marketing, o que amplia a superfície. Num sistema
-- clínico o log é a defesa em processo ético; log contestável não prova nada.
--
-- A SOLUÇÃO: encadeamento por hash. Cada linha guarda o SHA-256 do próprio
-- conteúdo somado ao hash da linha anterior. Alterar uma linha antiga quebra
-- todas as seguintes, e a quebra é detectável por varredura.
--
-- ⚠️ O QUE ISTO **NÃO** PROVA — declarado aqui para a tela não exagerar:
--   • Não impede alteração. Detecta.
--   • Quem tiver acesso de escrita PODE recalcular a cadeia inteira e ficar
--     consistente. A defesa contra isso é ancorar o hash da ponta FORA do banco
--     (e-mail diário, repositório, serviço de carimbo de tempo) — a tela expõe
--     o hash da ponta justamente para permitir essa âncora.
--   • As 78 linhas anteriores a esta migração são encadeadas retroativamente:
--     isso as protege DAQUI PARA A FRENTE, e não prova nada sobre o que houve
--     antes. A tela precisa dizer isso.
--
-- POR QUE TRIGGER E NÃO CÓDIGO: há chamadas diretas a `prisma.auditLog.create`
-- que não passam pelo helper `logAudit()`. Encadear na aplicação deixaria essas
-- de fora em silêncio. O trigger não tem como ser contornado pela aplicação.
--
-- ⚠️ BANCO COMPARTILHADO. Aplicar pelo DIRECT_URL (porta 5432). Nunca db push.

-- ── PASSO 1 — PRÉ-VOO ───────────────────────────────────────────────────────
--   SELECT extname FROM pg_extension WHERE extname='pgcrypto';   -- esperado: 1 linha
--   SELECT count(*) FROM audit_logs;                              -- volume a encadear
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='audit_logs' AND column_name IN ('hash','hashAnterior','sequencia');
--   -- esperado: 0 linhas

BEGIN;

-- ── PASSO 2 — COLUNAS ───────────────────────────────────────────────────────
ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "sequencia"    BIGINT,
  ADD COLUMN IF NOT EXISTS "hash"         TEXT,
  ADD COLUMN IF NOT EXISTS "hashAnterior" TEXT;

-- Ordem própria da cadeia, independente do relógio: `createdAt` pode empatar e
-- pode ser gravado fora de ordem sob concorrência.
CREATE SEQUENCE IF NOT EXISTS "audit_logs_sequencia_seq" OWNED BY "audit_logs"."sequencia";

-- ── PASSO 3 — NUMERAR O HISTÓRICO, em ordem cronológica ─────────────────────
WITH ordenado AS (
  SELECT "id", row_number() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS n
    FROM "audit_logs" WHERE "sequencia" IS NULL
)
UPDATE "audit_logs" a SET "sequencia" = o.n FROM ordenado o WHERE a."id" = o."id";

SELECT setval('audit_logs_sequencia_seq', COALESCE((SELECT MAX("sequencia") FROM "audit_logs"), 0) + 1, false);
ALTER TABLE "audit_logs" ALTER COLUMN "sequencia" SET DEFAULT nextval('audit_logs_sequencia_seq');

CREATE UNIQUE INDEX IF NOT EXISTS "audit_logs_sequencia_key" ON "audit_logs" ("sequencia");

-- ── PASSO 4 — FUNÇÃO DE HASH, fonte única da fórmula ────────────────────────
-- `extensions.digest` qualificado: o pgcrypto vive no schema `extensions` neste
-- banco, e o search_path de um trigger não é o da sessão.
CREATE OR REPLACE FUNCTION "audit_logs_hash"(
  p_sequencia BIGINT, p_id TEXT, p_user TEXT, p_action TEXT, p_resource TEXT,
  p_resource_id TEXT, p_details TEXT, p_created TIMESTAMP, p_anterior TEXT
) RETURNS TEXT AS $$
  SELECT encode(extensions.digest(
    COALESCE(p_sequencia::text, '') || '|' || COALESCE(p_id, '') || '|' ||
    COALESCE(p_user, '')            || '|' || COALESCE(p_action, '') || '|' ||
    COALESCE(p_resource, '')        || '|' || COALESCE(p_resource_id, '') || '|' ||
    COALESCE(p_details, '')         || '|' ||
    COALESCE(to_char(p_created AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS'), '') || '|' ||
    COALESCE(p_anterior, ''),
    'sha256'), 'hex')
$$ LANGUAGE sql IMMUTABLE;

-- ── PASSO 5 — ENCADEAR O HISTÓRICO ──────────────────────────────────────────
DO $$
DECLARE r RECORD; anterior TEXT := 'genesis';
BEGIN
  FOR r IN SELECT * FROM "audit_logs" ORDER BY "sequencia" ASC LOOP
    UPDATE "audit_logs" SET
      "hashAnterior" = anterior,
      "hash" = "audit_logs_hash"(r."sequencia", r."id", r."userId", r."action",
                r."resource", r."resourceId", r."details"::text, r."createdAt", anterior)
    WHERE "id" = r."id";
    SELECT "hash" INTO anterior FROM "audit_logs" WHERE "id" = r."id";
  END LOOP;
END $$;

-- ── PASSO 6 — TRIGGER PARA TODA LINHA NOVA ──────────────────────────────────
CREATE OR REPLACE FUNCTION "audit_logs_encadear"() RETURNS TRIGGER AS $$
DECLARE anterior TEXT;
BEGIN
  -- Serializa a ponta da cadeia. Sem isto, duas inserções simultâneas leem o
  -- mesmo hash anterior e a cadeia bifurca. O lock é por transação e cai sozinho.
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

COMMIT;

-- ── PASSO 7 — CONFERIR ──────────────────────────────────────────────────────
--   SELECT count(*) FILTER (WHERE "hash" IS NULL) AS sem_hash,
--          count(*) AS total FROM audit_logs;    -- esperado: sem_hash = 0
--
-- Verificação da cadeia: `node scripts/verificar-auditoria.mjs`

-- ── REVERTER ────────────────────────────────────────────────────────────────
--   DROP TRIGGER IF EXISTS "audit_logs_encadear_trg" ON "audit_logs";
--   DROP FUNCTION IF EXISTS "audit_logs_encadear"();
--   DROP FUNCTION IF EXISTS "audit_logs_hash"(BIGINT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMP,TEXT);
--   ALTER TABLE "audit_logs" DROP COLUMN IF EXISTS "hash",
--     DROP COLUMN IF EXISTS "hashAnterior", DROP COLUMN IF EXISTS "sequencia";
--   DROP SEQUENCE IF EXISTS "audit_logs_sequencia_seq";
