import { ipcMain } from 'electron'
import { loadSettings } from './settings'

export interface TranslateResult {
  ok: boolean
  text: string
  error?: string
}

const LANG_NAMES: Record<string, string> = {
  uz: 'Uzbek',
  en: 'English',
  ja: 'Japanese',
  ru: 'Russian',
  ko: 'Korean',
  zh: 'Chinese',
  tr: 'Turkish',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  ar: 'Arabic'
}

// Thinking modellar (<think>...</think>) chiqarsa, faqat javob qismini olamiz.
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

function buildPrompt(targetLang: string): string {
  const target = LANG_NAMES[targetLang] ?? targetLang
  let prompt =
    `You are a professional subtitle translator. Translate each user message into ${target}. ` +
    `Rules: output ONLY the translation, nothing else. No explanations, no quotes, no notes. ` +
    `Keep the tone and register of the original. If a fragment is unintelligible noise, output an empty string.`
  if (targetLang === 'uz') {
    // Kichik modellar o'zbekchada kirillga o'tib ketadi yoki ruscha so'z aralashtirib yuboradi.
    prompt +=
      ` Use the LATIN script (o'zbek lotin alifbosi) only — never Cyrillic. ` +
      `Use natural, everyday Uzbek and never mix in Russian words.`
  }
  return prompt
}

async function translateWithOllama(text: string, target: string): Promise<TranslateResult> {
  const s = loadSettings()
  const base = (s.translate.endpoint || 'http://localhost:11434').replace(/\/+$/, '')
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: s.translate.model,
      stream: false,
      keep_alive: '30m', // model VRAMda qolsin — har segmentda qayta yuklanmasin
      options: { temperature: 0.2 },
      messages: [
        { role: 'system', content: buildPrompt(target) },
        { role: 'user', content: text }
      ]
    })
  })
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`)
  const data = (await res.json()) as { message?: { content?: string } }
  return { ok: true, text: stripThinking(data.message?.content ?? '') }
}

/**
 * Google Translate'ning norasmiy bepul endpoint'i (kalit kerak emas).
 * Ogohlantirish: norasmiy — Google cheklashi yoki o'zgartirishi mumkin,
 * shuning uchun bu provider'lardan biri xolos, yagona yo'l emas.
 */
async function translateWithGoogleFree(text: string, target: string): Promise<TranslateResult> {
  const s = loadSettings()
  const sl = s.sourceLang === 'auto' ? 'auto' : s.sourceLang
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx` +
    `&sl=${sl}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(10000)
  })
  if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`)
  const data = (await res.json()) as [[string][]]
  const out = (data[0] ?? []).map((seg) => seg[0]).join('')
  return { ok: true, text: out.trim() }
}

async function translateWithDeepL(text: string, target: string): Promise<TranslateResult> {
  const s = loadSettings()
  const key = s.translate.apiKey
  // Bepul tier kalitlari ':fx' bilan tugaydi va alohida hostda ishlaydi.
  const base = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com'
  const res = await fetch(`${base}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      text: [text],
      target_lang: target.toUpperCase(),
      ...(s.sourceLang !== 'auto' && { source_lang: s.sourceLang.toUpperCase() })
    })
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`DeepL HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ''}`)
  }
  const data = (await res.json()) as { translations?: { text: string }[] }
  return { ok: true, text: (data.translations?.[0]?.text ?? '').trim() }
}

async function translateWithOpenAI(text: string, target: string): Promise<TranslateResult> {
  const s = loadSettings()
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${s.translate.apiKey}`
    },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: s.translate.model || 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: buildPrompt(target) },
        { role: 'user', content: text }
      ]
    })
  })
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`)
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return { ok: true, text: (data.choices?.[0]?.message?.content ?? '').trim() }
}

export function registerTranslateIpc(): void {
  ipcMain.handle(
    'translate:text',
    async (_e, text: string, targetLang?: string): Promise<TranslateResult> => {
      try {
        const s = loadSettings()
        const target = targetLang || s.targetLang
        const provider = s.translate.provider
        if (provider === 'google-free') return await translateWithGoogleFree(text, target)
        if (provider === 'ollama') return await translateWithOllama(text, target)
        if (provider === 'deepl') return await translateWithDeepL(text, target)
        if (provider === 'openai') return await translateWithOpenAI(text, target)
        return { ok: false, text: '', error: `Provider '${provider}' hali qo'llanmaydi` }
      } catch (e) {
        return { ok: false, text: '', error: e instanceof Error ? e.message : String(e) }
      }
    }
  )
}
