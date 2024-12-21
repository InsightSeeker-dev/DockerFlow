export const ALERT_STATUS = {
  PENDING: 'PENDING',
  RESOLVED: 'RESOLVED',
  DISMISSED: 'DISMISSED',
} as const;

export const ALERT_TYPE = {
  CONTAINER: 'CONTAINER',
  SYSTEM: 'SYSTEM',
  USER: 'USER',
} as const;

export const ALERT_SEVERITY = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL',
} as const;

export type AlertStatus = typeof ALERT_STATUS[keyof typeof ALERT_STATUS];
export type AlertType = typeof ALERT_TYPE[keyof typeof ALERT_TYPE];
export type AlertSeverity = typeof ALERT_SEVERITY[keyof typeof ALERT_SEVERITY];
