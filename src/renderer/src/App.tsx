import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSystemAudio } from './hooks/useSystemAudio'
import { SettingsPanel } from './components/SettingsPanel'
import { MeetingPanel } from './components/MeetingPanel'
import { VideoTab } from './components/VideoTab'
import mark from './assets/tilmoch-mark.svg'

type Tab = 'video' | 'meeting' | 'settings'

const TAB_IDS: Tab[] = ['video', 'meeting', 'settings']

function App(): React.JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('video')
  // Capture holati App darajasida — tab almashganda to'xtab qolmasin
  const audio = useSystemAudio()

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-mark" src={mark} alt="" />
          <span className="brand-name">Tilmoch</span>
          <span className="brand-sub">{t('brand.sub')}</span>
        </div>
        <nav className="tabs">
          {TAB_IDS.map((id) => (
            <button
              key={id}
              className={`tab ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              {t(`tabs.${id}`)}
              {id === 'video' && audio.capturing && <span className="live-dot" />}
            </button>
          ))}
        </nav>
      </header>

      {/* Panellar yashirinadi, lekin unmount bo'lmaydi — stream/mikrofon uzilmasin */}
      <div className={`tab-content ${tab === 'video' ? '' : 'hidden'}`}>
        <VideoTab audio={audio} />
      </div>
      <div className={`tab-content ${tab === 'meeting' ? '' : 'hidden'}`}>
        <div className="tab-page">
          <MeetingPanel />
        </div>
      </div>
      <div className={`tab-content ${tab === 'settings' ? '' : 'hidden'}`}>
        <div className="tab-page">
          <SettingsPanel />
        </div>
      </div>
    </div>
  )
}

export default App
