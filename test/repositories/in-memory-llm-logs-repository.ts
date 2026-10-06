import { LlmLogsRepository } from '@/domain/recommendations/applications/repositories/llm-logs-repository'
import { LlmLog } from '@/domain/recommendations/entities/llm-log'

export class InMemoryLlmLogsRepository implements LlmLogsRepository {
  public items: LlmLog[] = []

  async create(log: LlmLog) {
    this.items.push(log)
  }
}
