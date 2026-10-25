import * as THREE from 'three';
import { createTitle } from './title';

interface Palette {
  starA: number;
  starB: number;
  background: number;
  additive: boolean;
  opacity: number;
}

const PALETTES: Record<'dark' | 'light', Palette> = {
  dark: {
    starA: 0xe7e5e4,
    starB: 0xbcc7dd,
    background: 0x0e0e0e,
    additive: true,
    opacity: 0.38,
  },
  light: {
    starA: 0x1a1a1a,
    starB: 0x22304a,
    background: 0xf5f5f0,
    additive: false,
    opacity: 1,
  },
};

const BALL_RADIUS = 6;
const SPIN_SPEED = 0.045;
const MAX_PARALLAX = 0.18;
// Pulso orgánico: la bola respira (escala + opacidad) y oscila muy levemente.
const PULSE_SPEED = 0.55;
const PULSE_SCALE = 0.03;
const PULSE_OPACITY = 0.08;


const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;

  uniform float uPixelRatio;
  uniform float uCenterFloor;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;

    float dist = max(-mv.z, 0.5);
    float size = aSize * uPixelRatio * (12.0 / dist);
    gl_PointSize = clamp(size, uPixelRatio, 5.0 * uPixelRatio);

    // Atenuar estrellas lejanas (profundidad)
    float depthDim = clamp(10.0 / dist, 0.4, 1.0);

    // Atenuar el centro de pantalla para no perder el texto
    vec2 sc = gl_Position.xy / max(gl_Position.w, 0.0001);
    float centerDim = mix(uCenterFloor, 1.0, smoothstep(0.1, 0.8, length(sc)));

    vColor = aColor;
    vAlpha = depthDim * centerDim;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float a = smoothstep(0.5, 0.25, d);
    vec3 col = pow(vColor, vec3(0.4545));
    gl_FragColor = vec4(col, a * vAlpha * uOpacity);
  }
