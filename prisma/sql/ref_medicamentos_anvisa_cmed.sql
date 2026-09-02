-- Camada de referência brasileira de medicamentos: ANVISA (registro) + CMED (preço).
-- Alimenta a monografia (lacuna 02) e o comparativo de custo (lacuna 17).
--
-- ESCOPO ENXUTO, DE PROPÓSITO. As fontes trazem 43.445 registros e 25.699
-- apresentações com 74 colunas. Guardamos só o que o farmacêutico usa:
--   - apenas registro ATIVO e apresentação COMERCIALIZADA (~17 mil linhas úteis)
--   - PF e PMC "sem impostos", que são as cifras comparáveis entre produtos
--   - as 60 colunas de PF/PMC por alíquota de ICMS ficam de FORA: são dado
--     tributário, variam por estado, e não respondem "qual alternativa é mais
--     barata", que é a pergunta clínica
--
-- ⚠️ BANCO COMPARTILHADO com o prm-care-marketing. Aplicar pelo DIRECT_URL
-- (porta 5432). NUNCA `prisma db push` nem `prisma migrate dev`.
--
-- Dados abertos do poder público, sem cláusula NonCommercial — ver
-- docs/PARECER_FONTES_MONOGRAFIA_MEDICAMENTO.md. Atribuição obrigatória na tela.

-- ── PASSO 1 — PRÉ-VOO (não altera nada) ─────────────────────────────────────
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema='public'
--      AND table_name IN ('ref_medicamentos','ref_apresentacoes');
--   -- esperado: 0 linhas

-- ── PASSO 2 — CRIAR ─────────────────────────────────────────────────────────

BEGIN;

-- Medicamentos registrados na ANVISA (somente situação Ativo)
CREATE TABLE IF NOT EXISTS "ref_medicamentos" (
  "id"                   TEXT NOT NULL,
  "registro"             TEXT,
  "produto"              TEXT NOT NULL,
  "principioAtivo"       TEXT,
  -- minúsculo, sem acento — é por aqui que se cruza com a base clínica própria
  "principioAtivoNorm"   TEXT,
  "classeTerapeutica"    TEXT,
  "categoriaRegulatoria" TEXT,
  "empresa"              TEXT,
  "atualizadoEm"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ref_medicamentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ref_medicamentos_principioAtivoNorm_idx"
  ON "ref_medicamentos" ("principioAtivoNorm");
CREATE INDEX IF NOT EXISTS "ref_medicamentos_produto_idx"
  ON "ref_medicamentos" ("produto");

-- Apresentações comercializadas com preço regulado (CMED)
CREATE TABLE IF NOT EXISTS "ref_apresentacoes" (
  -- GGREM é o identificador da apresentação na CMED
  "ggrem"               TEXT NOT NULL,
  "registro"            TEXT,
  "ean"                 TEXT,
  "substancia"          TEXT,
  "substanciaNorm"      TEXT,
  "produto"             TEXT NOT NULL,
  "apresentacao"        TEXT,
  "laboratorio"         TEXT,
  "classeTerapeutica"   TEXT,
  -- Genérico / Similar / Referência — é o que sustenta a troca por equivalente
  "tipoProduto"         TEXT,
  "tarja"               TEXT,
  "restricaoHospitalar" BOOLEAN NOT NULL DEFAULT false,
  -- Em centavos: dinheiro em ponto flutuante acumula erro ao somar
  "pfSemImpostosCents"  INTEGER,
  "pmcSemImpostosCents" INTEGER,
  "atualizadoEm"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ref_apresentacoes_pkey" PRIMARY KEY ("ggrem")
);

-- Consulta central: "todas as apresentações desta substância, da mais barata"
CREATE INDEX IF NOT EXISTS "ref_apresentacoes_substanciaNorm_pmc_idx"
  ON "ref_apresentacoes" ("substanciaNorm", "pmcSemImpostosCents");
CREATE INDEX IF NOT EXISTS "ref_apresentacoes_produto_idx"
  ON "ref_apresentacoes" ("produto");
CREATE INDEX IF NOT EXISTS "ref_apresentacoes_registro_idx"
  ON "ref_apresentacoes" ("registro");

COMMIT;

-- ── PASSO 3 — CONFERIR ──────────────────────────────────────────────────────
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema='public' AND table_name IN ('ref_medicamentos','ref_apresentacoes');
--   -- esperado: 2 linhas
--
-- Popular com:  node scripts/etl/anvisa-cmed.mjs

-- ── REVERTER ────────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS "ref_medicamentos", "ref_apresentacoes";
--   (seguro: é dado público reconstruível pelo ETL, não há registro clínico aqui)
