import Decimal from 'decimal.js'

/** R$ 1.234,56 — formata direto do Decimal, sem passar por float. */
export function formatBRL(value: Decimal) {
  const [integer, cents] = value.toFixed(2).split('.')
  const isNegative = integer.startsWith('-')
  const digits = isNegative ? integer.slice(1) : integer
  const withThousands = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  return `${isNegative ? '-' : ''}R$ ${withThousands},${cents}`
}

/** 12,3% — recebe o valor já em pontos percentuais (0–100). */
export function formatPercent(value: Decimal, decimalPlaces = 1) {
  return `${value.toFixed(decimalPlaces).replace('.', ',')}%`
}
