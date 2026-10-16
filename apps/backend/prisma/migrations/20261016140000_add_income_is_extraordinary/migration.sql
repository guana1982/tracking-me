-- Flag one-off incomes so the dashboard can show the structural real balance.
ALTER TABLE "incomes" ADD COLUMN "isExtraordinary" BOOLEAN NOT NULL DEFAULT false;

-- Backfill with the same label rule new incomes use (EXTRAORDINARY_INCOME_PATTERN)
UPDATE "incomes"
SET "isExtraordinary" = true
WHERE "sourcePeriodKey" IS NULL
  AND "label" ~* '(tredicesima|quattordicesima|rimborso|irpef|\m730\M)';
