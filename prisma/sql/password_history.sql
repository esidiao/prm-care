-- Histórico de senhas — impede reuso das últimas senhas do usuário.
-- ADITIVO E SEGURO: apenas CREATE TABLE IF NOT EXISTS com nome novo (password_history).

CREATE TABLE IF NOT EXISTS "password_history" (
  "id"           TEXT PRIMARY KEY,
  "userId"       TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "password_history_userId_idx" ON "password_history" ("userId");
