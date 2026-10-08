import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { addDays } from '@shared/dates'
import { createStats, evaluationWeek } from '@shared/stats'
import type { Snapshot } from '@shared/types'
import { useCoach } from './useCoach'
import Analytics from './views/Analytics'
import Coach from './views/Coach'
import Tracker from './views/Tracker'

type View = 'tracker' | 'analytics' | 'coach'

const NAV: { id: View; label: string; icon: ReactNode }[] = [
  {
    id: 'tracker',
    label: 'Tracker',
    icon: <path d="M4 5h16M4 12h16M4 19h16M8 3v4M14 10v4M10 17v4" />
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  },
  {
    id: 'coach',
    label: 'Coach',
    icon: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
  }
]

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [view, setView] = useState<View>('tracker')
  const [newEvaluation, setNewEvaluation] = useState(false)
  const coach = useCoach()

  const refresh = useCallback(async () => setSnapshot(await window.api.getSnapshot()), [])
  useEffect(() => {
    void refresh()
    // Coming back to the window re-reads the data, which also rolls "today" over after midnight.
    const onFocus = (): void => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  const stats = useMemo(() => (snapshot ? createStats(snapshot) : null), [snapshot])

  const toggle = useCallback(
    (habitId: number, date: string) => {
      // Paint the dot immediately; the database call confirms it.
      setSnapshot((s) => {
        if (!s) return s
        const has = s.logs.some((l) => l.habitId === habitId && l.date === date)
        const logs = has
          ? s.logs.filter((l) => !(l.habitId === habitId && l.date === date))
          : [...s.logs, { habitId, date }]
        return { ...s, logs }
      })
      window.api.toggleLog(habitId, date).catch(refresh)
    },
    [refresh]
  )

  // End-of-week evaluation: written once, the first time the app is open after
  // the week has data and is due.
  const autoEvaluated = useRef(false)
  useEffect(() => {
    if (autoEvaluated.current || !snapshot || !coach.ready || !coach.status.hasKey) return
    const week = evaluationWeek()
    const end = addDays(week, 6)
    const hasData = snapshot.logs.some((l) => l.date >= week && l.date <= end)
    if (!hasData || coach.evaluations.some((e) => e.weekStart === week)) return
    autoEvaluated.current = true
    void coach.generate(week).then((ok) => ok && setNewEvaluation(true))
  }, [snapshot, coach])

  const open = (next: View): void => {
    setView(next)
    if (next === 'coach') setNewEvaluation(false)
  }

  return (
    <div className="flex h-full">
      <nav className="flex w-[76px] shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-4">
        <div className="mb-4 grid size-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-sm font-bold text-page">
          H
        </div>
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => open(item.id)}
            className={`relative flex w-16 flex-col items-center gap-1 rounded-xl py-2 text-[11px] transition ${
              view === item.id ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-raised hover:text-ink-2'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {item.icon}
            </svg>
            {item.label}
            {item.id === 'coach' && newEvaluation && view !== 'coach' && (
              <span className="absolute right-3 top-1.5 size-2 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </nav>
      <main className="min-w-0 flex-1 overflow-auto">
        {!snapshot || !stats ? null : view === 'tracker' ? (
          <Tracker
            snapshot={snapshot}
            stats={stats}
            onToggle={toggle}
            onAdd={(categoryId, name) => window.api.addHabit(categoryId, name).then(refresh)}
            onArchive={(habitId) => window.api.archiveHabit(habitId).then(refresh)}
          />
        ) : view === 'analytics' ? (
          <Analytics snapshot={snapshot} stats={stats} />
        ) : (
          <Coach coach={coach} />
        )}
      </main>
    </div>
  )
}
