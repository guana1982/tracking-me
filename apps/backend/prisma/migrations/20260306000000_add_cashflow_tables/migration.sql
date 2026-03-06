-- CreateTable
CREATE TABLE "cashflow_checks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkLabel" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "bbva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tradeRepublic" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "webankCc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "webankObbl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "etfLordo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rendimentoLordo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bper" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tricount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cartaWebank" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "edenred" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cashflow_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashflow_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commissionPerEtf" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "etfCount" INTEGER NOT NULL DEFAULT 12,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cashflow_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cashflow_checks_userId_idx" ON "cashflow_checks"("userId");

-- CreateIndex
CREATE INDEX "cashflow_checks_date_idx" ON "cashflow_checks"("date");

-- CreateIndex
CREATE UNIQUE INDEX "cashflow_settings_userId_key" ON "cashflow_settings"("userId");

-- AddForeignKey
ALTER TABLE "cashflow_checks" ADD CONSTRAINT "cashflow_checks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashflow_settings" ADD CONSTRAINT "cashflow_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
