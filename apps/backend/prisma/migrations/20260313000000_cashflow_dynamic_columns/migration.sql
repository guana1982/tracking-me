-- Add JSON payloads for dynamic cashflow columns/values
ALTER TABLE "cashflow_checks"
ADD COLUMN "valuesJson" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "cashflow_settings"
ADD COLUMN "columnsJson" JSONB NOT NULL DEFAULT '[]';

-- Preserve historical data by materializing legacy fixed columns into valuesJson
UPDATE "cashflow_checks"
SET "valuesJson" = jsonb_build_object(
  'bbva', "bbva",
  'tradeRepublic', "tradeRepublic",
  'webankCc', "webankCc",
  'webankObbl', "webankObbl",
  'etfLordo', "etfLordo",
  'rendimentoLordo', "rendimentoLordo",
  'bper', "bper",
  'tricount', "tricount",
  'cartaWebank', "cartaWebank",
  'edenred', "edenred"
)
WHERE "valuesJson" = '{}'::jsonb;
