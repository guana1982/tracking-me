-- Which of the two day curves each answer feeds. Never inferred from a name:
-- the user says whether a characteristic is physical, psychological, or out.

-- CreateEnum
CREATE TYPE "DayTrack" AS ENUM ('BODY', 'MOOD', 'NONE');

-- AlterTable
ALTER TABLE "rating_definitions" ADD COLUMN "track" "DayTrack" NOT NULL DEFAULT 'BODY';

-- AlterTable
ALTER TABLE "check_in_scales" ADD COLUMN "track" "DayTrack" NOT NULL DEFAULT 'MOOD';

-- A row wired to the mood picker is a mood row: keep the two consistent for
-- the characteristics that already exist
UPDATE "rating_definitions" SET "track" = 'MOOD' WHERE "linkedForm" = 'MOOD';

-- Side effects are read as physical, not as psychological symptoms
UPDATE "check_in_scales" SET "track" = 'BODY' WHERE "isSideEffect" = true;
