const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const numberFormatter = new Intl.NumberFormat('en-US')

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso))
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

export function formatRelative(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormatter.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`
}
