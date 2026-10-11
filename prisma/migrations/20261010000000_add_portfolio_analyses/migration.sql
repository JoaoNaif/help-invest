-- CreateEnum
CREATE TYPE "PortfolioStrategy" AS ENUM ('BALANCE', 'MAX_RETURN', 'INCOME', 'PROTECT');

-- AlterEnum
ALTER TYPE "LlmPurpose" ADD VALUE 'PORTFOLIO_EXPLANATION';

-- AlterTable
ALTER TABLE "llm_logs" ADD COLUMN     "portfolioAnalysisId" UUID;

-- CreateTable
CREATE TABLE "portfolio_analyses" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "strategy" "PortfolioStrategy" NOT NULL,
    "result" JSONB NOT NULL,
    "assumptions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolio_analyses_userId_idx" ON "portfolio_analyses"("userId");

-- CreateIndex
CREATE INDEX "llm_logs_portfolioAnalysisId_idx" ON "llm_logs"("portfolioAnalysisId");

-- AddForeignKey
ALTER TABLE "portfolio_analyses" ADD CONSTRAINT "portfolio_analyses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_logs" ADD CONSTRAINT "llm_logs_portfolioAnalysisId_fkey" FOREIGN KEY ("portfolioAnalysisId") REFERENCES "portfolio_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
