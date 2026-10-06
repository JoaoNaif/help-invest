import { AlertSeverity } from './enums/alert-severity'

/** Alerta gerado pelo motor de regras (nunca pelo LLM). */
export interface ComparisonAlert {
  /** Identificador estável da regra, ex.: "ABOVE_FGC_LIMIT". */
  code: string
  severity: AlertSeverity
  message: string
}
