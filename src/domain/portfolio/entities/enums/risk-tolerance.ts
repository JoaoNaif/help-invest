export const RiskTolerance = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const

export type RiskTolerance = (typeof RiskTolerance)[keyof typeof RiskTolerance]
