let currentAudioSource: AudioBufferSourceNode | null = null;
let currentAudioCtx: AudioContext | null = null;

export function stopPCM() {
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
    } catch (e) {
      // already stopped
    }
    currentAudioSource = null;
  }
  if (currentAudioCtx) {
    currentAudioCtx.close();
    currentAudioCtx = null;
  }
}

export async function playPCM(base64Data: string, sampleRate: number = 24000) {
  stopPCM(); // Stop any previous playback

  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Gemini TTS returns 16-bit PCM (Little Endian)
  const pcm16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(pcm16.length);

  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 32768.0;
  }

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  currentAudioCtx = audioCtx;

  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  const buffer = audioCtx.createBuffer(1, float32.length, sampleRate);
  buffer.getChannelData(0).set(float32);

  const source = audioCtx.createBufferSource();
  currentAudioSource = source;
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  
  return new Promise<void>((resolve) => {
    source.onended = () => {
      if (currentAudioSource === source) {
        audioCtx.close();
        currentAudioCtx = null;
        currentAudioSource = null;
      }
      resolve();
    };
    source.start();
  });
}
