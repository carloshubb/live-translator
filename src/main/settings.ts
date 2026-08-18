import { app, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { AppSettings, DEFAULT_SETTINGS } from '../shared/settings'

const settingsFile = (): string => join(app.getPath('userData'), 'settings.json')

export function loadSettings(): AppSettings {
  try {
    if (existsSync(settingsFile())) {
      const raw = JSON.parse(readFileSync(settingsFile(), 'utf-8'))
      // Per-stage merge so new fields added in updates get their defaults.
      return {
        ...DEFAULT_SETTINGS,
        ...raw,
        stt: { ...DEFAULT_SETTINGS.stt, ...raw.stt },
        translate: { ...DEFAULT_SETTINGS.translate, ...raw.translate },
        tts: { ...DEFAULT_SETTINGS.tts, ...raw.tts },
        meeting: { ...DEFAULT_SETTINGS.meeting, ...raw.meeting }
      }
    }
  } catch (e) {
    console.error('Failed to load settings, using defaults:', e)
  }
  return DEFAULT_SETTINGS
}

export function saveSettings(settings: AppSettings): void {
  writeFileSync(settingsFile(), JSON.stringify(settings, null, 2), 'utf-8')
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...loadSettings(), ...patch }
  saveSettings(next)
  return next
}

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', () => loadSettings())
  ipcMain.handle('settings:save', (_e, settings: AppSettings) => saveSettings(settings))
}
