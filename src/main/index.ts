import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import type { CoachDelta } from '@shared/types'
import { Coach } from './coach'
import { HabitDb } from './db'
import { Secrets } from './secrets'

// Everything the app stores stays on this machine: next to the project while
// developing, in the per-user app folder once packaged.
const dataDir = app.isPackaged ? join(app.getPath('userData'), 'data') : join(app.getAppPath(), 'data')

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function assertDate(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) throw new Error('Invalid date')
}

function assertId(value: unknown): asserts value is number {
  if (!Number.isInteger(value)) throw new Error('Invalid id')
}

function registerIpc(db: HabitDb, secrets: Secrets, coach: Coach): void {
  ipcMain.handle('snapshot', () => db.snapshot())
  ipcMain.handle('log:toggle', (_e, habitId: unknown, date: unknown) => {
    assertId(habitId)
    assertDate(date)
    return db.toggleLog(habitId, date)
  })
  ipcMain.handle('habit:add', (_e, categoryId: unknown, name: unknown) => {
    assertId(categoryId)
    const trimmed = typeof name === 'string' ? name.trim().slice(0, 40) : ''
    if (!trimmed) throw new Error('Habit name is required')
    db.addHabit(categoryId, trimmed)
  })
  ipcMain.handle('habit:archive', (_e, habitId: unknown) => {
    assertId(habitId)
    db.archiveHabit(habitId)
  })

  const deltas =
    (sender: Electron.WebContents, requestId: string) =>
    (delta: string): void => {
      if (!sender.isDestroyed()) sender.send('coach:delta', { requestId, delta } satisfies CoachDelta)
    }

  ipcMain.handle('chat:list', () => db.chat())
  ipcMain.handle('chat:clear', () => db.clearChat())
  ipcMain.handle('chat:send', (e, requestId: unknown, text: unknown) => {
    if (typeof requestId !== 'string' || typeof text !== 'string' || !text.trim()) {
      throw new Error('Invalid message')
    }
    return coach.chat(text.trim(), deltas(e.sender, requestId))
  })
  ipcMain.handle('evaluation:list', () => db.evaluations())
  ipcMain.handle('evaluation:generate', (e, requestId: unknown, weekStart: unknown) => {
    if (typeof requestId !== 'string') throw new Error('Invalid request')
    assertDate(weekStart)
    return coach.evaluate(weekStart, deltas(e.sender, requestId))
  })

  ipcMain.handle('coach:status', () => secrets.status())
  ipcMain.handle('coach:setKey', (_e, key: unknown) => {
    if (typeof key !== 'string' || !key.trim()) throw new Error('API key is required')
    secrets.setApiKey(key.trim())
    return secrets.status()
  })
  ipcMain.handle('coach:clearKey', () => {
    secrets.clearApiKey()
    return secrets.status()
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1100,
    minHeight: 680,
    show: false,
    backgroundColor: '#0b0f0e',
    autoHideMenuBar: true,
    title: 'Habit Tracker',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.once('ready-to-show', () => win.show())

  // The window only ever shows the app itself; links open in the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e) => e.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  void app.whenReady().then(() => {
    const db = new HabitDb(dataDir)
    db.backup()
    const secrets = new Secrets(dataDir)
    registerIpc(db, secrets, new Coach(db, secrets))
    createWindow()
    app.on('will-quit', () => db.close())
  })

  app.on('window-all-closed', () => app.quit())
}
