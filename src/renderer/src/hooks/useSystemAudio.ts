import { useCallback, useEffect, useRef, useState } from 'react'

export interface SystemAudioState {
  capturing: boolean
  level: number // 0..1 RMS level for the meter
  error: string | null
  stream: MediaStream | null
  start: () => Promise<void>
  stop: () => void
}

/**
 * Captures system audio (loopback) via electron-audio-loopback.
 * Exposes a live RMS level so the UI can prove audio is flowing.
 * The raw MediaStream is kept in a ref for the upcoming STT pipeline.
 */
export function useSystemAudio(): SystemAudioState {
  const [capturing, setCapturing] = useState(false)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number>(0)

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    setStream(null)
    setCapturing(false)
    setLevel(0)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    try {
      await window.api.enableLoopbackAudio()
      // getDisplayMedia fails without video: true; we drop the video tracks below.
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      await window.api.disableLoopbackAudio()

      stream.getVideoTracks().forEach((track) => {
        track.stop()
        stream.removeTrack(track)
      })

      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((t) => t.stop())
        throw new Error('No system audio track available')
      }

      streamRef.current = stream

      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)

      const buf = new Float32Array(analyser.fftSize)
      const tick = (): void => {
        analyser.getFloatTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4))
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
      setStream(stream)
      setCapturing(true)
    } catch (e) {
      await window.api.disableLoopbackAudio().catch(() => {})
      setError(e instanceof Error ? e.message : String(e))
      setCapturing(false)
    }
  }, [])

  useEffect(() => stop, [stop])

  return { capturing, level, error, stream, start, stop }
}
