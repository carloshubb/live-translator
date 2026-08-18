import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppSettings } from '../../../shared/settings'
import { LANGUAGES } from '../providers'
import { useStt } from '../hooks/useStt'
import { useTtsQueue } from '../hooks/useTtsQueue'

interface AudioDevice {
  id: string
  label: string
}

/**
 * Meeting rejimi: mikrofondan gapni olib, suhbatdosh tiliga tarjima qilib,
 * TTS ovozini tanlangan chiqish qurilmasiga (virtual cable) yuboradi.
 * Zoom/Meet'da mikrofon sifatida virtual cable'ning narigi uchi tanlanadi.
 */
export function MeetingPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [micStream, setMicStream] = useState<MediaStream | null>(null)
  const [outputs, setOutputs] = useState<AudioDevice[]>([])
  const [mics, setMics] = useState<AudioDevice[]>([])
  const [voice, setVoice] = useState('')
  const [micError, setMicError] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installMsg, setInstallMsg] = useState<string | null>(null)
  const lastSpokenId = useRef(-1)

  const { status, error, lines, level, clearLines } = useStt(
    micStream,
    settings
      ? { language: settings.meeting.myLang, targetLang: settings.meeting.partnerLang }
      : undefined
  )
  const { speaking, enqueue, clear } = useTtsQueue()

  useEffect(() => {
    window.api.getSettings().then(setSettings)
  }, [])

  // Kirish/chiqish qurilmalari ro'yxati (virtual cable chiqishlarda ko'rinadi)
  const refreshOutputs = useCallback(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setOutputs(
        devices
          .filter((d) => d.kind === 'audiooutput')
          .map((d) => ({ id: d.deviceId, label: d.label || `Qurilma ${d.deviceId.slice(0, 6)}` }))
      )
      setMics(
        devices
          .filter((d) => d.kind === 'audioinput')
          .map((d) => ({
            id: d.deviceId,
            label: d.label || `Mikrofon ${d.deviceId.slice(0, 6)}`
          }))
      )
    })
  }, [])
  useEffect(refreshOutputs, [refreshOutputs])

  // Suhbatdosh tiliga mos TTS ovozini avtomatik tanlash
  const partnerLang = settings?.meeting.partnerLang
  useEffect(() => {
    if (!partnerLang) return
    window.api.listTtsVoices().then((all) => {
      const match = all.find((v) => v.locale.toLowerCase().startsWith(partnerLang))
      setVoice(match?.name ?? '')
    })
  }, [partnerLang])

  // Yangi tarjimalarni virtual cable'ga o'qib yuborish
  useEffect(() => {
    if (!settings) return
    for (const l of lines) {
      if (l.dst && l.id > lastSpokenId.current) {
        lastSpokenId.current = l.id
        enqueue(l.dst, { voice, sinkId: settings.meeting.outputDeviceId })
      }
    }
  }, [lines, settings, voice, enqueue])

  // VB-Cable aniqlangan zahoti, TTS chiqishi tanlanmagan bo'lsa, avtomatik tanlaymiz
  const cableDevice = outputs.find((o) => /cable input/i.test(o.label))
  useEffect(() => {
    if (cableDevice && settings && !settings.meeting.outputDeviceId) {
      const next = {
        ...settings,
        meeting: { ...settings.meeting, outputDeviceId: cableDevice.id }
      }
      setSettings(next)
      void window.api.saveSettings(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cableDevice?.id, settings?.meeting.outputDeviceId])

  const installCable = async (): Promise<void> => {
    setInstalling(true)
    setInstallMsg(t('meeting.installing'))
    const r = await window.api.installVbCable()
    setInstalling(false)
    setInstallMsg(r.ok ? t('meeting.installDone') : `${t('meeting.installFailed')}: ${r.error}`)
    refreshOutputs()
  }

  const updateMeeting = (patch: Partial<AppSettings['meeting']>): void => {
    if (!settings) return
    const next = { ...settings, meeting: { ...settings.meeting, ...patch } }
    setSettings(next)
    void window.api.saveSettings(next)
  }

  const start = async (): Promise<void> => {
    setMicError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(settings?.meeting.micDeviceId && {
            deviceId: { exact: settings.meeting.micDeviceId }
          }),
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      setMicStream(stream)
      refreshOutputs() // ruxsatdan keyin qurilma nomlari ko'rinadi
    } catch (e) {
      setMicError(e instanceof Error ? e.message : String(e))
    }
  }

  const stop = (): void => {
    micStream?.getTracks().forEach((t) => t.stop())
    setMicStream(null)
    clear()
    lastSpokenId.current = -1
  }

  if (!settings) return <p className="status">{t('meeting.loading')}</p>

  return (
    <div className="settings">
      <div className="subtitles-header">
        <h2>{t('meeting.title')}</h2>
        {micStream && (
          <span className={`stt-status stt-${status}`}>
            {speaking ? t('meeting.sending') : status === 'ready' ? t('meeting.speak') : '…'}
          </span>
        )}
      </div>

      <p className="hint">{t('meeting.hint')}</p>

      <div className="stage">
        <div className="stage-row">
          <label>{t('meeting.myLang')}</label>
          <select
            value={settings.meeting.myLang}
            onChange={(e) => updateMeeting({ myLang: e.target.value })}
            disabled={!!micStream}
          >
            {LANGUAGES.filter((l) => l.code !== 'auto').map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="stage-row">
          <label>{t('meeting.partnerLang')}</label>
          <select
            value={settings.meeting.partnerLang}
            onChange={(e) => updateMeeting({ partnerLang: e.target.value })}
            disabled={!!micStream}
          >
            {LANGUAGES.filter((l) => l.code !== 'auto').map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="stage-row">
          <label>{t('meeting.mic')}</label>
          <div className="model-select">
            <select
              value={settings.meeting.micDeviceId}
              onChange={(e) => updateMeeting({ micDeviceId: e.target.value })}
              disabled={!!micStream}
            >
              <option value="">{t('meeting.micDefault')}</option>
              {mics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <button className="btn-refresh" title="Qurilmalarni yangilash" onClick={refreshOutputs}>
              ↻
            </button>
          </div>
        </div>

        <div className="stage-row">
          <label>{t('meeting.ttsOut')}</label>
          <div className="model-select">
            <select
              value={settings.meeting.outputDeviceId}
              onChange={(e) => updateMeeting({ outputDeviceId: e.target.value })}
            >
              <option value="">{t('meeting.outDefault')}</option>
              {outputs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <button className="btn-refresh" title="Qurilmalarni yangilash" onClick={refreshOutputs}>
              ↻
            </button>
          </div>
        </div>

        {voice && (
          <p className="status">
            {t('meeting.voiceLabel')}: <b>{voice}</b>
          </p>
        )}
      </div>

      {(micError || error) && <p className="error">{micError ?? error}</p>}

      {!settings.meeting.outputDeviceId && !cableDevice && (
        <div className="stage">
          <p className="stage-error">{t('meeting.warnDefaultOut')}</p>
          <div className="settings-actions">
            <button className="btn btn-start" onClick={installCable} disabled={installing}>
              {installing ? '⏳ …' : `⬇️ ${t('meeting.installCable')}`}
            </button>
          </div>
          {installMsg && <p className="status">{installMsg}</p>}
        </div>
      )}

      {micStream && (
        <div className="meter-track">
          <div className="meter-fill" style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
      )}

      {micStream ? (
        <button className="btn btn-stop" onClick={stop}>
          {t('meeting.stop')}
        </button>
      ) : (
        <button className="btn btn-start" onClick={start}>
          {t('meeting.start')}
        </button>
      )}

      {micStream && lines.length > 0 && (
        <div className="subtitles-controls" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-voice" onClick={clearLines}>
            {t('meeting.clear')}
          </button>
        </div>
      )}

      {micStream && (
        <div className="subtitle-box">
          {lines.length === 0 ? (
            <p className="subtitle-empty">{t('meeting.empty')}</p>
          ) : (
            lines.map((line, i) => (
              <div
                key={line.id}
                className={`subtitle-pair ${i === lines.length - 1 ? 'latest' : ''}`}
              >
                <p className="subtitle-src">{line.src}</p>
                {line.dst !== null ? (
                  <p className="subtitle-dst">{line.dst}</p>
                ) : line.dstError ? (
                  <p className="subtitle-dst-error">tarjima xatosi: {line.dstError}</p>
                ) : (
                  <p className="subtitle-dst pending">tarjima qilinmoqda…</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
