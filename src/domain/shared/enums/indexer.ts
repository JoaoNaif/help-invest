export const Indexer = {
  PRE: 'PRE',
  CDI: 'CDI',
  IPCA: 'IPCA',
  SELIC: 'SELIC',
} as const

export type Indexer = (typeof Indexer)[keyof typeof Indexer]
