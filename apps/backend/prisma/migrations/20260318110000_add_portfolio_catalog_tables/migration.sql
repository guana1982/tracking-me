-- CreateTable
CREATE TABLE "portfolio_asset_classes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_asset_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_instruments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isin" TEXT NOT NULL,
    "assetClassId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_instruments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_asset_classes_userId_name_key" ON "portfolio_asset_classes"("userId", "name");

-- CreateIndex
CREATE INDEX "portfolio_asset_classes_userId_idx" ON "portfolio_asset_classes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_instruments_userId_symbol_key" ON "portfolio_instruments"("userId", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_instruments_userId_isin_key" ON "portfolio_instruments"("userId", "isin");

-- CreateIndex
CREATE INDEX "portfolio_instruments_userId_idx" ON "portfolio_instruments"("userId");

-- CreateIndex
CREATE INDEX "portfolio_instruments_assetClassId_idx" ON "portfolio_instruments"("assetClassId");

-- AddForeignKey
ALTER TABLE "portfolio_asset_classes" ADD CONSTRAINT "portfolio_asset_classes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_instruments" ADD CONSTRAINT "portfolio_instruments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_instruments" ADD CONSTRAINT "portfolio_instruments_assetClassId_fkey" FOREIGN KEY ("assetClassId") REFERENCES "portfolio_asset_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
