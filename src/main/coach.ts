import Anthropic from '@anthropic-ai/sdk'
import { addDays, dayRange, formatDay, formatWeek, today } from '@shared/dates'
import { createStats, pct } from '@shared/stats'
import type { CoachResult, Snapshot } from '@shared/types'
import type { HabitDb } from './db'
import type { Secrets } from './secrets'

const MODEL = 'claude-opus-5-5'
const HISTORY_LIMIT = 30

const SYSTEM = `You are the performance coach inside a personal habit tracker desktop app. The user tracks daily habits in three areas — Work, Life and Hygiene — by ticking a dot for each day a habit is done. You talk with them about how they are doing and help them improve.

A report of their tracking data follows this message; it is regenerated on every turn, so it is always current. Base every claim about their performance on that report and quote the actual numbers. If they ask about something the report does not cover, say so rather than guessing.

How to coach:
- Be direct and warm, like a training partner who has seen the numbers. Avoid a clinical or corporate tone.
- Name what is going well before what is slipping, and be specific about both.
- When a habit is being skipped, suggest a small concrete change (a time, a trigger, a smaller version of the habit) rather than general motivation.
- A habit added only a few days ago has little data; say that instead of over-reading it.
- Keep chat replies short — a few sentences or a short list — unless they ask for depth.

Formatting: the app renders only paragraphs, short "## " headings, "- " bullets and **bold**. Do not use tables, code blocks or links.`

const EVALUATION_REQUEST = (week: string): string =>
  `Write my weekly evaluation for ${week}. Structure it as:

## Summary
The overall completion rate for the week with the done/scheduled counts, how it compares with the week before, and a one-line verdict.

## By area
One line each for Work, Life and Hygiene.

## Highlights
The habit with the highest streak, and the habit skipped most often.

## Next week
Exactly two actionable coaching tips aimed at the habits I skipped most.`

/** Plain-text table of the tracking data for an inclusive date range. */
function report(snapshot: Snapshot, from: string, to: string, now: string): string {
  const stats = createStats(snapshot, now)
  const end = to > now ? now : to
  const days = dayRange(from, end)
  const overall = stats.rate(snapshot.habits, from, end)
  const lines = [
    `Period: ${formatDay(from)} to ${formatDay(end)} (${days.length} days). Overall: ${pct(overall)}% (${overall.done}/${overall.scheduled}).`
  ]
  for (const category of snapshot.categories) {
    const habits = snapshot.habits.filter((h) => h.categoryId === category.id)
    const rate = stats.rate(habits, from, end)
    lines.push(`${category.name}: ${pct(rate)}% (${rate.done}/${rate.scheduled})`)
    for (const habit of habits) {
      const marks = days
        .map((d) => (stats.isDone(habit.id, d) ? 'x' : stats.isScheduled(habit, d) ? '.' : '-'))
        .join('')
      const r = stats.rate([habit], from, end)
      const { current, longest } = stats.streak(habit)
      lines.push(
        `  - ${habit.name}: ${marks} ${r.done}/${r.scheduled}, current streak ${current}d, longest ${longest}d`
      )
    }
  }
  return lines.join('\n')
}

const LEGEND =
  'Every habit is scheduled daily. Day marks run oldest to newest: x = done, . = missed, - = not tracked yet. Streaks are as of today.'

function chatContext(snapshot: Snapshot, now: string): string {
  const weekday = formatDay(now, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return [
    `Tracking report. Today is ${weekday}; today's habits may still get ticked later.`,
    LEGEND,
    '',
    'Last 7 days:',
    report(snapshot, addDays(now, -6), now, now),
    '',
    'Last 30 days:',
    report(snapshot, addDays(now, -29), now, now)
  ].join('\n')
}

function evaluationContext(snapshot: Snapshot, weekStart: string, now: string): string {
  return [
    `Tracking report for the week being evaluated (${formatWeek(weekStart)}).`,
    LEGEND,
    '',
    'Week being evaluated:',
    report(snapshot, weekStart, addDays(weekStart, 6), now),
    '',
    'Week before:',
    report(snapshot, addDays(weekStart, -7), addDays(weekStart, -1), now)
  ].join('\n')
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'The API key was rejected. Check it under "API key" and try again.'
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return 'This API key is not allowed to use the coach model.'
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Rate limited by the API. Wait a moment and try again.'
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Could not reach the API. Check your internet connection.'
  }
  if (error instanceof Anthropic.APIError) {
    return `The API returned an error (${error.status ?? 'unknown'}): ${error.message}`
  }
  return error instanceof Error ? error.message : String(error)
}

export class Coach {
  constructor(
    private db: HabitDb,
    private secrets: Secrets
  ) {}

  private async run(
    context: string,
    messages: Anthropic.Beta.BetaMessageParam[],
    onDelta: (delta: string) => void
  ): Promise<CoachResult> {
    if (!this.secrets.status().hasKey) {
      return { ok: false, error: 'Add your Anthropic API key under "API key" to use the coach.' }
    }
    try {
      const apiKey = this.secrets.apiKey()
      // Without a stored key the SDK falls back to ANTHROPIC_API_KEY.
      const client = apiKey ? new Anthropic({ apiKey }) : new Anthropic()
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        output_config: { effort: 'medium' },
        // If the model declines a request, the API retries it on a fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [
          { type: 'text', text: SYSTEM },
          { type: 'text', text: context }
        ],
        messages
      })
      stream.on('text', onDelta)
      const message = await stream.finalMessage()
      if (message.stop_reason === 'refusal') {
        return { ok: false, error: 'The coach declined to answer that. Try rephrasing.' }
      }
      const text = message.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('')
        .trim()
      if (!text) return { ok: false, error: 'The coach returned an empty reply. Try again.' }
      return { ok: true, text }
    } catch (error) {
      return { ok: false, error: describeError(error) }
    }
  }

  async chat(text: string, onDelta: (delta: string) => void): Promise<CoachResult> {
    const history = this.db.chat().slice(-HISTORY_LIMIT)
    while (history.length > 0 && history[0].role !== 'user') history.shift()
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      ...history.map(({ role, content }) => ({ role, content })),
      { role: 'user', content: text }
    ]
    const result = await this.run(chatContext(this.db.snapshot(), today()), messages, onDelta)
    if (result.ok) {
      this.db.addChat('user', text)
      this.db.addChat('assistant', result.text)
    }
    return result
  }

  async evaluate(weekStart: string, onDelta: (delta: string) => void): Promise<CoachResult> {
    const result = await this.run(
      evaluationContext(this.db.snapshot(), weekStart, today()),
      [{ role: 'user', content: EVALUATION_REQUEST(formatWeek(weekStart)) }],
      onDelta
    )
    if (result.ok) this.db.saveEvaluation(weekStart, result.text)
    return result
  }
}
