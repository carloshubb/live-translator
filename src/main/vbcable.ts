import { app, ipcMain } from 'electron'
import { spawn } from 'child_process'
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

// VB-Audio rasmiy yuklab olish manzili (donationware; saytdan yuklashga yo'naltirish erkin)
const VBCABLE_URL = 'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack45.zip'

export interface VbCableInstallResult {
  ok: boolean
  step: 'download' | 'extract' | 'launch' | 'done'
  error?: string
}

/**
 * VB-Cable o'rnatish oqimi: zip'ni yuklab oladi, ochadi va setup'ni
 * administrator sifatida ishga tushiradi (drayver uchun UAC majburiy).
 * O'rnatish tugagach foydalanuvchi qurilmalar ro'yxatini yangilaydi.
 */
export function registerVbCableIpc(): void {
  ipcMain.handle('vbcable:install', async (): Promise<VbCableInstallResult> => {
    const dir = join(app.getPath('temp'), 'tilmoch-vbcable')
    const zipPath = join(dir, 'vbcable.zip')
    const extractDir = join(dir, 'extracted')

    try {
      mkdirSync(dir, { recursive: true })

      // 1) Yuklab olish
      const res = await fetch(VBCABLE_URL)
      if (!res.ok || !res.body) {
        return { ok: false, step: 'download', error: `HTTP ${res.status}` }
      }
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(zipPath))

      // 2) Ochish (Windows'da o'rnatilgan tar zip'ni ham ochadi)
      mkdirSync(extractDir, { recursive: true })
      await new Promise<void>((resolve, reject) => {
        const p = spawn('tar', ['-xf', zipPath, '-C', extractDir], { windowsHide: true })
        p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`tar exit ${code}`))))
        p.on('error', reject)
      })

      const setup = join(extractDir, 'VBCABLE_Setup_x64.exe')
      if (!existsSync(setup)) {
        return { ok: false, step: 'extract', error: 'VBCABLE_Setup_x64.exe topilmadi' }
      }

      // 3) Administrator sifatida ishga tushirish (UAC oynasi chiqadi)
      await new Promise<void>((resolve, reject) => {
        const p = spawn(
          'powershell',
          ['-NoProfile', '-Command', `Start-Process -FilePath '${setup}' -Verb RunAs -Wait`],
          { windowsHide: true }
        )
        p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`UAC rad etildi yoki setup xatosi (${code})`))))
        p.on('error', reject)
      })

      return { ok: true, step: 'done' }
    } catch (e) {
      return {
        ok: false,
        step: 'launch',
        error: e instanceof Error ? e.message : String(e)
      }
    }
  })
}
