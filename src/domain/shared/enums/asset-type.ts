export const AssetType = {
  CDB: 'CDB',
  LCI: 'LCI',
  LCA: 'LCA',
  LC: 'LC',
  TESOURO: 'TESOURO',
  DEBENTURE: 'DEBENTURE',
  CRI: 'CRI',
  CRA: 'CRA',
  ACAO: 'ACAO',
  FII: 'FII',
  FUNDO: 'FUNDO',
  CRIPTO: 'CRIPTO',
  OUTRO: 'OUTRO',
} as const

export type AssetType = (typeof AssetType)[keyof typeof AssetType]
