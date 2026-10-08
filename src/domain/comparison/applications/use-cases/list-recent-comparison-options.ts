import { Either, right } from '@/core/either'
import { ComparisonOption } from '../../entities/comparison-option'
import { ComparisonsRepository } from '../repositories/comparisons-repository'

/** Quantas opções distintas o usuário recebe para reaproveitar. */
export const RECENT_OPTIONS_LIMIT = 8

/** Quantas opções olhar para trás até achar `RECENT_OPTIONS_LIMIT` distintas. */
const RECENT_OPTIONS_SCAN = 60

interface ListRecentComparisonOptionsUseCaseRequest {
  userId: string
}

type ListRecentComparisonOptionsUseCaseResponse = Either<
  never,
  { options: ComparisonOption[] }
>

/**
 * Opções que o usuário já usou em outras comparações, para não redigitar.
 * "Mesma opção" = mesmo tipo, emissor, indexador, taxa, vencimento e liquidez;
 * vale a mais recente. Sempre só as do próprio usuário.
 */
export class ListRecentComparisonOptionsUseCase {
  constructor(private comparisonsRepository: ComparisonsRepository) {}

  async execute({
    userId,
  }: ListRecentComparisonOptionsUseCaseRequest): Promise<ListRecentComparisonOptionsUseCaseResponse> {
    const recent = await this.comparisonsRepository.findRecentOptionsByUserId(
      userId,
      RECENT_OPTIONS_SCAN
    )

    const seen = new Set<string>()
    const options: ComparisonOption[] = []

    for (const option of recent) {
      const key = signature(option)

      if (seen.has(key)) continue

      seen.add(key)
      options.push(option)

      if (options.length === RECENT_OPTIONS_LIMIT) break
    }

    return right({ options })
  }
}

function signature(option: ComparisonOption) {
  return [
    option.assetType,
    option.issuerName?.trim().toLowerCase() ?? '',
    option.indexer,
    option.rate.toString(),
    option.maturityAt?.toISOString().slice(0, 10) ?? '',
    option.liquidity ?? '',
  ].join('|')
}
