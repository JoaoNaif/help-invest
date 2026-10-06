export const Indicator = {
  SELIC: 'SELIC',
  CDI: 'CDI',
  IPCA: 'IPCA',
} as const

export type Indicator = (typeof Indicator)[keyof typeof Indicator]
