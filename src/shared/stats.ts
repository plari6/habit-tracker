import { addDays, dayRange, today, weekStart } from './dates'
import type { Habit, Snapshot } from './types'

export interface Rate {
  done: number
  scheduled: number
}

export const pct = (r: Rate): number => (r.scheduled === 0 ? 0 : Math.round((r.done / r.scheduled) * 100))

export interface Stats {
  isDone(habitId: number, date: string): boolean
  /** Whether a day counts towards a habit's completion rate. */
  isScheduled(habit: Habit, date: string): boolean
  /** Completion over an inclusive date range; days before a habit started or after today don't count. */
  rate(habits: Habit[], from: string, to: string): Rate
  streak(habit: Habit): { current: number; longest: number }
}

export function createStats(snapshot: Snapshot, now: string = today()): Stats {
  const done = new Set(snapshot.logs.map((l) => `${l.habitId}|${l.date}`))
  const datesByHabit = new Map<number, string[]>()
  for (const l of snapshot.logs) {
    const list = datesByHabit.get(l.habitId)
    if (list) list.push(l.date)
    else datesByHabit.set(l.habitId, [l.date])
  }
  for (const list of datesByHabit.values()) list.sort()

  // A habit is "scheduled" daily from the day it was added, or from its first
  // check-in if earlier days were back-filled.
  const startOf = (h: Habit): string => {
    const first = datesByHabit.get(h.id)?.[0]
    return first && first < h.createdOn ? first : h.createdOn
  }

  const isDone = (habitId: number, date: string): boolean => done.has(`${habitId}|${date}`)

  return {
    isDone,
    isScheduled: (habit, date) => date >= startOf(habit) && date <= now,
    rate(habits, from, to) {
      const end = to > now ? now : to
      const total: Rate = { done: 0, scheduled: 0 }
      for (const h of habits) {
        const start = startOf(h) > from ? startOf(h) : from
        if (start > end) continue
        for (const d of dayRange(start, end)) {
          total.scheduled++
          if (isDone(h.id, d)) total.done++
        }
      }
      return total
    },
    streak(habit) {
      const dates = datesByHabit.get(habit.id) ?? []
      let longest = 0
      let run = 0
      let prev = ''
      for (const d of dates) {
        if (d > now) break
        run = prev && addDays(prev, 1) === d ? run + 1 : 1
        if (run > longest) longest = run
        prev = d
      }
      // Today not being ticked yet doesn't break a streak.
      let cursor = isDone(habit.id, now) ? now : addDays(now, -1)
      let current = 0
      while (isDone(habit.id, cursor)) {
        current++
        cursor = addDays(cursor, -1)
      }
      return { current, longest }
    }
  }
}

/** The week an end-of-week evaluation is due for: this week on Sunday, otherwise the last full week. */
export const evaluationWeek = (now: string = today()): string => {
  const start = weekStart(now)
  return addDays(start, 6) === now ? start : addDays(start, -7)
}
