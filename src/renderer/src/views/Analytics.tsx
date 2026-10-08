import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { addDays, dayRange, formatDay, today } from '@shared/dates'
import { pct, type Rate, type Stats } from '@shared/stats'
import type { Snapshot } from '@shared/types'

interface Props {
  snapshot: Snapshot
  stats: Stats
}

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' }
]

// One chart color per area, in category order.
const AREA_COLORS = ['var(--color-work)', 'var(--color-life)', 'var(--color-hygiene)']
const areaColor = (index: number): string => AREA_COLORS[index % AREA_COLORS.length]

export default function Analytics({ snapshot, stats }: Props) {
  const [range, setRange] = useState(30)
  const now = today()
  const from = addDays(now, -(range - 1))

  const overall = stats.rate(snapshot.habits, from, now)
  const previous = stats.rate(snapshot.habits, addDays(from, -range), addDays(from, -1))
  const change = previous.scheduled > 0 ? pct(overall) - pct(previous) : null

  const todayRate = stats.rate(snapshot.habits, now, now)
  const streaks = snapshot.habits.map((habit) => ({ habit, ...stats.streak(habit) }))
  const best = streaks.reduce<(typeof streaks)[number] | null>((a, b) => (a && a.current >= b.current ? a : b), null)

  const daily = useMemo(
    () =>
      dayRange(from, now)
        .map((date) => ({ date, rate: stats.rate(snapshot.habits, date, date) }))
        .filter((d) => d.rate.scheduled > 0),
    [snapshot, stats, from, now]
  )

  const areas = snapshot.categories.map((category, index) => ({
    category,
    color: areaColor(index),
    rate: stats.rate(
      snapshot.habits.filter((h) => h.categoryId === category.id),
      from,
      now
    )
  }))

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-6">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Analytics</p>
          <h1 className="text-2xl font-semibold">Your performance</h1>
        </div>
        <div className="flex rounded-lg border border-line bg-surface p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRange(r.days)}
              className={`rounded-md px-3 py-1.5 text-xs ${
                range === r.days ? 'bg-accent/15 font-medium text-accent' : 'text-ink-2 hover:text-ink'
              }`}
            >
              Last {r.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Tile label="Completion rate" value={`${pct(overall)}%`}>
          {change === null ? (
            `${overall.done} of ${overall.scheduled} check-ins`
          ) : (
            <span>
              <span className={change >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {change >= 0 ? '▲' : '▼'} {Math.abs(change)} pts
              </span>{' '}
              vs previous {range} days
            </span>
          )}
        </Tile>
        <Tile label="Done today" value={`${todayRate.done} / ${snapshot.habits.length}`}>
          {todayRate.done === snapshot.habits.length ? 'Everything ticked' : 'Still open today'}
        </Tile>
        <Tile label="Best current streak" value={best && best.current > 0 ? `${best.current} days` : '–'}>
          {best && best.current > 0 ? best.habit.name : 'No active streak yet'}
        </Tile>
        <Tile label="Check-ins" value={overall.done.toLocaleString('en-US')}>
          In the last {range} days
        </Tile>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Card title="Daily completion" subtitle="Share of habits done each day. Today is still in progress." span>
          {daily.length > 0 ? <LineChart points={daily} /> : <Empty />}
        </Card>
        <Card title="By area" subtitle={`Completion over the last ${range} days.`}>
          <div className="mt-4 space-y-5">
            {areas.map(({ category, color, rate }) => (
              <div key={category.id} title={`${category.name}: ${rate.done} of ${rate.scheduled} check-ins`}>
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span className="text-ink-2">{category.name}</span>
                  <span className="font-semibold tabular-nums">{pct(rate)}%</span>
                </div>
                <Bar value={pct(rate)} color={color} height={12} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Habits" subtitle={`Completion over the last ${range} days, with streaks as of today.`} className="mt-4">
        <div className="mb-2 mt-3 flex gap-4 text-xs text-ink-2">
          {areas.map(({ category, color }) => (
            <span key={category.id} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: color }} />
              {category.name}
            </span>
          ))}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="py-2 font-medium">Habit</th>
              <th className="w-[38%] py-2 font-medium">Completion</th>
              <th className="py-2 text-right font-medium">Done</th>
              <th className="py-2 text-right font-medium">Current streak</th>
              <th className="py-2 text-right font-medium">Longest streak</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.categories.flatMap((category, index) =>
              streaks
                .filter((s) => s.habit.categoryId === category.id)
                .map(({ habit, current, longest }) => {
                  const rate = stats.rate([habit], from, now)
                  return (
                    <tr key={habit.id} className="border-b border-line/60 last:border-0">
                      <td className="py-2.5">
                        <span className="text-ink">{habit.name}</span>
                        <span className="ml-2 text-xs text-muted">{category.name}</span>
                      </td>
                      <td className="py-2.5 pr-6">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <Bar value={pct(rate)} color={areaColor(index)} height={8} />
                          </div>
                          <span className="w-10 text-right tabular-nums text-ink-2">{pct(rate)}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-ink-2">
                        {rate.done}/{rate.scheduled}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-ink-2">{current} d</td>
                      <td className="py-2.5 text-right tabular-nums text-ink-2">{longest} d</td>
                    </tr>
                  )
                })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function Tile({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      <p className="mt-1 truncate text-xs text-ink-2">{children}</p>
    </div>
  )
}

function Card(props: { title: string; subtitle: string; span?: boolean; className?: string; children: ReactNode }) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface p-5 ${props.span ? 'col-span-2' : ''} ${props.className ?? ''}`}
    >
      <h2 className="text-sm font-semibold">{props.title}</h2>
      <p className="text-xs text-muted">{props.subtitle}</p>
      {props.children}
    </section>
  )
}

function Empty() {
  return <p className="grid h-[220px] place-items-center text-sm text-muted">Nothing tracked in this period yet.</p>
}

function Bar({ value, color, height }: { value: number; color: string; height: number }) {
  return (
    <div className="rounded-r bg-raised" style={{ height }}>
      <div className="h-full rounded-r" style={{ width: `${value}%`, background: color }} />
    </div>
  )
}

const CHART_HEIGHT = 220
const PAD = { top: 16, right: 44, bottom: 24, left: 34 }

function LineChart({ points }: { points: { date: string; rate: Rate }[] }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const innerW = width - PAD.left - PAD.right
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom
  const x = (i: number): number => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (value: number): number => PAD.top + (1 - value / 100) * innerH
  const values = points.map((p) => pct(p.rate))
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = points.length - 1
  const labelEvery = Math.max(1, Math.ceil(points.length / 7))
  const active = hover !== null && hover <= last ? hover : null

  return (
    <div
      ref={wrap}
      className="relative mt-3"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const left = e.clientX - e.currentTarget.getBoundingClientRect().left
        const ratio = innerW > 0 ? (left - PAD.left) / innerW : 0
        setHover(Math.min(last, Math.max(0, Math.round(ratio * last))))
      }}
    >
      <svg width={width} height={CHART_HEIGHT} role="img" aria-label="Daily completion rate">
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={tick === 0 ? '#3a4541' : 'var(--color-line)'}
            />
            <text x={PAD.left - 8} y={y(tick) + 3.5} textAnchor="end" fontSize="10" fill="var(--color-muted)">
              {tick}%
            </text>
          </g>
        ))}
        {points.map(
          (p, i) =>
            (last - i) % labelEvery === 0 && (
              <text key={p.date} x={x(i)} y={CHART_HEIGHT - 6} textAnchor="middle" fontSize="10" fill="var(--color-muted)">
                {formatDay(p.date)}
              </text>
            )
        )}
        {points.length > 1 && (
          <path
            d={`${line} L${x(last).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`}
            fill="var(--color-accent)"
            opacity="0.1"
          />
        )}
        <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {active !== null && (
          <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={y(0)} stroke="var(--color-muted)" strokeWidth="1" />
        )}
        {[...new Set([last, ...(active === null ? [] : [active])])].map((i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(values[i])}
            r="5"
            fill="var(--color-accent)"
            stroke="var(--color-surface)"
            strokeWidth="2"
          />
        ))}
        {active === null && (
          <text x={x(last) + 10} y={y(values[last]) + 4} fontSize="12" fontWeight="600" fill="var(--color-ink)">
            {values[last]}%
          </text>
        )}
      </svg>
      {active !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-line bg-raised px-3 py-2 text-xs shadow-lg"
          style={x(active) > width / 2 ? { right: width - x(active) + 12 } : { left: x(active) + 12 }}
        >
          <p className="text-muted">{formatDay(points[active].date, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
          <p className="mt-0.5 whitespace-nowrap">
            <span className="text-sm font-semibold">{values[active]}%</span>
            <span className="ml-2 text-ink-2">
              {points[active].rate.done} of {points[active].rate.scheduled} habits
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
