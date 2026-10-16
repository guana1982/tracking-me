-- Add source-period marker for surplus carried forward via positive reallocation.
-- Null for regular income; set to the origin period's YYYY-MM when the income is
-- an auto-generated "Riallocazione positiva da <mese>" line in the next month.
ALTER TABLE "incomes" ADD COLUMN "sourcePeriodKey" TEXT;
