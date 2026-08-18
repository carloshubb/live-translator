import { useCallback, useRef, useState } from 'react'
import { ttsPlaying } from '../lib/ttsGate'
import { registerSpokenText } from '../lib/echoFilter'

const MAX_QUEUE = 3 // tarjimalar nutqdan tez kelsa, eskilarini tashlab yuboramiz

export interface TtsPlayOptions {
  voice?: string // berilmasa settings.tts.model
  sinkId?: string // audio chiqish qurilmasi (virtual cable); '' = default
}

interface QueueItem {
  text: string
  opts?: TtsPlayOptions
}

export interface TtsQueue {
  speaking: boolean
  enqueue: (text: string, opts?: TtsPlayOptions) => void
  clear: () => void
}

/**
 * Tarjimalarni navbat bilan ovozda o'qiydi (edge-tts orqali).
 * Bir vaqtda bitta audio ijro etiladi; ijro paytida ttsGate bayrog'i
 * STT oqimini to'xtatib turadi (feedback loop oldini olish).
 */
export function useTtsQueue(): TtsQueue {
  const queue = useRef<QueueItem[]>([])
  const playing = useRef(false)
  const [speaking, setSpeaking] = useState(false)

  const playNext = useCallback(async (): Promise<void> => {
    if (playing.current) return
    const item = queue.current.shift()
    if (!item) {
      setSpeaking(false)
      // Gate'ni darhol emas, biroz kechiktirib bo'shatamiz: loopback yo'lida
      // hali "dumi" qolgan TTS audio STT'ga oqib ketmasin.
      setTimeout(() => {
        if (!playing.current && queue.current.length === 0) ttsPlaying.current = false
      }, 700)
      return
    }
    playing.current = true
    setSpeaking(true)
    ttsPlaying.current = true
    registerSpokenText(item.text) // aks-sado filtri uchun eslab qolamiz
    try {
      const settings = await window.api.getSettings()
      const voice = item.opts?.voice || settings.tts.model
      if (settings.tts.provider === 'edge-tts' && voice) {
        const bytes = await window.api.speak(item.text, voice)
        await new Promise<void>((resolve) => {
          const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/mpeg' })
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          const done = (): void => {
            URL.revokeObjectURL(url)
            resolve()
          }
          audio.onended = done
          audio.onerror = done
          const play = (): void => {
            audio.play().catch(done)
          }
          if (item.opts?.sinkId) {
            // TTS'ni tanlangan qurilmaga (masalan, virtual cable) yo'naltirish
            audio
              .setSinkId(item.opts.sinkId)
              .then(play)
              .catch(play) // qurilma topilmasa default'da chalamiz
          } else {
            play()
          }
        })
      }
    } catch {
      // bitta segment xatosi navbatni to'xtatmasin
    } finally {
      playing.current = false
      void playNext()
    }
  }, [])

  const enqueue = useCallback(
    (text: string, opts?: TtsPlayOptions): void => {
      if (!text.trim()) return
      queue.current.push({ text, opts })
      while (queue.current.length > MAX_QUEUE) queue.current.shift()
      void playNext()
    },
    [playNext]
  )

  const clear = useCallback((): void => {
    queue.current = []
  }, [])

  return { speaking, enqueue, clear }
}
