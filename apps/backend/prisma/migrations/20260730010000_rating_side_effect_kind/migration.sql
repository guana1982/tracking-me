-- Side effects become a third kind of rating, so they can be logged as a
-- moment with an intensity and a comment instead of answered every night.
--
-- Kept apart from the data migration on purpose: Postgres refuses to use a
-- new enum value inside the same transaction that adds it.

-- AlterEnum
ALTER TYPE "RatingKind" ADD VALUE 'SIDE_EFFECT';

-- AlterTable
ALTER TABLE "rating_definitions"
  ADD COLUMN "sourceTreatmentKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];
