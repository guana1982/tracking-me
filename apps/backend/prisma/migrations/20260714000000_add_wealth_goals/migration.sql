-- Wealth goals: net-worth targets; progress and projections are computed from
-- the cash-flow check history, nothing else is persisted
CREATE TABLE "wealth_goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "targetDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wealth_goals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wealth_goals_userId_name_key" ON "wealth_goals"("userId", "name");
CREATE INDEX "wealth_goals_userId_idx" ON "wealth_goals"("userId");

ALTER TABLE "wealth_goals" ADD CONSTRAINT "wealth_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
