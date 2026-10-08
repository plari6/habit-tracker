export interface Category {
  id: number
  name: string
  sort: number
}

export interface Habit {
  id: number
  categoryId: number
  name: string
  color: string
  sort: number
  /** Local date (YYYY-MM-DD) the habit was added. */
  createdOn: string
}

export interface Log {
  habitId: number
  date: string
}

export interface Snapshot {
  categories: Category[]
  habits: Habit[]
  logs: Log[]
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface Evaluation {
  weekStart: string
  content: string
  createdAt: string
}

export interface CoachStatus {
  hasKey: boolean
  /** Where the key comes from; `env` means GEMINI_API_KEY. */
  source: 'stored' | 'env' | null
}

export type CoachResult = { ok: true; text: string } | { ok: false; error: string }

export interface CoachDelta {
  requestId: string
  delta: string
}

export interface Api {
  getSnapshot(): Promise<Snapshot>
  toggleLog(habitId: number, date: string): Promise<boolean>
  addHabit(categoryId: number, name: string): Promise<void>
  archiveHabit(habitId: number): Promise<void>

  getChat(): Promise<ChatMessage[]>
  clearChat(): Promise<void>
  sendChat(requestId: string, text: string): Promise<CoachResult>
  getEvaluations(): Promise<Evaluation[]>
  generateEvaluation(requestId: string, weekStart: string): Promise<CoachResult>
  onCoachDelta(listener: (delta: CoachDelta) => void): () => void

  getCoachStatus(): Promise<CoachStatus>
  setApiKey(key: string): Promise<CoachStatus>
  clearApiKey(): Promise<CoachStatus>
}
