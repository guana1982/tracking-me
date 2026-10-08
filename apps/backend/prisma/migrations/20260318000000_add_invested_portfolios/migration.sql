-- CreateTable
CREATE TABLE "invested_portfolios" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionsJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invested_portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invested_portfolios_userId_key" ON "invested_portfolios"("userId");

-- CreateIndex
CREATE INDEX "invested_portfolios_userId_idx" ON "invested_portfolios"("userId");

-- AddForeignKey
ALTER TABLE "invested_portfolios" ADD CONSTRAINT "invested_portfolios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
