import { ipcMain } from 'electron'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

export interface TtsVoice {
  name: string // ShortName, masalan 'uz-UZ-MadinaNeural'
  locale: string
  gender: string
}

export function registerTtsIpc(): void {
  ipcMain.handle('tts:voices', async (): Promise<TtsVoice[]> => {
    const tts = new MsEdgeTTS()
    const voices = await tts.getVoices()
    return voices.map((v) => ({ name: v.ShortName, locale: v.Locale, gender: v.Gender }))
  })

  // Returns MP3 bytes; renderer plays them via a Blob URL.
  ipcMain.handle('tts:speak', async (_e, text: string, voice: string): Promise<Uint8Array> => {
    const tts = new MsEdgeTTS()
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
    const { audioStream } = tts.toStream(text)
    const chunks: Buffer[] = []
    for await (const chunk of audioStream) {
      chunks.push(chunk as Buffer)
    }
    return Buffer.concat(chunks)
  })
}
