import { useEffect, useRef, useState, type FormEvent } from 'react'
import { formatWeek } from '@shared/dates'
import { evaluationWeek } from '@shared/stats'
import Markdown from '../components/Markdown'
import type { CoachState } from '../useCoach'

const SUGGESTIONS = ['How was my week so far?', 'Which habit am I skipping most?', 'What should I focus on tomorrow?']

export default function Coach({ coach }: { coach: CoachState }) {
  return (
    <div className="mx-auto flex h-full max-w-[1400px] gap-4 px-8 py-6">
      <Chat coach={coach} />
      <aside className="flex w-[400px] shrink-0 flex-col gap-4">
        <Evaluations coach={coach} />
        <ApiKey coach={coach} />
      </aside>
    </div>
  )
}

function Chat({ coach }: { coach: CoachState }) {
  const [draft, setDraft] = useState('')
  const bottom = useRef<HTMLDivElement>(null)
  const pending = coach.pending?.kind === 'chat' ? coach.pending : null
  const busy = coach.pending !== null

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [coach.messages, pending?.text])

  const send = async (text: string): Promise<void> => {
    const trimmed = text.trim()
    if (!trimmed || busy || !coach.status.hasKey) return
    setDraft('')
    // Put the message back if it could not be delivered.
    if (!(await coach.send(trimmed))) setDraft(trimmed)
  }

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    void send(draft)
  }

  const empty = coach.messages.length === 0 && !pending

  return (
    <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Coach</p>
          <h1 className="text-lg font-semibold">Talk about your performance</h1>
        </div>
        {coach.messages.length > 0 && (
          <button
            disabled={busy}
            onClick={() => void coach.clearChat()}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-2 hover:bg-raised disabled:opacity-40"
          >
            Clear chat
          </button>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm">
        {empty && (
          <div className="grid h-full place-items-center">
            <div className="max-w-sm text-center">
              <p className="text-ink-2">
                Ask about your habits. The coach sees your check-ins for the last 30 days every time you write.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    disabled={!coach.status.hasKey || busy}
                    onClick={() => void send(s)}
                    className="rounded-xl border border-line px-3 py-2 text-ink-2 hover:border-accent/50 hover:text-ink disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {coach.messages.map((m) => (
          <Bubble key={m.id} role={m.role} text={m.content} />
        ))}
        {pending && (
          <>
            <Bubble role="user" text={pending.userText ?? ''} />
            {pending.text ? <Bubble role="assistant" text={pending.text} /> : <Thinking />}
          </>
        )}
        <div ref={bottom} />
      </div>

      {coach.error && (
        <p className="selectable mx-5 mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
          {coach.error}
        </p>
      )}

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-line p-3">
        <textarea
          value={draft}
          rows={1}
          disabled={!coach.status.hasKey}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send(draft)
            }
          }}
          placeholder={coach.status.hasKey ? 'Ask your coach…' : 'Add a Google AI Studio key on the right to start chatting'}
          className="selectable max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-line bg-raised px-3 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!draft.trim() || busy || !coach.status.hasKey}
          className="h-10 rounded-xl bg-accent px-4 text-sm font-medium text-page disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </section>
  )
}

function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  return role === 'user' ? (
    <div className="flex justify-end">
      <p className="selectable max-w-[75%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent/20 px-3.5 py-2 text-ink">
        {text}
      </p>
    </div>
  ) : (
    <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-raised px-3.5 py-2.5 text-ink-2">
      <Markdown text={text} />
    </div>
  )
}

function Thinking() {
  return <p className="animate-pulse px-1 text-xs text-muted">Coach is thinking…</p>
}

function Evaluations({ coach }: { coach: CoachState }) {
  const due = evaluationWeek()
  const [selected, setSelected] = useState<string | null>(null)
  const pending = coach.pending?.kind === 'evaluation' ? coach.pending : null
  const weeks = coach.evaluations.map((e) => e.weekStart)
  const week = pending?.weekStart ?? selected ?? weeks[0] ?? due
  const saved = coach.evaluations.find((e) => e.weekStart === week)
  const showing = pending ? pending.text : saved?.content
  const options = weeks.includes(due) ? weeks : [due, ...weeks]

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-line bg-surface">
      <header className="border-b border-line px-5 py-3">
        <h2 className="text-sm font-semibold">Weekly evaluation</h2>
        <p className="text-xs text-muted">Written at the end of each week, Monday to Sunday.</p>
        <div className="mt-3 flex items-center gap-2">
          <select
            value={week}
            disabled={pending !== null}
            onChange={(e) => setSelected(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-raised px-2 text-xs text-ink outline-none"
          >
            {options.map((w) => (
              <option key={w} value={w}>
                {formatWeek(w)}
              </option>
            ))}
          </select>
          <button
            disabled={coach.pending !== null || !coach.status.hasKey}
            onClick={() => void coach.generate(week)}
            className="h-8 rounded-lg bg-accent px-3 text-xs font-medium text-page disabled:opacity-40"
          >
            {pending ? 'Writing…' : saved ? 'Rewrite' : 'Generate'}
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-ink-2">
        {showing ? (
          <Markdown text={showing} />
        ) : pending ? (
          <Thinking />
        ) : (
          <p className="text-muted">
            No evaluation for this week yet.{' '}
            {coach.status.hasKey
              ? 'Generate one here, or it is written automatically once the week is over.'
              : 'Add an API key below to enable it.'}
          </p>
        )}
      </div>
    </section>
  )
}

function ApiKey({ coach }: { coach: CoachState }) {
  const [key, setKey] = useState('')
  const { hasKey, source } = coach.status

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!key.trim()) return
    await coach.setKey(key)
    setKey('')
  }

  return (
    <section className="rounded-2xl border border-line bg-surface px-5 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Google AI Studio API key</h2>
        <span className={`flex items-center gap-1.5 text-xs ${hasKey ? 'text-emerald-600' : 'text-muted'}`}>
          <span className={`size-1.5 rounded-full ${hasKey ? 'bg-emerald-600' : 'bg-muted'}`} />
          {source === 'stored' ? 'Saved, encrypted' : source === 'env' ? 'From GEMINI_API_KEY' : 'Not set'}
        </span>
      </div>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={source === 'stored' ? 'Replace key' : 'Paste your Gemini API key'}
          autoComplete="off"
          spellCheck={false}
          className="selectable h-8 min-w-0 flex-1 rounded-lg border border-line bg-raised px-2 text-xs outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          type="submit"
          disabled={!key.trim()}
          className="h-8 rounded-lg border border-line px-3 text-xs text-ink-2 hover:bg-raised disabled:opacity-40"
        >
          Save
        </button>
        {source === 'stored' && (
          <button
            type="button"
            onClick={() => void coach.clearKey()}
            className="h-8 rounded-lg px-2 text-xs text-muted hover:text-red-600"
          >
            Remove
          </button>
        )}
      </form>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Your habits stay in a local database. A summary of your check-ins is sent to Google's Gemini API only when you
        chat or generate an evaluation. The key is encrypted by Windows before it is saved.
      </p>
    </section>
  )
}
