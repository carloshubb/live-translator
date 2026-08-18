import { ElectronAPI } from '@electron-toolkit/preload'
import type { AppSettings } from '../shared/settings'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      enableLoopbackAudio: () => Promise<void>
      disableLoopbackAudio: () => Promise<void>
      getSettings: () => Promise<AppSettings>
      saveSettings: (settings: AppSettings) => Promise<void>
      listOllamaModels: (
        endpoint: string
      ) => Promise<{ ok: boolean; models: string[]; error?: string }>
      translate: (
        text: string,
        targetLang?: string
      ) => Promise<{ ok: boolean; text: string; error?: string }>
      listTtsVoices: () => Promise<{ name: string; locale: string; gender: string }[]>
      speak: (text: string, voice: string) => Promise<Uint8Array>
      installVbCable: () => Promise<{ ok: boolean; step: string; error?: string }>
      toggleOverlay: () => Promise<boolean>
      isOverlayOpen: () => Promise<boolean>
      sendOverlayLine: (line: { id: number; src: string; dst: string | null }) => void
      closeOverlay: () => void
      onOverlayLine: (cb: (line: { id: number; src: string; dst: string | null }) => void) => void
    }
  }
}
