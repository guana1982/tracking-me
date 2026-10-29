-- Realign pay-cycle boundary after moving cutoffDay from 26 → 27.
-- Runs as part of `prisma migrate deploy` on the next deploy.
-- Steps:
--   1) Update BudgetRule cutoffDay to 27 for 2026-03 and 2026-04 (only where
--      still at the old default of 26 — preserves any manual customization).
--   2) Ensure a 2026-03 MonthPeriod exists for each user that has 2026-04.
--   3) Move expenses dated on or before 2026-03-27 23:59:59 UTC from the
--      2026-04 period to the 2026-03 period — they belong to March's cycle
--      now that payday is the 27th.

-- gen_random_uuid() is available in core Postgres 13+, but pgcrypto is a safe
-- fallback on older instances.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Bump cutoffDay to 27 where it's still the old default of 26
UPDATE "budget_rules"
SET "cutoffDay" = 27, "updatedAt" = NOW()
WHERE "monthPeriodId" IN (
  SELECT id FROM "month_periods" WHERE "periodKey" IN ('2026-03', '2026-04')
)
AND "cutoffDay" = 26;

-- 2) Create missing 2026-03 period for users that only have 2026-04
INSERT INTO "month_periods" ("id", "userId", "year", "month", "periodKey", "isClosed", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, apr."userId", 2026, 3, '2026-03', FALSE, NOW(), NOW()
FROM "month_periods" apr
LEFT JOIN "month_periods" mar
  ON mar."userId" = apr."userId" AND mar."periodKey" = '2026-03'
WHERE apr."periodKey" = '2026-04' AND mar."id" IS NULL;

-- 3) Reassign expenses dated <= 2026-03-27 23:59:59 UTC from April to March
UPDATE "expenses"
SET "monthPeriodId" = mar."id", "updatedAt" = NOW()
FROM "month_periods" apr, "month_periods" mar
WHERE apr."periodKey" = '2026-04'
  AND mar."periodKey" = '2026-03'
  AND mar."userId"    = apr."userId"
  AND "expenses"."monthPeriodId" = apr."id"
  AND "expenses"."date" <= TIMESTAMP '2026-03-27 23:59:59';
