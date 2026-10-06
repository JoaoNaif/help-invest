import Decimal from 'decimal.js'
import { Entity } from '@/core/entities/entity'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { Optional } from '@/core/types/optional'
import { ComparisonStatus } from './enums/comparison-status'

/** Premissas usadas no cálculo (CDI do dia, alíquota de IR, data...). */
export type ComparisonAssumptions = Record<string, unknown>

export interface ComparisonProps {
  userId: UniqueEntityId
  amount: Decimal
  horizonMonths: number
  status: ComparisonStatus
  assumptions: ComparisonAssumptions | null
  chosenOptionId: UniqueEntityId | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Uma comparação de opções. Fluxo: DRAFT → CONFIRMED → DONE.
 * O use-case checa `canConfirm` / `canComplete` antes de transicionar e
 * devolve `left(...)` se não puder.
 */
export class Comparison extends Entity<ComparisonProps> {
  get userId() {
    return this.props.userId
  }

  get amount() {
    return this.props.amount
  }

  set amount(amount: Decimal) {
    this.props.amount = amount
    this.touch()
  }

  get horizonMonths() {
    return this.props.horizonMonths
  }

  set horizonMonths(horizonMonths: number) {
    this.props.horizonMonths = horizonMonths
    this.touch()
  }

  get status() {
    return this.props.status
  }

  get assumptions() {
    return this.props.assumptions
  }

  get chosenOptionId() {
    return this.props.chosenOptionId
  }

  get createdAt() {
    return this.props.createdAt
  }

  get updatedAt() {
    return this.props.updatedAt
  }

  get canConfirm() {
    return this.props.status === ComparisonStatus.DRAFT
  }

  get canComplete() {
    return this.props.status === ComparisonStatus.CONFIRMED
  }

  /** Usuário conferiu os dados extraídos. */
  confirm() {
    this.props.status = ComparisonStatus.CONFIRMED
    this.touch()
  }

  /** Motor de regras terminou o cálculo. */
  complete(assumptions: ComparisonAssumptions) {
    this.props.status = ComparisonStatus.DONE
    this.props.assumptions = assumptions
    this.touch()
  }

  chooseOption(optionId: UniqueEntityId) {
    this.props.chosenOptionId = optionId
    this.touch()
  }

  private touch() {
    this.props.updatedAt = new Date()
  }

  static create(
    props: Optional<
      ComparisonProps,
      'status' | 'assumptions' | 'chosenOptionId' | 'createdAt' | 'updatedAt'
    >,
    id?: UniqueEntityId
  ) {
    const now = new Date()

    return new Comparison(
      {
        ...props,
        status: props.status ?? ComparisonStatus.DRAFT,
        assumptions: props.assumptions ?? null,
        chosenOptionId: props.chosenOptionId ?? null,
        createdAt: props.createdAt ?? now,
        updatedAt: props.updatedAt ?? now,
      },
      id
    )
  }
}
