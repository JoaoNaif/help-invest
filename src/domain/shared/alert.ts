import { AlertSeverity } from './enums/alert-severity'

/**
 * Alerta gerado pelas regras em código (nunca pelo LLM).
 * Mesmo formato no resumo da carteira e no comparador.
 */
export interface Alert {
  /** Identificador estável da regra, ex.: "ABOVE_FGC_LIMIT". */
  code: string
  severity: AlertSeverity
  message: string
}
