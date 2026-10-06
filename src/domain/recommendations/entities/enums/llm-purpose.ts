export const LlmPurpose = {
  EXTRACTION: 'EXTRACTION',
  EXPLANATION: 'EXPLANATION',
} as const

export type LlmPurpose = (typeof LlmPurpose)[keyof typeof LlmPurpose]
