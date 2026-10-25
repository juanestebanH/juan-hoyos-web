import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Color por sección — ajusta los IDs a los tuyos
const SECTION_COLORS: Record<string, string> = {
  inicio: '#ffffff',
  tecnologias: '#7b6ef5', // tu primary
  proyectos: '#5dcaa5', // teal
  experiencia: '#ef9f27', // amber
  'sobre-mi': '#ff8a6b', // coral
  contacto: '#4dc9e6', // cyan
};

const SECTION_META: Record<
  'es' | 'en',
  Record<string, { index: string; label: string }>
> = {
  es: {
    inicio: { index: 'S-01', label: 'Inicio' },
    tecnologias: { index: 'S-02', label: 'Tecnologías' },
    proyectos: { index: 'S-03', label: 'Proyectos' },
    experiencia: { index: 'S-04', label: 'Experiencia' },
    'sobre-mi': { index: 'S-05', label: 'Sobre mí' },
    contacto: { index: 'S-06', label: 'Contacto' },
  },
  en: {
    inicio: { index: 'S-01', label: 'Start' },
    tecnologias: { index: 'S-02', label: 'Technologies' },
    proyectos: { index: 'S-03', label: 'Projects' },
    experiencia: { index: 'S-04', label: 'Experience' },
    'sobre-mi': { index: 'S-05', label: 'About' },
    contacto: { index: 'S-06', label: 'Contact' },
  },
};

const TRAIL_LENGTH = 40;
const IDLE_DELAY = 150; // ms sin scrollear para empezar a vaciar la estela
const FADE_STEP = 30; // ms entre punto retirado
const EDGE_FADE = 140; // px de desvanecido del HUD junto a los bordes
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

interface TrailPoint {
  x: number;
  y: number;
}

interface Ping {
  x: number;
  y: number;
  life: number;
  color: string;
}

let inited = false;

