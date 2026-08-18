import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface OverlayLine {
  id: number
  src: string
  dst: string | null
}

/**
 * Shaffof, har doim tepada turadigan subtitle oynasi.
 * Asosiy oynadan IPC orqali kelgan oxirgi tarjimani ko'rsatadi.
 */
export function Overlay(): React.JSX.Element {
  const { t } = useTranslation()
  const [line, setLine] = useState<OverlayLine | null>(null)

  useEffect(() => {
    document.body.classList.add('overlay-mode')
    window.api.onOverlayLine((l) => {
      setLine((prev) => {
        // Bir xil id keldi = tarjima yangilandi; yangi id = yangi gap
        if (prev && l.id < prev.id) return prev
        return l
      })
    })
  }, [])

  return (
    <div className="overlay-root">
      <button className="overlay-close" onClick={() => window.api.closeOverlay()} title="Yopish">
        ✕
      </button>
      {line ? (
        <div className="overlay-content">
          <p className="overlay-src">{line.src}</p>
          <p className="overlay-dst">{line.dst ?? '…'}</p>
        </div>
      ) : (
        <div className="overlay-content">
          <p className="overlay-waiting">{t('overlay.waiting')}</p>
        </div>
      )}
    </div>
  )
}
