import { app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'
import { createConnection } from 'net'

const STT_PORT = 8765
const RESPAWN_DELAY_MS = 3000

let proc: ChildProcess | null = null
let quitting = false

function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host: '127.0.0.1' })
    sock.once('connect', () => {
      sock.destroy()
      resolve(true)
    })
    sock.once('error', () => resolve(false))
    sock.setTimeout(1500, () => {
      sock.destroy()
      resolve(false)
    })
  })
}

function findPython(): { python: string; script: string; cwd: string } | null {
  // Dev: loyiha ildizidagi python/ papkasi. Packaged: resources yonida (installer bosqichida hal qilinadi).
  const candidates = [
    join(app.getAppPath(), 'python'),
    join(process.resourcesPath ?? '', 'python')
  ]
  for (const dir of candidates) {
    const python =
      process.platform === 'win32'
        ? join(dir, '.venv', 'Scripts', 'python.exe')
        : join(dir, '.venv', 'bin', 'python')
    const script = join(dir, 'stt_server.py')
    if (existsSync(python) && existsSync(script)) return { python, script, cwd: dir }
  }
  return null
}

async function spawnServer(): Promise<void> {
  if (quitting || proc) return

  if (await portInUse(STT_PORT)) {
    console.log(`[stt] Port ${STT_PORT} band — server allaqachon ishlayapti (qo'lda?), spawn shart emas`)
    return
  }

  const found = findPython()
  if (!found) {
    console.warn('[stt] Python venv topilmadi — STT serverni qo\'lda ishga tushiring (python/README)')
    return
  }

  console.log(`[stt] Server ishga tushirilmoqda: ${found.python}`)
  proc = spawn(found.python, [found.script], {
    cwd: found.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  })

  proc.stdout?.on('data', (d: Buffer) => console.log(`[stt] ${d.toString().trimEnd()}`))
  proc.stderr?.on('data', (d: Buffer) => console.log(`[stt] ${d.toString().trimEnd()}`))

  proc.on('exit', (code) => {
    proc = null
    if (!quitting) {
      console.warn(`[stt] Server o'chdi (kod ${code}), ${RESPAWN_DELAY_MS}ms dan keyin qayta ko'tariladi`)
      setTimeout(() => void spawnServer(), RESPAWN_DELAY_MS)
    }
  })
}

export function startSttServer(): void {
  void spawnServer()

  app.on('will-quit', () => {
    quitting = true
    proc?.kill()
    proc = null
  })
}
