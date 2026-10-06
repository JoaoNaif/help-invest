-- CreateEnum
CREATE TYPE "InvestmentGoal" AS ENUM ('RESERVE', 'RETIREMENT', 'PURCHASE', 'GROWTH');

-- CreateEnum
CREATE TYPE "RiskTolerance" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('CDB', 'LCI', 'LCA', 'LC', 'TESOURO', 'DEBENTURE', 'CRI', 'CRA', 'ACAO', 'FII', 'FUNDO', 'CRIPTO', 'OUTRO');

-- CreateEnum
CREATE TYPE "Indexer" AS ENUM ('PRE', 'CDI', 'IPCA', 'SELIC');

-- CreateEnum
CREATE TYPE "Liquidity" AS ENUM ('DAILY', 'AT_MATURITY', 'GRACE_PERIOD');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('MANUAL', 'LLM_EXTRACTED');

-- CreateEnum
CREATE TYPE "Indicator" AS ENUM ('SELIC', 'CDI', 'IPCA');

-- CreateEnum
CREATE TYPE "ComparisonStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'DONE');

-- CreateEnum
CREATE TYPE "LlmPurpose" AS ENUM ('EXTRACTION', 'EXPLANATION');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "monthlyIncome" DECIMAL(18,2) NOT NULL,
    "emergencyReserve" DECIMAL(18,2) NOT NULL,
    "goal" "InvestmentGoal" NOT NULL,
    "horizonMonths" INTEGER NOT NULL,
    "riskTolerance" "RiskTolerance" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "issuerName" TEXT,
    "issuerCnpj" TEXT,
    "investedAmount" DECIMAL(18,2) NOT NULL,
    "indexer" "Indexer",
    "rate" DECIMAL(12,6),
    "investedAt" DATE,
    "maturityAt" DATE,
    "liquidity" "Liquidity",
    "source" "DataSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicator_values" (
    "id" UUID NOT NULL,
    "indicator" "Indicator" NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(12,6) NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicator_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparisons" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "horizonMonths" INTEGER NOT NULL,
    "status" "ComparisonStatus" NOT NULL DEFAULT 'DRAFT',
    "assumptions" JSONB,
    "chosenOptionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparison_options" (
    "id" UUID NOT NULL,
    "comparisonId" UUID NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "issuerName" TEXT,
    "issuerCnpj" TEXT,
    "indexer" "Indexer" NOT NULL,
    "rate" DECIMAL(12,6) NOT NULL,
    "maturityAt" DATE,
    "liquidity" "Liquidity",
    "graceDays" INTEGER,
    "minAmount" DECIMAL(18,2),
    "netAnnualRate" DECIMAL(12,6),
    "alerts" JSONB,
    "rawInput" TEXT,
    "source" "DataSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparison_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_logs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "LlmPurpose" NOT NULL,
    "model" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "comparisonId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "investor_profiles_userId_key" ON "investor_profiles"("userId");

-- CreateIndex
CREATE INDEX "positions_userId_idx" ON "positions"("userId");

-- CreateIndex
CREATE INDEX "positions_userId_issuerCnpj_idx" ON "positions"("userId", "issuerCnpj");

-- CreateIndex
CREATE UNIQUE INDEX "indicator_values_indicator_date_key" ON "indicator_values"("indicator", "date");

-- CreateIndex
CREATE UNIQUE INDEX "comparisons_chosenOptionId_key" ON "comparisons"("chosenOptionId");

-- CreateIndex
CREATE INDEX "comparisons_userId_idx" ON "comparisons"("userId");

-- CreateIndex
CREATE INDEX "comparison_options_comparisonId_idx" ON "comparison_options"("comparisonId");

-- CreateIndex
CREATE INDEX "llm_logs_userId_idx" ON "llm_logs"("userId");

-- CreateIndex
CREATE INDEX "llm_logs_comparisonId_idx" ON "llm_logs"("comparisonId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_profiles" ADD CONSTRAINT "investor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_chosenOptionId_fkey" FOREIGN KEY ("chosenOptionId") REFERENCES "comparison_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_options" ADD CONSTRAINT "comparison_options_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "comparisons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_logs" ADD CONSTRAINT "llm_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_logs" ADD CONSTRAINT "llm_logs_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "comparisons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

