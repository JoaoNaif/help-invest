import { AssetClass } from '../../entities/enums/asset-class'

export interface PortfolioHighlight {
  assetClass: AssetClass
  text: string
}

/**
 * Explicação redigida pelo LLM a partir do resultado do motor. Nenhum número
 * novo nasce aqui; não cita produto nem ticker e não manda comprar/vender.
 */
export interface PortfolioExplanation {
  /** 2 a 3 frases, linguagem simples. */
  summary: string
  highlights: PortfolioHighlight[]
  attentionPoints: string[]
}
