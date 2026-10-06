import { LlmPurpose } from '../../entities/enums/llm-purpose'
import { LlmLog } from '../../entities/llm-log'

/** Somente inserção: log de auditoria nunca é editado. */
export abstract class LlmLogsRepository {
  /** Logs da comparação com esse propósito, do mais novo para o mais antigo. */
  abstract findManyByComparisonId(
    comparisonId: string,
    purpose: LlmPurpose
  ): Promise<LlmLog[]>
  abstract create(log: LlmLog): Promise<void>
}
