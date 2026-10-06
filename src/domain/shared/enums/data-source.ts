export const DataSource = {
  MANUAL: 'MANUAL',
  LLM_EXTRACTED: 'LLM_EXTRACTED',
} as const

export type DataSource = (typeof DataSource)[keyof typeof DataSource]
