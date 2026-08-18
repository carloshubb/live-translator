// O'z TTS ovozimizning aks-sadosini aniqlash.
// Biz aytgan tarjima matnlarini eslab qolamiz; STT'dan kelgan yangi segment
// yaqinda aytilgan matnga juda o'xshasa — bu o'z ovozimizning qaytishi, tashlaymiz.

interface SpokenEntry {
  text: string
  t: number
}

const recent: SpokenEntry[] = []
const TTL_MS = 20000
const OVERLAP_THRESHOLD = 0.6

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function registerSpokenText(text: string): void {
  const n = normalize(text)
  if (!n) return
  recent.push({ text: n, t: Date.now() })
  while (recent.length > 10) recent.shift()
}

export function isLikelyEcho(text: string): boolean {
  const now = Date.now()
  const tokens = normalize(text).split(' ').filter(Boolean)
  if (tokens.length === 0) return false
  for (const r of recent) {
    if (now - r.t > TTL_MS) continue
    const spoken = new Set(r.text.split(' '))
    const overlap = tokens.filter((t) => spoken.has(t)).length
    if (overlap / tokens.length >= OVERLAP_THRESHOLD) return true
  }
  return false
}
