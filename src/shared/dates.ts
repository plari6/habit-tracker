// All dates are local calendar days stored as YYYY-MM-DD strings.

const pad = (n: number): string => String(n).padStart(2, '0')

export const toISO = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const fromISO = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = (): string => toISO(new Date())

export const addDays = (iso: string, n: number): string => {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Monday of the week containing `iso`. */
export const weekStart = (iso: string): string => addDays(iso, -((fromISO(iso).getDay() + 6) % 7))

/** Inclusive list of days from `from` to `to`. */
export const dayRange = (from: string, to: string): string[] => {
  const days: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d)
  return days
}

export const daysInMonth = (year: number, month: number): string[] => {
  const count = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: count }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`)
}

export const formatDay = (iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string =>
  fromISO(iso).toLocaleDateString('en-US', opts)

export const formatWeek = (start: string): string => `${formatDay(start)} – ${formatDay(addDays(start, 6))}`
