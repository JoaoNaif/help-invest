export const LlmPurpose = {
  EXTRACTION: 'EXTRACTION',
  EXPLANATION: 'EXPLANATION',
  STOCK_EXPLANATION: 'STOCK_EXPLANATION',
} as const

export type LlmPurpose = (typeof LlmPurpose)[keyof typeof LlmPurpose]
