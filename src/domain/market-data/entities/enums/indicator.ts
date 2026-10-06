/**
 * O que cada valor gravado representa (fonte: API SGS do Banco Central).
 * O `RateNormalizer` do comparador depende dessas unidades.
 */
export const Indicator = {
  /** Meta Selic definida pelo Copom, % a.a. — SGS 432. */
  SELIC: 'SELIC',
  /** CDI anualizado base 252, % a.a. — SGS 4389. */
  CDI: 'CDI',
  /** IPCA, variação % no mês — SGS 433. */
  IPCA: 'IPCA',
} as const

export type Indicator = (typeof Indicator)[keyof typeof Indicator]
