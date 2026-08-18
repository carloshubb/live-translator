// 128-sample Float32 freymlarni main thread'ga uzatadi (STT pipeline uchun).
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch) this.port.postMessage(ch.slice(0))
    return true
  }
}
registerProcessor('pcm', PCMProcessor)
