/**
 * Gemini resamples audio to 16 kHz internally for understanding, so encoding
 * at a higher native rate (typically 48 kHz from the browser's AudioContext)
 * only inflates the payload with no grading benefit. Downsampling here cuts
 * the base64 payload sent to the server action roughly 3x.
 */
const TARGET_SAMPLE_RATE = 16000;

/**
 * Converts any browser-recorded audio Blob (typically WebM/Opus from
 * MediaRecorder) into a mono 16-bit PCM WAV Blob — a format Gemini's audio
 * understanding officially supports, unlike WebM. Runs entirely client-side
 * via the Web Audio API, no server round-trip.
 */
export async function blobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();

  // Resample to mono 16kHz via an OfflineAudioContext. A plain
  // `new AudioContext({ sampleRate: 16000 })` is not honored by all browsers
  // for `decodeAudioData`, so we decode at the native rate first and then
  // render through an offline context at the target rate — the standard,
  // reliable cross-browser way to resample Web Audio buffers.
  const offlineContext = new OfflineAudioContext(
    1,
    Math.ceil(decodedBuffer.duration * TARGET_SAMPLE_RATE),
    TARGET_SAMPLE_RATE
  );
  const source = offlineContext.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(offlineContext.destination);
  source.start();
  const resampledBuffer = await offlineContext.startRendering();

  const channelData = resampledBuffer.getChannelData(0);
  const sampleRate = resampledBuffer.sampleRate;

  const pcmData = floatTo16BitPCM(channelData);
  return writeWavHeader(pcmData, 1, sampleRate);
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function writeWavHeader(pcmData: Int16Array, numChannels: number, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < pcmData.length; i++, offset += 2) {
    view.setInt16(offset, pcmData[i], true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/** Blob -> base64 string (no `data:` prefix), for sending to a server action. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
