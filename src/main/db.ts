import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { today } from '@shared/dates'
import type { ChatMessage, Evaluation, Snapshot } from '@shared/types'

const SEED: { category: string; habits: [name: string, color: string][] }[] = [
  {
    category: 'Work',
    habits: [
      ['Trading', '#38bdf8'],
      ['Economics', '#818cf8'],
      ['Claude coding', '#c084fc']
    ]
  },
  {
    category: 'Life',
    habits: [
      ['Stretching', '#34d399'],
      ['Reading', '#fbbf24'],
      ['Calisthenics', '#fb7185'],
      ['Meditation', '#2dd4bf']
    ]
  },
  {
    category: 'Hygiene',
    habits: [
      ['Shower', '#60a5fa'],
      ['Teeth brushing', '#f472b6']
    ]
  }
]

// Colors handed to habits added later, in order.
const EXTRA_COLORS = ['#a3e635', '#fb923c', '#e879f9', '#22d3ee', '#facc15', '#f87171', '#a78bfa', '#4ade80']

const KEEP_BACKUPS = 7

export class HabitDb {
  private db: DatabaseSync

  constructor(private dataDir: string) {
    mkdirSync(dataDir, { recursive: true })
    this.db = new DatabaseSync(join(dataDir, 'habits.db'))
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        sort INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS habits (
        id INTEGER PRIMARY KEY,
        category_id INTEGER NOT NULL REFERENCES categories(id),
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        sort INTEGER NOT NULL,
        created_on TEXT NOT NULL,
        archived_on TEXT
      );
      CREATE TABLE IF NOT EXISTS logs (
        habit_id INTEGER NOT NULL REFERENCES habits(id),
        date TEXT NOT NULL,
        PRIMARY KEY (habit_id, date)
      ) WITHOUT ROWID;
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS evaluations (
        week_start TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `)
    this.seed()
    this.migrate()
  }

  private seed(): void {
    const { n } = this.db.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number }
    if (n > 0) return
    const addCategory = this.db.prepare('INSERT INTO categories (name, sort) VALUES (?, ?)')
    const addHabit = this.db.prepare(
      'INSERT INTO habits (category_id, name, color, sort, created_on) VALUES (?, ?, ?, ?, ?)'
    )
    const createdOn = today()
    SEED.forEach(({ category, habits }, ci) => {
      const categoryId = addCategory.run(category, ci).lastInsertRowid
      habits.forEach(([name, color], hi) => addHabit.run(categoryId, name, color, hi, createdOn))
    })
  }

  /** One-off changes to databases created by earlier versions, tracked by user_version. */
  private migrate(): void {
    const { user_version: version } = this.db.prepare('PRAGMA user_version').get() as { user_version: number }
    if (version < 1) {
      this.ensureHabit('Work', 'Tape reading', '#22d3ee')
      this.ensureHabit('Work', 'Trade journaling', '#fb923c')
      this.db.exec('PRAGMA user_version = 1')
    }
  }

  private ensureHabit(categoryName: string, name: string, color: string): void {
    const category = this.db.prepare('SELECT id FROM categories WHERE name = ?').get(categoryName) as
      | { id: number }
      | undefined
    if (!category) return
    const existing = this.db.prepare('SELECT 1 FROM habits WHERE category_id = ? AND name = ?').get(category.id, name)
    if (existing) return
    const { sort } = this.db
      .prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS sort FROM habits WHERE category_id = ?')
      .get(category.id) as { sort: number }
    this.db
      .prepare('INSERT INTO habits (category_id, name, color, sort, created_on) VALUES (?, ?, ?, ?, ?)')
      .run(category.id, name, color, sort, today())
  }

  /** One consistent copy of the database per day, keeping the most recent few. */
  backup(): void {
    const dir = join(this.dataDir, 'backups')
    mkdirSync(dir, { recursive: true })
    const target = join(dir, `habits-${today()}.db`)
    if (!existsSync(target)) this.db.prepare('VACUUM INTO ?').run(target)
    const old = readdirSync(dir)
      .filter((f) => /^habits-\d{4}-\d{2}-\d{2}\.db$/.test(f))
      .sort()
      .slice(0, -KEEP_BACKUPS)
    for (const f of old) rmSync(join(dir, f))
  }

  snapshot(): Snapshot {
    return {
      categories: this.db.prepare('SELECT id, name, sort FROM categories ORDER BY sort').all(),
      habits: this.db
        .prepare(
          `SELECT id, category_id AS categoryId, name, color, sort, created_on AS createdOn
           FROM habits WHERE archived_on IS NULL ORDER BY category_id, sort, id`
        )
        .all(),
      logs: this.db
        .prepare(
          `SELECT habit_id AS habitId, date FROM logs
           WHERE habit_id IN (SELECT id FROM habits WHERE archived_on IS NULL)`
        )
        .all()
    } as unknown as Snapshot
  }

  /** Flips a day's check-in and returns the new state. */
  toggleLog(habitId: number, date: string): boolean {
    const removed = this.db.prepare('DELETE FROM logs WHERE habit_id = ? AND date = ?').run(habitId, date)
    if (removed.changes > 0) return false
    this.db.prepare('INSERT INTO logs (habit_id, date) VALUES (?, ?)').run(habitId, date)
    return true
  }

  addHabit(categoryId: number, name: string): void {
    const { n } = this.db.prepare('SELECT COUNT(*) AS n FROM habits').get() as { n: number }
    const { sort } = this.db
      .prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS sort FROM habits WHERE category_id = ?')
      .get(categoryId) as { sort: number }
    this.db
      .prepare('INSERT INTO habits (category_id, name, color, sort, created_on) VALUES (?, ?, ?, ?, ?)')
      .run(categoryId, name, EXTRA_COLORS[n % EXTRA_COLORS.length], sort, today())
  }

  /** Hides a habit while keeping its history on disk. */
  archiveHabit(habitId: number): void {
    this.db.prepare('UPDATE habits SET archived_on = ? WHERE id = ?').run(today(), habitId)
  }

  chat(): ChatMessage[] {
    return this.db
      .prepare('SELECT id, role, content, created_at AS createdAt FROM chat_messages ORDER BY id')
      .all() as unknown as ChatMessage[]
  }

  addChat(role: ChatMessage['role'], content: string): void {
    this.db.prepare('INSERT INTO chat_messages (role, content) VALUES (?, ?)').run(role, content)
  }

  clearChat(): void {
    this.db.exec('DELETE FROM chat_messages')
  }

  evaluations(): Evaluation[] {
    return this.db
      .prepare(
        'SELECT week_start AS weekStart, content, created_at AS createdAt FROM evaluations ORDER BY week_start DESC'
      )
      .all() as unknown as Evaluation[]
  }

  saveEvaluation(weekStart: string, content: string): void {
    this.db
      .prepare(
        `INSERT INTO evaluations (week_start, content) VALUES (?, ?)
         ON CONFLICT (week_start) DO UPDATE SET content = excluded.content, created_at = datetime('now')`
      )
      .run(weekStart, content)
  }

  close(): void {
    this.db.close()
  }
}
