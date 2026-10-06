import { Indicator } from '../../entities/enums/indicator'
import { IndicatorValue } from '../../entities/indicator-value'

export abstract class IndicatorValuesRepository {
  /** Valor mais recente gravado do indicador. */
  abstract findLatest(indicator: Indicator): Promise<IndicatorValue | null>
  /**
   * Grava ignorando duplicados (`indicator` + `date`).
   * Devolve quantos foram de fato inseridos.
   */
  abstract createMany(values: IndicatorValue[]): Promise<number>
}
