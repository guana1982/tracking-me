-- Fix: Drop old unique indexes that were not properly removed
-- The previous migration used DROP CONSTRAINT but the indexes were created with CREATE UNIQUE INDEX
-- PostgreSQL indexes are not constraints, so DROP CONSTRAINT did nothing

-- Drop the old unique index on periodKey alone (if it still exists)
DROP INDEX IF EXISTS "month_periods_periodKey_key";

-- Drop the old unique index on year, month alone (if it still exists)
DROP INDEX IF EXISTS "month_periods_year_month_key";
