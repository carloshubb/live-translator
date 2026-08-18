<div align="center">

# Tilmoch

**Real-time speech translation for your desktop**

*Tilmoch (тилмоч) — Uzbek for "interpreter"*

[![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square)](#requirements)
[![Electron](https://img.shields.io/badge/Electron-39-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Release](https://img.shields.io/github/v/release/SherzodkhujaNiyozov/tilmoch?style=flat-square&color=4fc3f7)](https://github.com/SherzodkhujaNiyozov/tilmoch/releases)

<br/>

Capture any audio from your computer. Transcribe it locally with Whisper. Translate it. Hear it — instantly.<br/>
No subscription. No cloud lock-in. Your audio never leaves your machine.

<br/>

<!-- DEMO GIF: record a demo and place at docs/demo.gif, then uncomment the line below -->
<!-- ![Tilmoch — live bilingual subtitle overlay over a YouTube video](docs/demo.gif) -->

> **Demo GIF coming soon** — live bilingual subtitles over a YouTube video with the cinema-style overlay.

</div>

---

## How it works

```
  System audio / mic          STT                    Translation              TTS
 ┌──────────────────┐   ┌─────────────────┐   ┌──────────────────┐   ┌────────────────┐
 │  Any app audio   │   │  faster-whisper  │   │  Google / Ollama │   │   Edge TTS     │
 │  or microphone   │──▶│  local GPU/CPU  │──▶│  DeepL / OpenAI  │──▶│  virtual cable │
 │  (driverless)    │   │  large-v3-turbo  │   │  (your choice)   │   │  or speakers   │
 └──────────────────┘   └─────────────────┘   └──────────────────┘   └────────────────┘
```

Every stage is **independently pluggable** — pick a provider per stage in Settings. Stay 100% free with local models, or drop in an API key to unlock paid quality.

---

## Features

| | |
|---|---|
| **Video translation** | Capture system audio with one click — no drivers, no virtual cable. Live bilingual subtitles appear in real-time. |
| **Subtitle overlay** | Transparent, always-on-top subtitle window. Works over fullscreen video, draggable to any position. |
| **Spoken translation** | Translations read aloud via neural Edge TTS voices. Three-layer echo-loop protection prevents feedback. |
| **Meeting mode** | You speak your language; your Zoom / Google Meet partner hears theirs — routed through a virtual audio cable. |
| **Local GPU STT** | faster-whisper with CUDA 12 (bundled via pip wheels — no system CUDA install). Automatic CPU fallback. |
| **Guided VB-Cable setup** | One-click download + elevated install from inside the app. Auto-detected and auto-selected when present. |
| **Self-managing server** | The app spawns, monitors, and restarts the Python STT server automatically. No extra terminal needed. |
| **Pluggable pipeline** | Per-stage provider and model selection. Ollama model list is discovered automatically via `/api/tags`. |
| **5 UI languages** | Uzbek · English · Russian · Japanese · Spanish (i18next, persisted across sessions). |

---

## Requirements

| | Minimum | Recommended |
|---|---|---|
| **OS** | Windows 10 · macOS 12.3 · Linux (PipeWire) | Windows 11 |
| **Node.js** | 18 | 20 LTS |
| **Python** | 3.10 | 3.12 |
| **RAM** | 8 GB | 16 GB |
| **GPU** | — (CPU fallback works) | NVIDIA with 4 GB+ VRAM (CUDA 12) |
| **Ollama** | Optional — for local offline translation | [Latest](https://ollama.com/download) |

---

## Quick start

```bash
# 1. Clone and install JS dependencies
git clone https://github.com/SherzodkhujaNiyozov/tilmoch.git
cd tilmoch
npm install

# 2. Set up the Python STT environment (one-time)
cd python
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt  # macOS/Linux
cd ..

# 3. (Optional) Pull a local translation model
ollama pull gemma3:4b

# 4. Launch — the STT server starts automatically
npm run dev
```

> **First run note:** the Whisper `large-v3-turbo` model (~1.5 GB) downloads on first transcription. The NVIDIA CUDA runtime is installed via pip wheels — no separate CUDA toolkit required.

---

## Model recommendations

### Speech-to-Text

| Model | VRAM (int8) | Notes |
|---|---|---|
| **`large-v3-turbo`** ⭐ | ~2.7 GB | Best free STT available. 2.5× faster than real-time. Use this by default. |
| `distil-large-v3` | ~1.5 GB | Near-identical quality for English-heavy content. |
| `small` | ~0.5 GB | CPU-only machines — noticeably more transcription errors. |

Cloud alternatives (`gpt-4o-transcribe`, `deepgram nova-3`) are supported via API key — but on a CUDA machine, `large-v3-turbo` matches them at zero cost. Deepgram (`$0.0077/min`) is the best latency option if you ever need cloud streaming.

### Translation

| Provider | Cost | Best for |
|---|---|---|
| **Google Translate (free)** ⭐ | Free, no key | Low-resource languages (Uzbek, etc.). Uses the unofficial endpoint — the app handles rate-limiting gracefully. |
| **Ollama `gemma3:4b`** ⭐ | Free, local | Fully offline. Excellent for major languages (Russian, Japanese, Spanish, etc.). Mediocre for Uzbek — use Google instead. |
| `qwen2.5:3b` / `qwen3:4b` | Free, local | Strong for CJK languages. **Do not use for Uzbek** — produces incorrect output. |
| DeepL API | Free tier 500k chars/mo | Best quality for European languages. Weak Uzbek support. |
| OpenAI `gpt-4o-mini` | ~$0.15/M tokens | Best context-aware paid option — handles idioms, slang, mid-sentence corrections. |

> Avoid "thinking" models like `deepseek-r1` for translation — the reasoning pass kills real-time latency.

**Rule of thumb:** Uzbek target → Google free. Major language + offline → `gemma3:4b`. Best possible quality → `gpt-4o-mini`.

### Text-to-Speech

| Provider | Cost | Notes |
|---|---|---|
| **Edge TTS** ⭐ | Free | Neural quality, 400+ voices, includes `uz-UZ-MadinaNeural`. Needs internet. |
| ElevenLabs | From $5/mo | Best quality + voice cloning. Most impactful paid upgrade for Meeting mode. |

---

## Meeting mode setup (Zoom / Google Meet)

Meeting mode lets you speak your language while your partner hears theirs in real-time.

1. Open the **Meeting** tab and select your language and your partner's language.
2. If VB-Cable is not installed, click **Install VB-Cable** — the app downloads the official package and launches the installer. Approve the UAC prompt.
3. The app automatically selects **CABLE Input** as the TTS output device once it detects the cable.
4. In Zoom or Google Meet, set your **Microphone to CABLE Output**.
5. Click **Start** and speak. Your partner hears the translation.
6. To understand your partner in return, also enable **Video translation** on the Video tab. Use headphones to prevent echo.

---

## Troubleshooting

| Symptom | Solution |
|---|---|
| Ollama models not listed | Confirm Ollama is running (`ollama list`). If the tray icon is stuck, quit and restart Ollama, then press **↻** in the app. |
| STT status stuck on "connecting" | The app respawns the server automatically — wait ~5 s. Open DevTools and check `[stt]` logs. |
| First transcription is slow | One-time Whisper model download (~1.5 GB). Subsequent starts are instant. |
| GPU not used | On model load the server logs either `CUDA'da yuklandi` (GPU) or `CPU'da yuklandi` (fallback). |
| CABLE Input missing after install | Press **↻** to refresh devices. If still missing, restart the app. Rarely, Windows requires a reboot. |
| Partner hears original + translation | Your Zoom microphone must be set to **CABLE Output**, not your physical microphone. |

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 39 + electron-vite |
| UI | React 19 + TypeScript + i18next |
| Audio capture | [`electron-audio-loopback`](https://github.com/alectrocute/electron-audio-loopback) — driverless WASAPI loopback |
| STT | [`faster-whisper`](https://github.com/SYSTRAN/faster-whisper) (CTranslate2) via WebSocket, Python subprocess |
| Translation | Google Translate (free) · [Ollama](https://ollama.com) · DeepL · OpenAI |
| TTS | [`msedge-tts`](https://github.com/Migushthe2nd/MsEdgeTTS) — Microsoft Edge neural voices |
| Design | Custom token-based design system — surface ramp, Inter, motion specs |

---

## License

All rights reserved. This is a personal portfolio project. You are welcome to read and learn from the source code, but please contact the author before any commercial use or redistribution.
