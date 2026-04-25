export const ZONES = ['all', 'north', 'south', 'east', 'west'] as const
export type Zone = (typeof ZONES)[number]

export const ALERT_CATEGORIES = ['medical', 'safety', 'supply', 'route'] as const
export type AlertCategory = (typeof ALERT_CATEGORIES)[number]
