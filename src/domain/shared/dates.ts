/** Datas de calendário em UTC (meia-noite UTC), usadas em índices e prazos. */

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
}

export function addUtcDays(date: Date, days: number) {
  const result = startOfUtcDay(date)
  result.setUTCDate(result.getUTCDate() + days)

  return result
}

export function addUtcMonths(date: Date, months: number) {
  const result = startOfUtcDay(date)
  result.setUTCMonth(result.getUTCMonth() + months)

  return result
}

export function addUtcYears(date: Date, years: number) {
  const result = startOfUtcDay(date)
  result.setUTCFullYear(result.getUTCFullYear() + years)

  return result
}

/** Dias corridos entre as datas de calendário (pode ser negativo). */
export function daysBetween(from: Date, to: Date) {
  return Math.round(
    (startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / MS_PER_DAY
  )
}
