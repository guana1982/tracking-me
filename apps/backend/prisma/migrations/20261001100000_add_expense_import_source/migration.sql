-- Identify expenses created by a bank statement import while preserving manual entries.
ALTER TABLE "expenses" ADD COLUMN "importSource" TEXT;
