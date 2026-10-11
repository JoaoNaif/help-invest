import { Indicator } from '../../entities/enums/indicator'
import { IndicatorValue } from '../../entities/indicator-value'

export abstract class IndicatorValuesRepository {
  /** Valor mais recente gravado do indicador. */
  abstract findLatest(indicator: Indicator): Promise<IndicatorValue | null>
  /** Os `limit` valores mais recentes, do mais novo para o mais antigo. */
  abstract findRecent(
    indicator: Indicator,
    limit: number
  ): Promise<IndicatorValue[]>
  /** Último valor com data igual ou anterior a `date`; `null` se não houver. */
  abstract findOnOrBefore(
    indicator: Indicator,
    date: Date
  ): Promise<IndicatorValue | null>
  /**
   * Grava ignorando duplicados (`indicator` + `date`).
   * Devolve quantos foram de fato inseridos.
   */
  abstract createMany(values: IndicatorValue[]): Promise<number>
}
