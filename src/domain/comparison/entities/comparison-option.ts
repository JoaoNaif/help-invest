import Decimal from 'decimal.js'
import { Entity } from '@/core/entities/entity'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { Optional } from '@/core/types/optional'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { DataSource } from '@/domain/shared/enums/data-source'
import { Indexer } from '@/domain/shared/enums/indexer'
import { Liquidity } from '@/domain/shared/enums/liquidity'
import { Alert } from '@/domain/shared/alert'

export interface ComparisonOptionProps {
  comparisonId: UniqueEntityId
  assetType: AssetType
  issuerName: string | null
  issuerCnpj: string | null
  indexer: Indexer
  rate: Decimal
  maturityAt: Date | null
  liquidity: Liquidity | null
  graceDays: number | null
  minAmount: Decimal | null
  /** Taxa líquida a.a. após IR — calculada só pelo motor de regras. */
  netAnnualRate: Decimal | null
  /** Alertas gerados só pelo motor de regras. */
  alerts: Alert[]
  rawInput: string | null
  source: DataSource
  createdAt: Date
}

type ComparisonOptionOptionalProps =
  | 'issuerName'
  | 'issuerCnpj'
  | 'maturityAt'
  | 'liquidity'
  | 'graceDays'
  | 'minAmount'
  | 'netAnnualRate'
  | 'alerts'
  | 'rawInput'
  | 'createdAt'

/**
 * Cada opção comparada (ex.: cada CDB). Alterar qualquer dado de entrada
 * descarta o resultado calculado, que precisa ser refeito pelo motor.
 */
export class ComparisonOption extends Entity<ComparisonOptionProps> {
  get comparisonId() {
    return this.props.comparisonId
  }

  get assetType() {
    return this.props.assetType
  }

  set assetType(assetType: AssetType) {
    this.props.assetType = assetType
    this.clearEvaluation()
  }

  get issuerName() {
    return this.props.issuerName
  }

  set issuerName(issuerName: string | null) {
    this.props.issuerName = issuerName
    this.clearEvaluation()
  }

  get issuerCnpj() {
    return this.props.issuerCnpj
  }

  set issuerCnpj(issuerCnpj: string | null) {
    this.props.issuerCnpj = issuerCnpj
    this.clearEvaluation()
  }

  get indexer() {
    return this.props.indexer
  }

  set indexer(indexer: Indexer) {
    this.props.indexer = indexer
    this.clearEvaluation()
  }

  get rate() {
    return this.props.rate
  }

  set rate(rate: Decimal) {
    this.props.rate = rate
    this.clearEvaluation()
  }

  get maturityAt() {
    return this.props.maturityAt
  }

  set maturityAt(maturityAt: Date | null) {
    this.props.maturityAt = maturityAt
    this.clearEvaluation()
  }

  get liquidity() {
    return this.props.liquidity
  }

  set liquidity(liquidity: Liquidity | null) {
    this.props.liquidity = liquidity
    this.clearEvaluation()
  }

  get graceDays() {
    return this.props.graceDays
  }

  set graceDays(graceDays: number | null) {
    this.props.graceDays = graceDays
    this.clearEvaluation()
  }

  get minAmount() {
    return this.props.minAmount
  }

  set minAmount(minAmount: Decimal | null) {
    this.props.minAmount = minAmount
    this.clearEvaluation()
  }

  get netAnnualRate() {
    return this.props.netAnnualRate
  }

  get alerts() {
    return this.props.alerts
  }

  get rawInput() {
    return this.props.rawInput
  }

  get source() {
    return this.props.source
  }

  get createdAt() {
    return this.props.createdAt
  }

  get isEvaluated() {
    return this.props.netAnnualRate !== null
  }

  /** Grava o resultado do motor de regras. */
  applyEvaluation(netAnnualRate: Decimal, alerts: Alert[]) {
    this.props.netAnnualRate = netAnnualRate
    this.props.alerts = alerts
  }

  private clearEvaluation() {
    this.props.netAnnualRate = null
    this.props.alerts = []
  }

  static create(
    props: Optional<ComparisonOptionProps, ComparisonOptionOptionalProps>,
    id?: UniqueEntityId
  ) {
    return new ComparisonOption(
      {
        ...props,
        issuerName: props.issuerName ?? null,
        issuerCnpj: props.issuerCnpj ?? null,
        maturityAt: props.maturityAt ?? null,
        liquidity: props.liquidity ?? null,
        graceDays: props.graceDays ?? null,
        minAmount: props.minAmount ?? null,
        netAnnualRate: props.netAnnualRate ?? null,
        alerts: props.alerts ?? [],
        rawInput: props.rawInput ?? null,
        createdAt: props.createdAt ?? new Date(),
      },
      id
    )
  }
}
