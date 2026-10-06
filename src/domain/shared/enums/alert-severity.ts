export const AlertSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  DANGER: 'DANGER',
} as const

export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity]
