import Decimal from 'decimal.js'
import { Entity } from '@/core/entities/entity'
import { UniqueEntityId } from '@/core/entities/unique-entity-id'
import { Optional } from '@/core/types/optional'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { DataSource } from '@/domain/shared/enums/data-source'
import { Indexer } from '@/domain/shared/enums/indexer'
import { Liquidity } from '@/domain/shared/enums/liquidity'

export interface PositionProps {
  userId: UniqueEntityId
  assetType: AssetType
  name: string
  issuerName: string | null
  issuerCnpj: string | null
  investedAmount: Decimal
  indexer: Indexer | null
  /** Ex.: 110 (% do CDI) ou 6.5 (IPCA + 6,5%). */
  rate: Decimal | null
  investedAt: Date | null
  maturityAt: Date | null
  liquidity: Liquidity | null
  source: DataSource
  createdAt: Date
  updatedAt: Date
}

type PositionOptionalProps =
  | 'issuerName'
  | 'issuerCnpj'
  | 'indexer'
  | 'rate'
  | 'investedAt'
  | 'maturityAt'
  | 'liquidity'
  | 'createdAt'
  | 'updatedAt'

/** O que o usuário já tem investido. */
export class Position extends Entity<PositionProps> {
  get userId() {
    return this.props.userId
  }

  get assetType() {
    return this.props.assetType
  }

  set assetType(assetType: AssetType) {
    this.props.assetType = assetType
    this.touch()
  }

  get name() {
    return this.props.name
  }

  set name(name: string) {
    this.props.name = name
    this.touch()
  }

  get issuerName() {
    return this.props.issuerName
  }

  set issuerName(issuerName: string | null) {
    this.props.issuerName = issuerName
    this.touch()
  }

  get issuerCnpj() {
    return this.props.issuerCnpj
  }

  set issuerCnpj(issuerCnpj: string | null) {
    this.props.issuerCnpj = issuerCnpj
    this.touch()
  }

  get investedAmount() {
    return this.props.investedAmount
  }

  set investedAmount(investedAmount: Decimal) {
    this.props.investedAmount = investedAmount
    this.touch()
  }

  get indexer() {
    return this.props.indexer
  }

  set indexer(indexer: Indexer | null) {
    this.props.indexer = indexer
    this.touch()
  }

  get rate() {
    return this.props.rate
  }

  set rate(rate: Decimal | null) {
    this.props.rate = rate
    this.touch()
  }

  get investedAt() {
    return this.props.investedAt
  }

  set investedAt(investedAt: Date | null) {
    this.props.investedAt = investedAt
    this.touch()
  }

  get maturityAt() {
    return this.props.maturityAt
  }

  set maturityAt(maturityAt: Date | null) {
    this.props.maturityAt = maturityAt
    this.touch()
  }

  get liquidity() {
    return this.props.liquidity
  }

  set liquidity(liquidity: Liquidity | null) {
    this.props.liquidity = liquidity
    this.touch()
  }

  get source() {
    return this.props.source
  }

  get createdAt() {
    return this.props.createdAt
  }

  get updatedAt() {
    return this.props.updatedAt
  }

  private touch() {
    this.props.updatedAt = new Date()
  }

  static create(
    props: Optional<PositionProps, PositionOptionalProps>,
    id?: UniqueEntityId
  ) {
    const now = new Date()

    return new Position(
      {
        ...props,
        issuerName: props.issuerName ?? null,
        issuerCnpj: props.issuerCnpj ?? null,
        indexer: props.indexer ?? null,
        rate: props.rate ?? null,
        investedAt: props.investedAt ?? null,
        maturityAt: props.maturityAt ?? null,
        liquidity: props.liquidity ?? null,
        createdAt: props.createdAt ?? now,
        updatedAt: props.updatedAt ?? now,
      },
      id
    )
  }
}
