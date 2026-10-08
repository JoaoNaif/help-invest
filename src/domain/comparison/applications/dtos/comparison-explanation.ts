/** Prós e contras de uma opção, em frases curtas. */
export interface OptionExplanation {
  optionId: string
  pros: string[]
  cons: string[]
}

/**
 * Explicação estruturada do resultado da comparação. Texto redigido pelo LLM
 * a partir dos números do motor; nenhum número novo nasce aqui.
 */
export interface ComparisonExplanation {
  /** 2 a 3 frases, linguagem simples. */
  summary: string
  /** Opção que mais combina com o objetivo; `null` = sem indicação. */
  bestOptionId: string | null
  bestReason: string | null
  options: OptionExplanation[]
}
