let audioContext: AudioContext | null = null;
let enabled = false;
let initialized = false;

function readPreference() {
  try {
    return localStorage.getItem('sfx') === 'on';
  } catch {
    return false;
  }
}

function ensureContext() {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

function tone(
  frequency: number,
  duration = 0.08,
  type: OscillatorType = 'sine',
  volume = 0.035,
  delay = 0,
) {
  if (!enabled) return;
  const ctx = ensureContext();
  if (!ctx) return;

  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(40, frequency * 0.72),
    start + duration,
  );

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function blip(index = 0) {
  tone(420 + index * 52, 0.09, 'triangle', 0.028);
  tone(840 + index * 52, 0.06, 'sine', 0.012, 0.018);
}

function impact() {
  tone(90, 0.32, 'sine', 0.07);
  tone(180, 0.18, 'triangle', 0.035, 0.01);
  tone(520, 0.12, 'square', 0.012, 0.03);
}

export function isSfxEnabled() {
  return enabled;
}

export function toggleSfx(force?: boolean) {
  enabled = typeof force === 'boolean' ? force : !enabled;
  try {
    localStorage.setItem('sfx', enabled ? 'on' : 'off');
  } catch {
    /* ignora */
  }
  if (enabled) {
    ensureContext();
    tone(660, 0.06, 'sine', 0.03);
  }
  return enabled;
}

export function playSfx(kind: 'blip' | 'impact' = 'blip', index = 0) {
  if (!enabled) return;
  if (kind === 'impact') impact();
  else blip(index);
}

export function initSfx() {
  if (initialized || typeof window === 'undefined') return () => {};
  initialized = true;
  enabled = readPreference();

  const onChapter = (event: Event) => {
    const detail = (event as CustomEvent<{ index?: number }>).detail;
    blip(detail?.index ?? 0);
  };
  const onImpact = () => impact();

  window.addEventListener('chapter:change', onChapter);
  window.addEventListener('world:pulse', onImpact);

  return () => {
    window.removeEventListener('chapter:change', onChapter);
    window.removeEventListener('world:pulse', onImpact);
    initialized = false;
  };
}
