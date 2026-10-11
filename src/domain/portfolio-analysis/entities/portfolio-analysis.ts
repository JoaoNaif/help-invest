import { Entity } from '@/core/entities/entity'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { Optional } from '@/core/types/optional'
import { PortfolioAnalysisReport } from '../applications/dtos/portfolio-analysis-report'
import { PortfolioStrategy } from './enums/portfolio-strategy'

/** Resultado do motor, no formato gravado e devolvido ao front. */
export type PortfolioAnalysisResult = PortfolioAnalysisReport

/** Premissas usadas (tabela-alvo, limiares, fórmulas, fontes), para auditoria. */
export type PortfolioAnalysisAssumptions = Record<string, unknown>

export interface PortfolioAnalysisProps {
  userId: UniqueEntityId
  strategy: PortfolioStrategy
  result: PortfolioAnalysisResult
  assumptions: PortfolioAnalysisAssumptions
  createdAt: Date
}

/**
 * Uma análise da carteira. Somente leitura depois de criada: carteira ou
 * mercado mudou = nova análise, para o histórico refletir o que o usuário viu.
 */
export class PortfolioAnalysis extends Entity<PortfolioAnalysisProps> {
  get userId() {
    return this.props.userId
  }

  get strategy() {
    return this.props.strategy
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
    props: Optional<PortfolioAnalysisProps, 'createdAt'>,
    id?: UniqueEntityId
  ) {
    return new PortfolioAnalysis(
      {
        ...props,
        createdAt: props.createdAt ?? new Date(),
      },
      id
    )
  }
}
