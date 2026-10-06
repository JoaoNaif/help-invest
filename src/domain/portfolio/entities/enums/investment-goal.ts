export const InvestmentGoal = {
  RESERVE: 'RESERVE',
  RETIREMENT: 'RETIREMENT',
  PURCHASE: 'PURCHASE',
  GROWTH: 'GROWTH',
} as const

export type InvestmentGoal =
  (typeof InvestmentGoal)[keyof typeof InvestmentGoal]
