export const ComparisonStatus = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  DONE: 'DONE',
} as const

export type ComparisonStatus =
  (typeof ComparisonStatus)[keyof typeof ComparisonStatus]
