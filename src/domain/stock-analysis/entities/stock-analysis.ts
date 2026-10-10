import { Entity } from '@/core/entities/entity'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { Optional } from '@/core/types/optional'
import { StockAnalysisReport } from '../applications/dtos/stock-analysis-report'

/** Resultado do motor, no formato gravado e devolvido ao front. */
export type StockAnalysisResult = StockAnalysisReport

/** Premissas usadas no cálculo (6% do Bazin, faixa de ±15%, janelas...). */
export type StockAnalysisAssumptions = Record<string, unknown>

export interface StockAnalysisProps {
  userId: UniqueEntityId
  /** 1 ticker = análise isolada; 2+ = "comprar com outra". */
  tickers: string[]
  result: StockAnalysisResult
  assumptions: StockAnalysisAssumptions
  createdAt: Date
}

/**
 * Uma análise de ação(ões). Somente leitura depois de criada: nova
 * cotação = nova análise, para o histórico refletir o que o usuário viu.
 */
export class StockAnalysis extends Entity<StockAnalysisProps> {
  get userId() {
    return this.props.userId
  }

  get tickers() {
    return this.props.tickers
  }

  get result() {
    return this.props.result
  }

  get assumptions() {
    return this.props.assumptions
  }

  get createdAt() {
    return this.props.createdAt
  }

  static create(
    props: Optional<StockAnalysisProps, 'createdAt'>,
    id?: UniqueEntityId
  ) {
    return new StockAnalysis(
      {
        ...props,
        createdAt: props.createdAt ?? new Date(),
      },
      id
    )
  }
}
