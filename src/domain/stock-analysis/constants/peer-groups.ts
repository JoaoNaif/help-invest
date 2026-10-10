/**
 * Grupos de concorrentes para comparar múltiplos (P/L, P/VP).
 * Fonte: curadoria própria — maiores bancos de varejo listados na B3.
 * Conferido em: 2026-10-09. Lista fixa de propósito: a comparação precisa dar o
 * mesmo resultado hoje e amanhã, e não depender da classificação de uma API.
 *
 * Só entra o papel mais líquido de cada empresa (ex.: BBDC4, não BBDC3), para
 * não comparar a empresa com ela mesma.
 */
export interface PeerGroup {
  key: string
  label: string
  tickers: readonly string[]
}

export const PEER_GROUPS: readonly PeerGroup[] = [
  {
    key: 'BANKS',
    label: 'bancos',
    tickers: ['BBAS3', 'ITUB4', 'BBDC4', 'SANB11'],
  },
]

export const PEER_GROUPS_SOURCE =
  'Curadoria própria (maiores bancos listados na B3), conferida em 2026-10-09'

/** Grupo do ticker, ou `null` se ele não está em nenhuma lista. */
export function findPeerGroup(ticker: string): PeerGroup | null {
  const normalized = ticker.trim().toUpperCase()

  return PEER_GROUPS.find((group) => group.tickers.includes(normalized)) ?? null
}
