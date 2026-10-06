import { z } from 'zod'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { Indexer } from '@/domain/shared/enums/indexer'
import { Liquidity } from '@/domain/shared/enums/liquidity'
import {
  cnpjSchema,
  dateOnlySchema,
  nonNegativeDecimalSchema,
  positiveDecimalSchema,
} from './common'

/** Opção digitada pelo usuário (UC-14 manual e UC-15). */
export const comparisonOptionInputSchema = z.object({
  assetType: z.nativeEnum(AssetType),
  indexer: z.nativeEnum(Indexer),
  rate: positiveDecimalSchema,
  issuerName: z.string().trim().min(1).nullish(),
  issuerCnpj: cnpjSchema.nullish(),
  maturityAt: dateOnlySchema.nullish(),
  liquidity: z.nativeEnum(Liquidity).nullish(),
  graceDays: z.number().int().nonnegative().nullish(),
  minAmount: nonNegativeDecimalSchema.nullish(),
  rawInput: z.string().nullish(),
})

/** Teto de opções por comparação: protege o motor e o prompt do LLM. */
export const MAX_COMPARISON_OPTIONS = 20
