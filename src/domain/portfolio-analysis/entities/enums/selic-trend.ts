export const SelicTrend = {
  FALLING: 'FALLING',
  STABLE: 'STABLE',
  RISING: 'RISING',
} as const

export type SelicTrend = (typeof SelicTrend)[keyof typeof SelicTrend]
