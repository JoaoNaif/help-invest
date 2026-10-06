import Decimal from 'decimal.js'
import { Entity } from '@/core/entities/entity'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { Optional } from '@/core/types/optional'
import { Indicator } from './enums/indicator'

export interface IndicatorValueProps {
  indicator: Indicator
  date: Date
  value: Decimal
  /** Ex.: "BCB SGS 432". */
  source: string
  fetchedAt: Date
}

/** Valor de um índice em um dia (dado público, imutável). */
export class IndicatorValue extends Entity<IndicatorValueProps> {
  get indicator() {
    return this.props.indicator
  }

  get date() {
    return this.props.date
  }

  get value() {
    return this.props.value
  }

  get source() {
    return this.props.source
  }

  get fetchedAt() {
    return this.props.fetchedAt
  }

  static create(
    props: Optional<IndicatorValueProps, 'fetchedAt'>,
    id?: UniqueEntityId
  ) {
    return new IndicatorValue(
      { ...props, fetchedAt: props.fetchedAt ?? new Date() },
      id
    )
  }
}