export function initViajero(): () => void {
  const container = document.querySelector(
    '.container-viajero',
  ) as HTMLElement | null;
  const viajero = document.getElementById('viajero') as HTMLElement | null;
  const canvas = document.getElementById(
    'trail-canvas',
  ) as HTMLCanvasElement | null;
  const hud = document.querySelector('.viajero-hud') as HTMLElement | null;
  const hudScope = hud?.querySelector('.vh-scope') as HTMLElement | null;
  const hudIndex = hud?.querySelector('.vh-index') as HTMLElement | null;
  const hudLabel = hud?.querySelector('.vh-label') as HTMLElement | null;
  const hudCoords = hud?.querySelector('.vh-coords') as HTMLElement | null;
  const hudBar = hud?.querySelector('.vh-bar i') as HTMLElement | null;

  if (!container || !viajero || !canvas) return () => {};
  if (inited) return () => {};
  inited = true;

  // Accesibilidad / táctil: sin cinta, sin latido, sin HUD
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (reduce || coarse) {
    container.style.display = 'none';
    inited = false;
    return () => {};
  }

  const lang: 'es' | 'en' = hud?.dataset.lang === 'en' ? 'en' : 'es';
  const meta = SECTION_META[lang];

  const ctx = canvas.getContext('2d')!;

  // ── Lienzo a resolución nativa (nítido en pantallas retina) ──
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas!.width = Math.round(window.innerWidth * dpr);
    canvas!.height = Math.round(window.innerHeight * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // ── Color: helpers ──────────────────────────────────────
  function hexToRgb(hex: string) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }

  function lerpColor(a: string, b: string, t: number): string {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    const r = Math.round(ca.r + (cb.r - ca.r) * t);
    const g = Math.round(ca.g + (cb.g - ca.g) * t);
    const b_ = Math.round(ca.b + (cb.b - ca.b) * t);
    return `#${r.toString(16).padStart(2, '0')}${g
      .toString(16)
      .padStart(2, '0')}${b_.toString(16).padStart(2, '0')}`;
  }

  function toRgba(color: string, alpha: number): string {
    if (!color.startsWith('#') || color.length < 7) {
      return `rgba(255,255,255,${alpha})`;
    }
    const { r, g, b } = hexToRgb(color);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // Blanco puro se pierde sobre el fondo del modo claro
  function themeColor(hex: string): string {
    const light = document.documentElement.classList.contains('light');
    return light && hex.toLowerCase() === '#ffffff' ? '#1a1a1a' : hex;
  }

  // ── Estado de la estela ─────────────────────────────────
  const trail: TrailPoint[] = [];
  const pings: Ping[] = [];
  let currentColor = themeColor(SECTION_COLORS.inicio);
  let targetColor = currentColor;
  let activeId = 'inicio';
  let hudOpacity = 0;
  let headX = 0;
  let headY = 0;
  let animFrame = 0;
  let scrambleId: ReturnType<typeof setInterval> | undefined;

  // ── Sección activa ──────────────────────────────────────
  let projectAccent: string | null = null;
  const onAccent = (e: Event) => {
    projectAccent = (e as CustomEvent).detail as string;
  };
  window.addEventListener('project:accent', onAccent);

  function getActiveSection(): {
    id: string;
    color: string;
    progress: number;
  } {
    const vh = window.innerHeight;
    for (const id of Object.keys(SECTION_COLORS)) {
      const el = document.getElementById(id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top <= vh * 0.5 && rect.bottom >= vh * 0.5) {
        const progress = Math.min(
          1,
          Math.max(0, (vh * 0.5 - rect.top) / rect.height),
        );
        const raw =
          id === 'proyectos' && projectAccent
            ? projectAccent
            : SECTION_COLORS[id];
        return { id, color: themeColor(raw), progress };
      }
    }
    return {
      id: 'inicio',
      color: themeColor(SECTION_COLORS.inicio),
      progress: 0,
    };
  }

  function scrambleLabel(text: string) {
    if (!hudLabel) return;
    if (scrambleId) clearInterval(scrambleId);
    let frame = 0;
    hudLabel.textContent = text;
    scrambleId = setInterval(() => {
      frame++;
      if (frame >= 3) {
        if (scrambleId) clearInterval(scrambleId);
        scrambleId = undefined;
        hudLabel.textContent = text;
        return;
      }
      hudLabel.textContent = text
        .split('')
        .map((ch) =>
          ch === ' '
            ? ch
            : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)],
        )
        .join('');
    }, 45);
  }

  function lockOn() {
    if (!hudScope) return;
    gsap.killTweensOf(hudScope);
    gsap.fromTo(
      hudScope,
      { scale: 0.92 },
      { scale: 1, duration: 0.35, ease: 'power3.out', overwrite: true },
    );
  }

  let lastSectionColor = '';
  let lastBarPct = -1;

  function applySection() {
    const active = getActiveSection();
    targetColor = active.color;

    if (hud && active.color !== lastSectionColor) {
      hud.style.setProperty('--vh-section', active.color);
      lastSectionColor = active.color;
    }
    const pct = Math.round(active.progress * 100);
    if (hudBar && pct !== lastBarPct) {
      hudBar.style.width = `${pct}%`;
      lastBarPct = pct;
    }

    if (active.id !== activeId) {
      activeId = active.id;
      const info = meta[active.id] ?? meta.inicio;
      if (hudIndex) hudIndex.textContent = info.index;
      scrambleLabel(info.label);
      lockOn();
      pings.push({ x: headX, y: headY, life: 0, color: active.color });
    }

    // Color de sección para el cursor (gota líquida)
    window.dispatchEvent(
      new CustomEvent('viajero:section', { detail: active.color }),
    );
    return active;
  }

  // ── HUD: posición, coordenadas y opacidad ───────────────
  function pad(n: number, len: number) {
    return String(Math.max(0, Math.round(n))).padStart(len, '0');
  }

  let lastCoords = '';
  function updateHud(cx: number, cy: number, yDoc: number) {
    headX = cx;
    headY = cy;
    if (hud) gsap.set(hud, { x: cx, y: cy });
    if (hudCoords) {
      const text = `x ${pad(cx, 4)} · y ${pad(yDoc, 5)}`;
      if (text !== lastCoords) {
        hudCoords.textContent = text;
        lastCoords = text;
      }
    }
  }

  // ── Pulso "latido" cuando no scrollea ──────────────────
  const pulseAnim = gsap.to(viajero!, {
    scale: 1.4,
    opacity: 0.65,
    duration: 1.1,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
    paused: false,
  });

  let scrollTimeout: ReturnType<typeof setTimeout> | undefined;
  let fadeInterval: ReturnType<typeof setInterval> | undefined;

  function onScrollActivity() {
    pulseAnim.pause();
    clearTimeout(scrollTimeout);
    if (fadeInterval) {
      clearInterval(fadeInterval);
      fadeInterval = undefined;
    }
    scrollTimeout = setTimeout(() => {
      // Al parar: vaciar la estela gradualmente y reanudar pulso
      fadeInterval = setInterval(() => {
        trail.shift();
        if (trail.length === 0 && fadeInterval) {
          clearInterval(fadeInterval);
          fadeInterval = undefined;
        }
      }, FADE_STEP);
      pulseAnim.play();
    }, IDLE_DELAY);
  }

  // ── Render: traza de datos, pings y opacidad del HUD ───
  function drawScene() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Interpolar color suavemente
    currentColor = lerpColor(currentColor, targetColor, 0.06);

    // Traza de datos: puntos pequeños con opacidad creciente
    for (let i = 1; i < trail.length; i++) {
      const t = i / trail.length;
      const alpha = t * 0.5;
      const size = 0.8 + t * 1.6;

      ctx.beginPath();
      ctx.arc(trail[i].x, trail[i].y, size, 0, Math.PI * 2);
      ctx.fillStyle = toRgba(currentColor, alpha);
      ctx.fill();
    }

    // Ping: anillo que se expande al cambiar de sección
    for (let i = pings.length - 1; i >= 0; i--) {
      const ping = pings[i];
      ping.life += 0.028;
      if (ping.life >= 1) {
        pings.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(ping.x, ping.y, 10 + ping.life * 76, 0, Math.PI * 2);
      ctx.strokeStyle = toRgba(ping.color, (1 - ping.life) * 0.32);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Opacidad: se desvanece en Proyectos y junto a los bordes
    const vh = window.innerHeight;
    const edge = Math.min(
      1,
      Math.max(0, headY / EDGE_FADE),
      Math.max(0, (vh - headY) / EDGE_FADE),
    );
    const target = activeId === 'proyectos' ? 0 : edge;
    hudOpacity += (target - hudOpacity) * 0.12;
    if (hud) hud.style.opacity = hudOpacity.toFixed(3);

    animFrame = requestAnimationFrame(drawScene);
  }

  drawScene();

  // ── ScrollTrigger principal ─────────────────────────────
  const viajeroST = ScrollTrigger.create({
    trigger: 'body',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.8,
    onUpdate: (self) => {
      const p = self.progress;

      // Coordenadas en el DOCUMENTO (no viewport)
      const docH = document.documentElement.scrollHeight;
      const amplitud = window.innerWidth * 0.75;
      const offset = (window.innerWidth - amplitud) / 2;
      const xDoc = offset + (Math.sin(p * Math.PI * 4) + 1) * (amplitud / 2);
      const yDoc = p * docH;
      const yViewport = yDoc - window.scrollY;

      // Nodo y HUD comparten centro (el nodo mide 10px)
      gsap.set(viajero!, { x: xDoc, y: yViewport });
      updateHud(xDoc + 5, yViewport + 5, yDoc + 5);

      // Agregar a la traza (un solo push por actualización)
      trail.push({ x: xDoc + 5, y: yViewport + 5 });
      if (trail.length > TRAIL_LENGTH) trail.shift();

      // Color, progreso y transición de sección
      applySection();

      // Latido: parar al scrollear, vaciar estela al detenerse
      onScrollActivity();
    },
  });

  // Posición inicial del nodo y del HUD
  const p0 = viajeroST.progress;
  const docH0 = document.documentElement.scrollHeight;
  const amp0 = window.innerWidth * 0.75;
  const off0 = (window.innerWidth - amp0) / 2;
  const x0 = off0 + (Math.sin(p0 * Math.PI * 4) + 1) * (amp0 / 2);
  const y0 = p0 * docH0 - window.scrollY;
  gsap.set(viajero!, { x: x0, y: y0 });
  updateHud(x0 + 5, y0 + 5, p0 * docH0 + 5);
  applySection();

  function teardown() {
    cancelAnimationFrame(animFrame);
    clearTimeout(scrollTimeout);
    if (fadeInterval) clearInterval(fadeInterval);
    if (scrambleId) clearInterval(scrambleId);
    window.removeEventListener('resize', resizeCanvas);
    window.removeEventListener('project:accent', onAccent);
    viajeroST.kill();
    pulseAnim.kill();
    if (hud) gsap.killTweensOf(hud);
    if (hudScope) gsap.killTweensOf(hudScope);
    trail.length = 0;
    pings.length = 0;
    inited = false;
  }

  // Cleanup en navegación de Astro
  document.addEventListener('astro:before-swap', teardown, { once: true });

  return teardown;
}
