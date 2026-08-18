import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStt } from '../hooks/useStt'
import { useTtsQueue } from '../hooks/useTtsQueue'

export function SubtitleView({ stream }: { stream: MediaStream | null }): React.JSX.Element {
  const { t } = useTranslation()
  const { status, error, lines, clearLines } = useStt(stream)
  const { speaking, enqueue, clear } = useTtsQueue()
  const [voiceOn, setVoiceOn] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastSpokenId = useRef(-1)

  const statusLabels: Record<string, string> = {
    idle: t('subtitle.statusIdle'),
    connecting: t('subtitle.statusConnecting'),
    ready: t('subtitle.statusReady'),
    error: t('subtitle.statusError')
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lines])

  // Yangi kelgan tarjimalarni ovozga qo'yamiz
  useEffect(() => {
    if (!voiceOn) return
    for (const l of lines) {
      if (l.dst && l.id > lastSpokenId.current) {
        lastSpokenId.current = l.id
        enqueue(l.dst)
      }
    }
  }, [lines, voiceOn, enqueue])

  const toggleVoice = (): void => {
    if (voiceOn) clear()
    setVoiceOn(!voiceOn)
  }

  return (
    <div className="subtitles">
      <div className="subtitles-header">
        <h2>{t('subtitle.title')}</h2>
        <div className="subtitles-controls">
          {lines.length > 0 && (
            <button className="btn-voice" onClick={clearLines} title={t('subtitle.clear')}>
              {t('subtitle.clear')}
            </button>
          )}
          <button className={`btn-voice ${voiceOn ? 'on' : ''}`} onClick={toggleVoice}>
            {voiceOn
              ? speaking
                ? t('subtitle.speaking')
                : t('subtitle.voiceOn')
              : t('subtitle.voiceOff')}
          </button>
          <span className={`stt-status stt-${status}`}>{statusLabels[status]}</span>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="subtitle-box" ref={scrollRef}>
        {lines.length === 0 ? (
          <p className="subtitle-empty">
            {status === 'ready' ? t('subtitle.emptyReady') : t('subtitle.emptyIdle')}
          </p>
        ) : (
          lines.map((line, i) => (
            <div key={line.id} className={`subtitle-pair ${i === lines.length - 1 ? 'latest' : ''}`}>
              <p className="subtitle-src">{line.src}</p>
              {line.dst !== null ? (
                <p className="subtitle-dst">{line.dst}</p>
              ) : line.dstError ? (
                <p className="subtitle-dst-error">
                  {t('subtitle.translateError')}: {line.dstError}
                </p>
              ) : (
                <p className="subtitle-dst pending">{t('subtitle.pending')}</p>
              )}
            </div>
          ))
        )}
      </div>

      {voiceOn && <p className="hint">{t('subtitle.voiceHint')}</p>}
    </div>
  )
}
