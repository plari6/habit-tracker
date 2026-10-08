import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, CoachResult, CoachStatus, Evaluation } from '@shared/types'

export interface Pending {
  kind: 'chat' | 'evaluation'
  requestId: string
  /** Reply text streamed so far. */
  text: string
  userText?: string
  weekStart?: string
}

export interface CoachState {
  /** False until the saved chat, evaluations and key status have loaded. */
  ready: boolean
  status: CoachStatus
  messages: ChatMessage[]
  evaluations: Evaluation[]
  pending: Pending | null
  error: string | null
  send(text: string): Promise<boolean>
  generate(weekStart: string): Promise<boolean>
  clearChat(): Promise<void>
  setKey(key: string): Promise<void>
  clearKey(): Promise<void>
}

export function useCoach(): CoachState {
  const [status, setStatus] = useState<CoachStatus>({ hasKey: false, source: null })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const busy = useRef(false)

  useEffect(() => {
    void Promise.all([
      window.api.getCoachStatus().then(setStatus),
      window.api.getChat().then(setMessages),
      window.api.getEvaluations().then(setEvaluations)
    ]).then(() => setReady(true))
    return window.api.onCoachDelta(({ requestId, delta }) =>
      setPending((p) => (p && p.requestId === requestId ? { ...p, text: p.text + delta } : p))
    )
  }, [])

  // One request at a time: both kinds stream into the same pending slot.
  const run = useCallback(
    async (
      start: Omit<Pending, 'requestId' | 'text'>,
      call: (requestId: string) => Promise<CoachResult>
    ): Promise<boolean> => {
      if (busy.current) return false
      busy.current = true
      const requestId = crypto.randomUUID()
      setError(null)
      setPending({ ...start, requestId, text: '' })
      try {
        const result = await call(requestId)
        if (!result.ok) setError(result.error)
        return result.ok
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        return false
      } finally {
        busy.current = false
        setPending(null)
      }
    },
    []
  )

  const send = useCallback(
    async (text: string) => {
      const ok = await run({ kind: 'chat', userText: text }, (id) => window.api.sendChat(id, text))
      if (ok) setMessages(await window.api.getChat())
      return ok
    },
    [run]
  )

  const generate = useCallback(
    async (weekStart: string) => {
      const ok = await run({ kind: 'evaluation', weekStart }, (id) => window.api.generateEvaluation(id, weekStart))
      if (ok) setEvaluations(await window.api.getEvaluations())
      return ok
    },
    [run]
  )

  const saveKey = async (action: Promise<CoachStatus>): Promise<void> => {
    try {
      setStatus(await action)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return {
    ready,
    status,
    messages,
    evaluations,
    pending,
    error,
    send,
    generate,
    clearChat: async () => {
      await window.api.clearChat()
      setMessages([])
    },
    setKey: (key) => saveKey(window.api.setApiKey(key)),
    clearKey: () => saveKey(window.api.clearApiKey())
  }
}
