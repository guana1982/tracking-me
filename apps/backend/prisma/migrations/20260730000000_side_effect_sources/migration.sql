-- Which treatments brought a side effect up, so the diary can group them
-- under the drug they belong to instead of showing one flat list.

-- AlterTable
ALTER TABLE "check_in_scales"
  ADD COLUMN "sourceTreatmentKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];
