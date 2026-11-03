// Reproducción del <audio id="bg-audio"> SIN enrutar por Web Audio
// (evita el modo "mudo" de createMediaElementSource) + envelope de energía
// decodificado aparte para animar el loader al ritmo real de la canción.

let envelope: Float32Array | null = null;
let envelopeSrc = '';
let envDuration = 0;
let envPromise: Promise<Float32Array | null> | null = null;
let envPromiseSrc = '';
let envToken = 0;
let level = 0;

export function getAudioEl(): HTMLAudioElement | null {
  return document.getElementById('bg-audio') as HTMLAudioElement | null;
}

// Reproduce en directo (sin grafo). Debe llamarse dentro de un gesto de usuario.
export function playDirect(): Promise<boolean> {
  const el = getAudioEl();
  if (!el) return Promise.resolve(false);
  el.muted = false;
  return el
    .play()
    .then(() => true)
    .catch(() => false);
}

// Decodifica el mp3 aparte (no afecta la reproducción) y calcula ~N buckets
// de energía RMS normalizados. Solo se ejecuta una vez.
export function buildEnvelope(buckets = 420): Promise<Float32Array | null> {
  const el = getAudioEl();
  if (!el) return Promise.resolve(null);
  const src = el.currentSrc || el.src;
  if (!src) return Promise.resolve(null);
  if (envelope && envelopeSrc === src) return Promise.resolve(envelope);
  if (envPromise && envPromiseSrc === src) return envPromise;

  const token = ++envToken;
  envPromiseSrc = src;

  const promise = (async () => {
    const AC: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;

    try {
      const res = await fetch(src);
      const buf = await res.arrayBuffer();
      const ctx = new AC();
      const audioBuf = await ctx.decodeAudioData(buf.slice(0));
      const ch = audioBuf.getChannelData(0);
      const n = audioBuf.length;
      const step = Math.max(1, Math.floor(n / buckets));
      const out = new Float32Array(buckets);
      let max = 0;

      for (let b = 0; b < buckets; b++) {
        const start = b * step;
        const end = Math.min(n, start + step);
        let sum = 0;
        let count = 0;
        for (let i = start; i < end; i += 8) {
          const v = ch[i];
          sum += v * v;
          count++;
        }
        const rms = Math.sqrt(sum / Math.max(1, count));
        out[b] = rms;
        if (rms > max) max = rms;
      }
      if (max > 0) for (let i = 0; i < buckets; i++) out[i] /= max;

      if (token !== envToken) return null;

      envDuration = audioBuf.duration;
      envelope = out;
      envelopeSrc = src;
      try {
        await ctx.close();
      } catch {
        /* ignora */
      }
      return out;
    } catch {
      return null;
    }
  })();

  envPromise = promise;
  promise.then(
    () => {
      if (envPromise === promise) envPromise = null;
    },
    () => {
      if (envPromise === promise) envPromise = null;
    },
  );

  return promise;
}

// Nivel 0..1 en un instante del track (interpolado y suavizado).
// Si el envelope no está listo, usa una curva sintética suave.
export function getLevelAt(time: number): number {
  let target: number;

  if (envelope && envDuration > 0) {
    const pos = (time / envDuration) * envelope.length;
    const i0 = Math.floor(pos) % envelope.length;
    const i1 = (i0 + 1) % envelope.length;
    const t = pos - Math.floor(pos);
    const v = envelope[i0] * (1 - t) + envelope[i1] * t;
    target = Math.pow(v, 0.75);
  } else {
    target = 0.22 + 0.18 * Math.sin(performance.now() / 380);
  }

  level += (target - level) * 0.18;
  return Math.min(1, Math.max(0, level));
}

export function envelopeReady(): boolean {
  return !!envelope;
}
