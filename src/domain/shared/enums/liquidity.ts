export const Liquidity = {
  DAILY: 'DAILY',
  AT_MATURITY: 'AT_MATURITY',
  GRACE_PERIOD: 'GRACE_PERIOD',
} as const

export type Liquidity = (typeof Liquidity)[keyof typeof Liquidity]
