"""Tilmoch STT server.

16kHz mono int16 PCM ni WebSocket orqali qabul qiladi, faster-whisper bilan
transkripsiya qilib JSON qaytaradi.

Protokol:
  Client -> birinchi xabar (JSON): {"model": "small", "language": "auto"}
  Client -> keyingi xabarlar (binary): int16 PCM @ 16kHz
  Server -> {"type": "ready"} | {"type": "final", "text": "..."} | {"type": "error", "message": "..."}

Segmentatsiya: oddiy RMS asosidagi sukunat aniqlash — gapdan keyin ~700ms
jimlik bo'lsa segment yakunlanadi va transkripsiya qilinadi. Whisper'ning
ichki Silero VAD filtri (vad_filter=True) shovqinni qo'shimcha tozalaydi.
"""

import asyncio
import glob
import json
import logging
import os
import time

import numpy as np
import websockets
from faster_whisper import WhisperModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("tilmoch-stt")


def _setup_cuda_dlls() -> None:
    """pip bilan o'rnatilgan nvidia-cublas/cudnn DLL papkalarini PATH'ga qo'shadi.

    Windows'da ctranslate2 cublas64_12.dll va cudnn DLL'larini PATH'dan izlaydi;
    nvidia pip wheel'lari ularni site-packages/nvidia/*/bin ichiga qo'yadi.
    """
    import site

    for sp in site.getsitepackages():
        for bin_dir in glob.glob(os.path.join(sp, "nvidia", "*", "bin")):
            try:
                os.add_dll_directory(bin_dir)
                os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")
            except OSError:
                pass


_setup_cuda_dlls()

SAMPLE_RATE = 16000
SILENCE_RMS = 0.005          # bundan past RMS = jimlik (past qo'yilgan — sokin nutq kesilmasin)
SILENCE_FLUSH_MS = 700       # gapdan keyin shuncha jimlik -> segmentni yakunlash
MAX_SEGMENT_SEC = 10         # jimlik bo'lmasa ham shu uzunlikda majburan yakunlash
MIN_SEGMENT_SEC = 0.4        # bundan qisqa segmentlar tashlab yuboriladi
BEAM_SIZE = 2                # 1 = eng tez/xom, 5 = eng aniq/sekin

_models: dict[str, WhisperModel] = {}


def get_model(name: str) -> WhisperModel:
    if name not in _models:
        log.info("Loading model '%s' (birinchi marta sekin bo'lishi mumkin)...", name)
        try:
            model = WhisperModel(name, device="cuda", compute_type="int8_float16")
            # CUDA DLL muammolari faqat birinchi encode'da chiqadi — warmup bilan tekshiramiz.
            list(model.transcribe(np.zeros(1600, dtype=np.float32), language="en")[0])
            log.info("Model '%s' CUDA'da yuklandi", name)
        except Exception as e:
            log.warning("CUDA ishlamadi (%s), CPU'ga o'tildi", e)
            model = WhisperModel(name, device="cpu", compute_type="int8")
            log.info("Model '%s' CPU'da yuklandi", name)
        _models[name] = model
    return _models[name]


async def handle(ws):
    log.info("Client ulandi")
    try:
        config = json.loads(await ws.recv())
    except Exception:
        await ws.send(json.dumps({"type": "error", "message": "Birinchi xabar JSON config bo'lishi kerak"}))
        return

    model_name = config.get("model", "small")
    language = config.get("language", "auto")
    lang = None if language == "auto" else language

    loop = asyncio.get_running_loop()
    model = await loop.run_in_executor(None, get_model, model_name)
    await ws.send(json.dumps({"type": "ready"}))

    buf = np.zeros(0, dtype=np.float32)
    silence_samples = 0
    has_speech = False
    prev_text = ""  # oldingi segment matni — modelga kontekst sifatida beriladi

    # Diagnostika: har 5 sekundda qabul qilingan audio statistikasi
    stat_samples = 0
    stat_max_rms = 0.0
    stat_last = time.monotonic()

    def transcribe(audio: np.ndarray) -> str:
        segments, _info = model.transcribe(
            audio,
            language=lang,
            beam_size=BEAM_SIZE,
            vad_filter=True,
            condition_on_previous_text=False,
            # Oldingi gap kontekst beradi: atamalar/ismlar izchil chiqadi,
            # gap o'rtasidan boshlangan segmentlar yaxshiroq tushuniladi.
            initial_prompt=prev_text[-200:] if prev_text else None,
        )
        return " ".join(s.text.strip() for s in segments).strip()

    async def flush():
        nonlocal buf, silence_samples, has_speech, prev_text
        audio, buf = buf, np.zeros(0, dtype=np.float32)
        silence_samples = 0
        has_speech = False
        if len(audio) < SAMPLE_RATE * MIN_SEGMENT_SEC:
            return
        try:
            text = await loop.run_in_executor(None, transcribe, audio)
        except Exception as e:
            log.exception("Transkripsiya xatosi")
            await ws.send(json.dumps({"type": "error", "message": f"Transkripsiya xatosi: {e}"}))
            return
        if text:
            prev_text = text
            await ws.send(json.dumps({"type": "final", "text": text}, ensure_ascii=False))

    async for message in ws:
        if isinstance(message, str):
            continue  # hozircha runtime config o'zgartirish yo'q
        chunk = np.frombuffer(message, dtype=np.int16).astype(np.float32) / 32768.0
        buf = np.concatenate([buf, chunk])

        rms = float(np.sqrt(np.mean(chunk**2))) if len(chunk) else 0.0

        stat_samples += len(chunk)
        stat_max_rms = max(stat_max_rms, rms)
        now = time.monotonic()
        if now - stat_last >= 5:
            log.info(
                "stats: %.1fs audio qabul qilindi, max RMS %.4f (chegara %.4f), speech=%s, bufer %.1fs",
                stat_samples / SAMPLE_RATE, stat_max_rms, SILENCE_RMS, has_speech, len(buf) / SAMPLE_RATE,
            )
            stat_samples = 0
            stat_max_rms = 0.0
            stat_last = now

        if rms < SILENCE_RMS:
            silence_samples += len(chunk)
        else:
            silence_samples = 0
            has_speech = True

        silence_ms = silence_samples / SAMPLE_RATE * 1000
        if (has_speech and silence_ms >= SILENCE_FLUSH_MS) or len(buf) >= SAMPLE_RATE * MAX_SEGMENT_SEC:
            await flush()
        elif not has_speech and len(buf) > SAMPLE_RATE * 2:
            # uzoq jimlik — buferni bo'shatib turamiz
            buf = buf[-SAMPLE_RATE:]


async def main():
    log.info("Tilmoch STT server: ws://127.0.0.1:8765")
    async with websockets.serve(handle, "127.0.0.1", 8765, max_size=10 * 1024 * 1024):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
