export interface StageConfig {
  provider: string
  model: string
  apiKey: string
  endpoint: string
}

export interface MeetingSettings {
  myLang: string // men gapiradigan til
  partnerLang: string // suhbatdosh eshitadigan til
  outputDeviceId: string // TTS chiqadigan qurilma (virtual cable), '' = default
  micDeviceId: string // tanlangan mikrofon, '' = default
}

export interface AppSettings {
  sourceLang: string // 'auto' yoki BCP-47 prefiksi: 'en', 'ja', ...
  targetLang: string
  overlayOpen: boolean // oxirgi sessiyada overlay yoniq edimi — qayta ochishda tiklanadi
  uiLang: string // interfeys tili: uz | en | ru | ja | es
  stt: StageConfig
  translate: StageConfig
  tts: StageConfig
  meeting: MeetingSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  sourceLang: 'auto',
  targetLang: 'uz',
  overlayOpen: false,
  uiLang: 'uz',
  stt: {
    provider: 'whisper-local',
    model: 'large-v3-turbo',
    apiKey: '',
    endpoint: ''
  },
  translate: {
    provider: 'ollama',
    model: 'gemma2',
    apiKey: '',
    endpoint: 'http://localhost:11434'
  },
  tts: {
    provider: 'edge-tts',
    model: 'uz-UZ-MadinaNeural',
    apiKey: '',
    endpoint: ''
  },
  meeting: {
    myLang: 'uz',
    partnerLang: 'en',
    outputDeviceId: '',
    micDeviceId: ''
  }
}
