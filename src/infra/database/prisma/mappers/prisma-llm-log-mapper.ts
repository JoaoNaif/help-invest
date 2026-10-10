import { Prisma, LlmLog as PrismaLlmLog } from '@prisma/client'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { LlmLog } from '@/domain/recommendations/entities/llm-log'

export class PrismaLlmLogMapper {
  static toDomain(raw: PrismaLlmLog): LlmLog {
    return LlmLog.create(
      {
        userId: new UniqueEntityId(raw.userId),
        purpose: raw.purpose,
        model: raw.model,
        prompt: raw.prompt,
        response: raw.response,
        inputTokens: raw.inputTokens,
        outputTokens: raw.outputTokens,
        comparisonId: raw.comparisonId
          ? new UniqueEntityId(raw.comparisonId)
          : null,
        stockAnalysisId: raw.stockAnalysisId
          ? new UniqueEntityId(raw.stockAnalysisId)
          : null,
        createdAt: raw.createdAt,
      },
      new UniqueEntityId(raw.id)
    )
  }

  static toPrisma(log: LlmLog): Prisma.LlmLogUncheckedCreateInput {
    return {
      id: log.id.toString(),
      userId: log.userId.toString(),
      purpose: log.purpose,
      model: log.model,
      prompt: log.prompt,
      // `response` é Json obrigatório: resposta ausente vira JSON null.
      response:
        log.response === null || log.response === undefined
          ? Prisma.JsonNull
          : (log.response as Prisma.InputJsonValue),
      inputTokens: log.inputTokens,
      outputTokens: log.outputTokens,
      comparisonId: log.comparisonId?.toString() ?? null,
      stockAnalysisId: log.stockAnalysisId?.toString() ?? null,
      createdAt: log.createdAt,
    }
  }
}
