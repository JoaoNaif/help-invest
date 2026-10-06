import { LlmLog } from '../../entities/llm-log'

/** Somente inserção: log de auditoria nunca é editado. */
export abstract class LlmLogsRepository {
  abstract create(log: LlmLog): Promise<void>
}
