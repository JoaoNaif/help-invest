import Decimal from 'decimal.js'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { Indexer } from '@/domain/shared/enums/indexer'
import { Liquidity } from '@/domain/shared/enums/liquidity'

/**
 * Dados de entrada de uma opção — digitados pelo usuário ou extraídos pelo LLM.
 * Não tem `netAnnualRate` nem `alerts`: esses só o motor de regras preenche.
 */
export interface ComparisonOptionInput {
  assetType: AssetType
  indexer: Indexer
  /** Ex.: 110 (% do CDI), 6.5 (IPCA + 6,5%), 14.2 (prefixado % a.a.). */
  rate: Decimal
  issuerName?: string | null
  issuerCnpj?: string | null
  maturityAt?: Date | null
  liquidity?: Liquidity | null
  graceDays?: number | null
  minAmount?: Decimal | null
  /** Trecho original de onde a opção saiu (texto colado ou lido do print). */
  rawInput?: string | null
}
