-- AlterEnum
ALTER TYPE "LlmPurpose" ADD VALUE 'STOCK_EXPLANATION';

-- AlterTable
ALTER TABLE "llm_logs" ADD COLUMN     "stockAnalysisId" UUID;

-- CreateTable
CREATE TABLE "stock_analyses" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tickers" TEXT[],
    "result" JSONB NOT NULL,
    "assumptions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_analyses_userId_idx" ON "stock_analyses"("userId");

-- CreateIndex
CREATE INDEX "llm_logs_stockAnalysisId_idx" ON "llm_logs"("stockAnalysisId");

-- AddForeignKey
ALTER TABLE "stock_analyses" ADD CONSTRAINT "stock_analyses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_logs" ADD CONSTRAINT "llm_logs_stockAnalysisId_fkey" FOREIGN KEY ("stockAnalysisId") REFERENCES "stock_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