`;

export interface StarfieldController {
  updateTheme(light: boolean): void;
  destroy(): void;
}

export function initStarfield(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  onTitleResize?: (box: { top: number; bottom: number; height: number }) => void,
): StarfieldController {
  const isMobile = window.innerWidth < 768;
  const lowQuality =
    isMobile || (navigator.hardwareConcurrency ?? 8) <= 4;
  const count = isMobile ? 400 : lowQuality ? 550 : 800;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  const starGroup = new THREE.Group();
  scene.add(starGroup);

  // ── Generación: bola sólida densa al centro (estilo Golytics) ─
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const jitter = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const r = BALL_RADIUS * Math.cbrt(Math.random());
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);

    sizes[i] = 0.7 + Math.pow(Math.random(), 3) * 0.9;
    jitter[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  const colorAttr = new THREE.BufferAttribute(colors, 3);
  colorAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', colorAttr);
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), BALL_RADIUS);

  const uniforms = {
    uPixelRatio: { value: renderer.getPixelRatio() },
    uOpacity: { value: 1 },
    uCenterFloor: { value: 0.25 },
  };

  const starMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: false,
    depthWrite: false,
    depthTest: false,
  });

  const stars = new THREE.Points(geometry, starMaterial);
  stars.frustumCulled = false;
  starGroup.add(stars);

  // ── Colores según tema ──────────────────────────────────────
  const colorA = new THREE.Color();
  const colorB = new THREE.Color();
  const tintCool = new THREE.Color(0x3b5bdb);
  const tintWarm = new THREE.Color(0xff9a6b);
  const mixedColor = new THREE.Color();
  const backgroundColor = new THREE.Color();
  let currentIsLight = document.documentElement.classList.contains('light');
  let baseOpacity = PALETTES.dark.opacity;

  function applyColors(light: boolean) {
    const p = light ? PALETTES.light : PALETTES.dark;
    colorA.setHex(p.starA);
    colorB.setHex(p.starB);
    backgroundColor.setHex(p.background);

    for (let i = 0; i < count; i++) {
      // Sesgo hacia el gris azulado (starB) para que no quede tan blanco
      const t = Math.pow(jitter[i], 0.6);
      mixedColor.copy(colorA).lerp(colorB, t);
      // Tinte cromático muy sutil: frío hacia un extremo, cálido hacia el otro.
      const coolMix = Math.max(0, 1 - t * 2.2) * 0.12;
      const warmMix = Math.max(0, (t - 0.7) / 0.3) * 0.1;
      mixedColor.lerp(tintCool, coolMix);
      mixedColor.lerp(tintWarm, warmMix);
      const i3 = i * 3;
      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;
    }
    colorAttr.needsUpdate = true;

    // Las estrellas van en la pasada opaca para que el vidrio del título
    // las refracte (el buffer de transmisión sólo toma objetos opacos).
    if (p.additive) {
      starMaterial.blending = THREE.AdditiveBlending;
    } else {
      starMaterial.blending = THREE.CustomBlending;
      starMaterial.blendSrc = THREE.SrcAlphaFactor;
      starMaterial.blendDst = THREE.OneMinusSrcAlphaFactor;
      starMaterial.blendSrcAlpha = THREE.OneFactor;
      starMaterial.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    }

    uniforms.uOpacity.value = p.opacity;
    baseOpacity = p.opacity;
    uniforms.uCenterFloor.value = light ? 0.55 : 0.25;
    starMaterial.needsUpdate = true;

    // Fondo propio de la escena: el vidrio necesita algo detrás que refractar
    scene.background = backgroundColor;
    title.setTheme(light);
    currentIsLight = light;
  }

  // ── Resize (cámara fija estilo Golytics, solo aspecto) ──────
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uPixelRatio.value = renderer.getPixelRatio();
    title.setSize(w, h);
  }

  // ── Estado del cursor (solo parallax de cámara) ─────────────
  const ndc = new THREE.Vector2();

  function onMouseMove(e: MouseEvent) {
    const rect = container.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onMouseLeave() {
    ndc.set(0, 0);
  }

  container.addEventListener('mousemove', onMouseMove);
  container.addEventListener('mouseleave', onMouseLeave);

  // ── Pausa fuera de pantalla ─────────────────────────────────
  let inView = true;
  const io = new IntersectionObserver(
    (entries) => {
      inView = entries.some((en) => en.isIntersecting);
    },
    { threshold: 0 },
  );
  io.observe(container);

  // ── Animación ───────────────────────────────────────────────
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastTime = performance.now();
  let elapsed = 0;

  function frame(time: number) {
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    if (!inView || document.hidden) return;

    if (!reduceMotion) {
      starGroup.rotation.y += SPIN_SPEED * dt;
      elapsed += dt;

      // Pulso orgánico: respiración lenta (escala) + oscilación de órbita muy
      // leve + fluctuación de opacidad. Sutil, para dar vida sin distraer.
      const pulse = Math.sin(elapsed * PULSE_SPEED);
      starGroup.scale.setScalar(1 + pulse * PULSE_SCALE);
      starGroup.rotation.x = Math.sin(elapsed * PULSE_SPEED * 0.6) * 0.05;
      uniforms.uOpacity.value = baseOpacity * (1 + pulse * PULSE_OPACITY);
    }

    // Parallax suave de la cámara siguiendo el mouse
    camera.position.x += (ndc.x * MAX_PARALLAX - camera.position.x) * 0.04;
    camera.position.y += (ndc.y * MAX_PARALLAX - camera.position.y) * 0.04;

    title.update(dt, ndc);
    title.render();
  }

  const title = createTitle({ scene, camera, renderer, isMobile, lowQuality, reduceMotion, onResize: onTitleResize });

  const ro = new ResizeObserver(() => resize());
  ro.observe(container);

  resize();
  applyColors(currentIsLight);

  // El título 3D espera a que el loader libere la página (loader:done) para
  // animarse a la vista. Si no hay loader activo, arranca de inmediato.
  let introStarted = false;
  const startTitleIntro = () => {
    if (introStarted) return;
    introStarted = true;
    title.playIntro();
  };
  const loaderEl = document.getElementById('loader');
  if (!loaderEl || loaderEl.style.display === 'none') {
    startTitleIntro();
  } else {
    window.addEventListener('loader:done', startTitleIntro, { once: true });
  }

  renderer.setAnimationLoop(frame);

  function cleanup() {
    renderer.setAnimationLoop(null);
    window.removeEventListener('loader:done', startTitleIntro);
    container.removeEventListener('mousemove', onMouseMove);
    container.removeEventListener('mouseleave', onMouseLeave);
    ro.disconnect();
    io.disconnect();
    geometry.dispose();
    starMaterial.dispose();
    title.dispose();
    renderer.dispose();
  }

  return {
    updateTheme(light: boolean) {
      if (light !== currentIsLight) applyColors(light);
    },
    destroy: cleanup,
  };
}
