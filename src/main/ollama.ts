import { ipcMain } from 'electron'

export interface OllamaListResult {
  ok: boolean
  models: string[]
  error?: string
}

export function registerOllamaIpc(): void {
  ipcMain.handle('ollama:list', async (_e, endpoint: string): Promise<OllamaListResult> => {
    try {
      const base = (endpoint || 'http://localhost:11434').replace(/\/+$/, '')
      const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { models?: { name: string }[] }
      return { ok: true, models: (data.models ?? []).map((m) => m.name) }
    } catch (e) {
      return {
        ok: false,
        models: [],
        error: e instanceof Error ? e.message : String(e)
      }
    }
  })
}
