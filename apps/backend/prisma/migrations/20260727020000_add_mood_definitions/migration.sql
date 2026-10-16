-- User-owned catalog of mood states shown by the mood picker.
-- Seeded per user on first use from the shared defaults; fully editable
-- (add / rename / change valence / archive / delete) like meal types.
CREATE TABLE "mood_definitions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "valence" "QuickLogValence" NOT NULL,
    "position" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mood_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mood_definitions_userId_key_key" ON "mood_definitions"("userId", "key");

CREATE INDEX "mood_definitions_userId_position_idx" ON "mood_definitions"("userId", "position");

ALTER TABLE "mood_definitions" ADD CONSTRAINT "mood_definitions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
