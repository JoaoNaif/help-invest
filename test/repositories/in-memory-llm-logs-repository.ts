import { LlmLogsRepository } from '@/domain/recommendations/applications/repositories/llm-logs-repository'
import { LlmPurpose } from '@/domain/recommendations/entities/enums/llm-purpose'
import { LlmLog } from '@/domain/recommendations/entities/llm-log'

export class InMemoryLlmLogsRepository implements LlmLogsRepository {
  public items: LlmLog[] = []

  async findManyByComparisonId(comparisonId: string, purpose: LlmPurpose) {
    return this.items
      .filter(
        (item) =>
          item.comparisonId?.toString() === comparisonId &&
          item.purpose === purpose
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async create(log: LlmLog) {
    this.items.push(log)
  }
}
