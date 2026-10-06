import Decimal from 'decimal.js'
import { z } from 'zod'

/**
 * Dinheiro/taxa na entrada: string ("1500.50") ou número, nunca float em
 * cálculo — vira `Decimal` já na borda.
 */
export const decimalSchema = z
  .union([z.string().trim().min(1), z.number()])
  .transform((value, ctx) => {
    try {
      const decimal = new Decimal(value)

      if (decimal.isFinite()) {
        return decimal
      }
    } catch {
      // cai no issue abaixo
    }

    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid number' })

    return z.NEVER
  })

export const positiveDecimalSchema = decimalSchema.refine(
  (value) => value.gt(0),
  { message: 'Must be greater than zero' }
)

export const nonNegativeDecimalSchema = decimalSchema.refine(
  (value) => value.gte(0),
  { message: 'Must be zero or greater' }
)

/** "YYYY-MM-DD" → Date à meia-noite UTC (as colunas são `@db.Date`). */
export const dateOnlySchema = z
  .string()
  .date()
  .transform((value) => new Date(value))

export const cnpjSchema = z.string().regex(/^\d{14}$/, 'CNPJ must have 14 digits')

export const uuidParamSchema = z.string().uuid()

/** Data sem hora para a resposta: "YYYY-MM-DD". */
export function formatDateOnly(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : null
}
