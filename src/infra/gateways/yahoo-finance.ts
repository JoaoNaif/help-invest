/**
 * Constantes do Yahoo Finance (fonte não oficial, sem chave) compartilhadas
 * pelos adapters de ações e de índices.
 */

export const YAHOO_SOURCE = 'Yahoo Finance'

export const YAHOO_CHART_URL =
  'https://query1.finance.yahoo.com/v8/finance/chart'

/** O Yahoo recusa requisições sem User-Agent de navegador. */
export const YAHOO_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export const YAHOO_REQUEST_TIMEOUT_MS = 15_000
