import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AppSettings } from '../shared/settings'

// Custom APIs for renderer
const api = {
  enableLoopbackAudio: (): Promise<void> => ipcRenderer.invoke('enable-loopback-audio'),
  disableLoopbackAudio: (): Promise<void> => ipcRenderer.invoke('disable-loopback-audio'),

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: AppSettings): Promise<void> =>
    ipcRenderer.invoke('settings:save', settings),

  listOllamaModels: (
    endpoint: string
  ): Promise<{ ok: boolean; models: string[]; error?: string }> =>
    ipcRenderer.invoke('ollama:list', endpoint),

  translate: (
    text: string,
    targetLang?: string
  ): Promise<{ ok: boolean; text: string; error?: string }> =>
    ipcRenderer.invoke('translate:text', text, targetLang),

  listTtsVoices: (): Promise<{ name: string; locale: string; gender: string }[]> =>
    ipcRenderer.invoke('tts:voices'),
  speak: (text: string, voice: string): Promise<Uint8Array> =>
    ipcRenderer.invoke('tts:speak', text, voice),

  installVbCable: (): Promise<{ ok: boolean; step: string; error?: string }> =>
    ipcRenderer.invoke('vbcable:install'),

  toggleOverlay: (): Promise<boolean> => ipcRenderer.invoke('overlay:toggle'),
  isOverlayOpen: (): Promise<boolean> => ipcRenderer.invoke('overlay:is-open'),
  sendOverlayLine: (line: { id: number; src: string; dst: string | null }): void =>
    ipcRenderer.send('overlay:line', line),
  closeOverlay: (): void => ipcRenderer.send('overlay:close'),
  onOverlayLine: (cb: (line: { id: number; src: string; dst: string | null }) => void): void => {
    ipcRenderer.on('overlay:line', (_e, line) => cb(line))
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
