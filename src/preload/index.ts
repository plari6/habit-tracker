import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { Api, CoachDelta } from '@shared/types'

const api: Api = {
  getSnapshot: () => ipcRenderer.invoke('snapshot'),
  toggleLog: (habitId, date) => ipcRenderer.invoke('log:toggle', habitId, date),
  addHabit: (categoryId, name) => ipcRenderer.invoke('habit:add', categoryId, name),
  archiveHabit: (habitId) => ipcRenderer.invoke('habit:archive', habitId),

  getChat: () => ipcRenderer.invoke('chat:list'),
  clearChat: () => ipcRenderer.invoke('chat:clear'),
  sendChat: (requestId, text) => ipcRenderer.invoke('chat:send', requestId, text),
  getEvaluations: () => ipcRenderer.invoke('evaluation:list'),
  generateEvaluation: (requestId, weekStart) => ipcRenderer.invoke('evaluation:generate', requestId, weekStart),
  onCoachDelta: (listener) => {
    const handler = (_e: IpcRendererEvent, delta: CoachDelta): void => listener(delta)
    ipcRenderer.on('coach:delta', handler)
    return () => ipcRenderer.removeListener('coach:delta', handler)
  },

  getCoachStatus: () => ipcRenderer.invoke('coach:status'),
  setApiKey: (key) => ipcRenderer.invoke('coach:setKey', key),
  clearApiKey: () => ipcRenderer.invoke('coach:clearKey')
}

contextBridge.exposeInMainWorld('api', api)
