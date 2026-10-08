import { useState, type FormEvent } from 'react'
import { daysInMonth, formatDay, fromISO, today } from '@shared/dates'
import { pct, type Stats } from '@shared/stats'
import type { Category, Habit, Snapshot } from '@shared/types'

interface Props {
  snapshot: Snapshot
  stats: Stats
  onToggle(habitId: number, date: string): void
  onAdd(categoryId: number, name: string): Promise<void>
  onArchive(habitId: number): Promise<void>
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function Tracker({ snapshot, stats, onToggle, onAdd, onArchive }: Props) {
  const now = today()
  const [{ year, month }, setMonth] = useState(() => {
    const d = fromISO(now)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const days = daysInMonth(year, month)
  const columns = { gridTemplateColumns: `168px repeat(${days.length}, minmax(22px, 1fr)) 52px` }

  const shift = (by: number): void => {
    const d = new Date(year, month + by, 1)
    setMonth({ year: d.getFullYear(), month: d.getMonth() })
  }
  const goToday = (): void => {
    const d = fromISO(now)
    setMonth({ year: d.getFullYear(), month: d.getMonth() })
  }

  const doneToday = snapshot.habits.filter((h) => stats.isDone(h.id, now)).length
  const total = snapshot.habits.length

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-6">
      <header className="mb-6 flex items-center gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Habit Tracker</p>
          <h1 className="text-2xl font-semibold">
            {new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h1>
        </div>
        <div className="ml-2 flex items-center gap-1">
          <NavButton label="Previous month" onClick={() => shift(-1)}>
            ‹
          </NavButton>
          <NavButton label="Next month" onClick={() => shift(1)}>
            ›
          </NavButton>
          <button
            onClick={goToday}
            className="ml-1 rounded-lg border border-line px-3 py-1.5 text-xs text-ink-2 hover:bg-raised"
          >
            Today
          </button>
        </div>
        <div className="ml-auto w-56">
          <div className="mb-1.5 flex items-baseline justify-between text-xs text-ink-2">
            <span>Today</span>
            <span className="tabular-nums">
              <span className="text-base font-semibold text-ink">{doneToday}</span> / {total} done
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-raised">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-all"
              style={{ width: `${total ? (doneToday / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface px-4 pb-3 pt-2">
        <div className="min-w-[920px]">
          <div className="grid items-end pb-1" style={columns}>
            <span />
            {days.map((d) => (
              <div key={d} className="flex flex-col items-center gap-0.5 text-[10px] text-muted">
                <span>{WEEKDAYS[fromISO(d).getDay()]}</span>
                <span
                  className={`grid size-5 place-items-center rounded-full tabular-nums ${
                    d === now ? 'bg-accent font-semibold text-page' : 'text-ink-2'
                  }`}
                >
                  {Number(d.slice(8))}
                </span>
              </div>
            ))}
            <span />
          </div>

          {snapshot.categories.map((category) => (
            <CategoryBlock
              key={category.id}
              category={category}
              habits={snapshot.habits.filter((h) => h.categoryId === category.id)}
              days={days}
              now={now}
              columns={columns}
              stats={stats}
              onToggle={onToggle}
              onAdd={onAdd}
              onArchive={onArchive}
            />
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        Click a black dot on the day you did a habit and it fills with the habit&apos;s color. Click again to undo.
      </p>
    </div>
  )
}

function NavButton({ label, onClick, children }: { label: string; onClick(): void; children: string }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg border border-line text-lg leading-none text-ink-2 hover:bg-raised"
    >
      {children}
    </button>
  )
}

interface BlockProps extends Pick<Props, 'stats' | 'onToggle' | 'onAdd' | 'onArchive'> {
  category: Category
  habits: Habit[]
  days: string[]
  now: string
  columns: { gridTemplateColumns: string }
}

function CategoryBlock({ category, habits, days, now, columns, stats, onToggle, onAdd, onArchive }: BlockProps) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const first = days[0]
  const last = days[days.length - 1]
  const rate = stats.rate(habits, first, last)

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) return
    await onAdd(category.id, name)
    setName('')
    setAdding(false)
  }

  return (
    <section className="mt-3 border-t border-line pt-2">
      <div className="mb-1 flex h-7 items-center gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{category.name}</h2>
        {rate.scheduled > 0 && <span className="text-[11px] tabular-nums text-muted">{pct(rate)}% this month</span>}
        {adding ? (
          <form onSubmit={submit} className="flex items-center gap-1.5">
            <input
              autoFocus
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
              placeholder="New habit"
              className="h-6 w-40 rounded-md border border-line bg-raised px-2 text-xs outline-none focus:border-accent"
            />
            <button type="submit" className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-page">
              Add
            </button>
            <button type="button" onClick={() => setAdding(false)} className="px-1 text-xs text-muted hover:text-ink-2">
              Cancel
            </button>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className="text-[11px] text-muted hover:text-accent">
            + Add habit
          </button>
        )}
      </div>

      {habits.map((habit) => {
        const r = stats.rate([habit], first, last)
        return (
          <div key={habit.id} className="group grid items-center" style={columns}>
            <div className="flex min-w-0 items-center gap-2 pr-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: habit.color }} />
              <span className="truncate text-[13px] text-ink">{habit.name}</span>
              <button
                aria-label={`Remove ${habit.name}`}
                title="Remove habit (history is kept)"
                onClick={() => {
                  if (window.confirm(`Remove "${habit.name}" from the tracker? Its history stays in the database.`)) {
                    void onArchive(habit.id)
                  }
                }}
                className="ml-auto hidden text-sm leading-none text-muted hover:text-red-600 group-hover:block"
              >
                ×
              </button>
            </div>
            {days.map((d) => {
              const done = stats.isDone(habit.id, d)
              const future = d > now
              return (
                <div key={d} className={`grid h-[30px] place-items-center ${d === now ? 'bg-accent/10' : ''}`}>
                  <button
                    disabled={future}
                    aria-pressed={done}
                    aria-label={`${habit.name}, ${formatDay(d)}`}
                    title={`${habit.name} · ${formatDay(d)}`}
                    onClick={() => onToggle(habit.id, d)}
                    className={`size-[18px] rounded-full transition-transform ${
                      done ? 'dot-done' : future ? 'bg-black/10' : 'bg-zinc-900 hover:scale-125'
                    }`}
                    style={done ? { background: habit.color, boxShadow: `0 0 10px ${habit.color}80` } : undefined}
                  />
                </div>
              )
            })}
            <span className="text-right text-[11px] tabular-nums text-muted">
              {r.scheduled > 0 ? `${r.done}/${r.scheduled}` : '–'}
            </span>
          </div>
        )
      })}
    </section>
  )
}
