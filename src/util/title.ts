import * as THREE from 'three';
import gsap from 'gsap';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import shapeData from '../assets/title-shapes.json';

// ── Ajustes visuales del título (todo lo afinable vive aquí) ──
const TITLE_Y = 1.3;
const TITLE_Z = 1;
const TITLE_WIDTH_RATIO = 0.58;
const EXTRUDE_DEPTH = 0.24;
const BEVEL_THICKNESS = 0.055;
const BEVEL_SIZE = 0.035;
const BEVEL_SEGMENTS = 4;
const CURVE_SEGMENTS = 16;
const LETTER_SPACING = -0.012;

const BLOOM_RADIUS = 0.4;

// Inclinación sutil + deriva idle del título
const TILT_X = -0.06;
const IDLE_SWAY = 0.02;
const IDLE_SPEED = 0.45;

interface Palette {
  color: number;
  attenuation: number;
  attenuationDistance: number;
  dispersion: number;
  roughness: number;
  transmission: number;
  envMapIntensity: number;
  bloom: number;
  bloomThreshold: number;
  key: number;
  rim: number;
  point: number;
  shadowOpacity: number;
}

const PALETTES: Record<'dark' | 'light', Palette> = {
  dark: {
    color: 0x9aa3b1,
    attenuation: 0x38424f,
    attenuationDistance: 2.4,
    dispersion: 0.6,
    roughness: 0.1,
    transmission: 1,
    envMapIntensity: 0.42,
    bloom: 0.1,
    bloomThreshold: 0.96,
    key: 0.9,
    rim: 0.45,
    point: 6,
    shadowOpacity: 0.3,
  },
  light: {
    color: 0x6e7c96,
    attenuation: 0x9aa3b5,
    attenuationDistance: 1.5,
    dispersion: 0.4,
    roughness: 0.14,
    transmission: 1,
    envMapIntensity: 0.4,
    bloom: 0.08,
    bloomThreshold: 0.97,
    key: 1.2,
    rim: 0.55,
    point: 6,
    shadowOpacity: 0.1,
  },
};

interface Curve {
  t: 'M' | 'L' | 'Q' | 'C' | 'Z';
  x: number;
  y: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

interface Contour {
  curves: Curve[];
}

interface GlyphData {
  char: string;
  advance: number;
  contours: Contour[];
}

interface ShapeData {
  text: string;
  unitsPerEm: number;
  glyphs: GlyphData[];
}

export interface TitleController {
  group: THREE.Group;
  setTheme(light: boolean): void;
  setSize(width: number, height: number): void;
  update(dt: number, ndc: THREE.Vector2): void;
  playIntro(): void;
  render(): void;
  dispose(): void;
}

function appendContour(path: THREE.Path, contour: Contour, offsetX: number) {
  for (const c of contour.curves) {
    if (c.t === 'M') {
      path.moveTo(offsetX + c.x, c.y);
    } else if (c.t === 'L') {
      path.lineTo(offsetX + c.x, c.y);
    } else if (c.t === 'Q') {
      path.quadraticCurveTo(offsetX + c.x1!, c.y1!, offsetX + c.x, c.y);
    } else if (c.t === 'C') {
      path.bezierCurveTo(
        offsetX + c.x1!,
        c.y1!,
        offsetX + c.x2!,
        c.y2!,
        offsetX + c.x,
        c.y,
      );
    } else {
      path.closePath();
    }
  }
}

function buildTitleGeometry(data: ShapeData): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  let penX = 0;

  for (const glyph of data.glyphs) {
    if (glyph.contours.length) {
      const [outer, ...holes] = glyph.contours;
      const shape = new THREE.Shape();
      appendContour(shape, outer, penX);
      shape.holes = holes.map((contour) => {
        const hole = new THREE.Path();
        appendContour(hole, contour, penX);
        return hole;
      });

      pieces.push(
        new THREE.ExtrudeGeometry(shape, {
          depth: EXTRUDE_DEPTH,
          steps: 1,
          curveSegments: CURVE_SEGMENTS,
          bevelEnabled: true,
          bevelThickness: BEVEL_THICKNESS,
          bevelSize: BEVEL_SIZE,
          bevelOffset: 0,
          bevelSegments: BEVEL_SEGMENTS,
        }),
      );
    }
    penX += glyph.advance + LETTER_SPACING;
  }

  const geometry = mergeGeometries(pieces, false);
  pieces.forEach((piece) => piece.dispose());
  if (!geometry) return new THREE.BufferGeometry();

  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  geometry.translate(
    -(box.min.x + box.max.x) / 2,
    -(box.min.y + box.max.y) / 2,
    -(box.min.z + box.max.z) / 2,
  );
  return geometry;
}

// Entorno procedural: gradiente vertical + manchas de color para que el vidrio
// muestre reflejos cromáticos (estilo "retro glass") en vez de un estudio gris.
function createEnvTexture(light: boolean): THREE.Texture {  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  if (light) {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, '#e7ebf2');
    grad.addColorStop(1, '#c6cfdd');
  } else {
    grad.addColorStop(0, '#3b4250');
    grad.addColorStop(0.55, '#1e232b');
    grad.addColorStop(1, '#0b0d11');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const blob = (nx: number, ny: number, r: number, color: string, a: number) => {
    const x = nx * canvas.width;
    const y = ny * canvas.height;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, color);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  };

  // Acento frío, acento cálido y una banda de brillo alta
  blob(0.22, 0.32, 130, light ? '#4a6fb5' : '#5b8cff', light ? 0.35 : 0.55);
  blob(0.78, 0.68, 120, light ? '#d98a63' : '#ff9a6b', light ? 0.28 : 0.4);
  blob(0.55, 0.12, 100, '#ffffff', light ? 0.55 : 0.7);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Sombra de contacto suave (elipse radial) para "asentar" el título.
function createShadowTexture(): THREE.Texture {
  const s = 256;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.95)');
  g.addColorStop(0.25, 'rgba(0,0,0,0.72)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.45)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.22)');
  g.addColorStop(0.85, 'rgba(0,0,0,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(canvas);
}

export interface TitleOptions {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  isMobile: boolean;
  lowQuality?: boolean;
  reduceMotion: boolean;
  onResize?: (box: { top: number; bottom: number; height: number }) => void;
}

export function createTitle({
  scene,
  camera,
  renderer,
  isMobile,
  lowQuality,
  reduceMotion,
  onResize,
}: TitleOptions): TitleController {
  const reduced = lowQuality ?? isMobile;  const geometry = buildTitleGeometry(shapeData as ShapeData);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const emWidth = box.max.x - box.min.x || 1;
  const emHeight = box.max.y - box.min.y || 1;

  // El vidrio se renderiza igual en todos los dispositivos. En equipos de gama
  // baja sólo se baja la resolución del buffer de transmisión para cuidar FPS.
  renderer.transmissionResolutionScale = reduced ? 0.5 : 1;

  const material = new THREE.MeshPhysicalMaterial({
    color: PALETTES.dark.color,
    metalness: 0,
    roughness: PALETTES.dark.roughness,
    transmission: 0.001,
    thickness: reduced ? 0.5 : 0.65,
    ior: 1.45,
    dispersion: PALETTES.dark.dispersion,
    iridescence: 0.65,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [120, 420],
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
    envMapIntensity: PALETTES.dark.envMapIntensity,
    transparent: false,
    opacity: 1,
    side: THREE.FrontSide,
  });
  material.attenuationColor.setHex(PALETTES.dark.attenuation);
  material.attenuationDistance = PALETTES.dark.attenuationDistance;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;

  const inner = new THREE.Group();
  inner.add(mesh);

  const group = new THREE.Group();
  group.position.set(0, TITLE_Y, TITLE_Z);
  group.add(inner);
  scene.add(group);

  // ── Luces + entorno (solo afectan al material físico del título) ──
  const keyLight = new THREE.DirectionalLight(0xffffff, PALETTES.dark.key);
  keyLight.position.set(2.5, 3.5, 4);
  const rimLight = new THREE.DirectionalLight(0xffffff, PALETTES.dark.rim);
  rimLight.position.set(-3, -1.5, -2.5);
  const pointLight = new THREE.PointLight(0xffffff, PALETTES.dark.point, 25, 2);
  pointLight.position.set(0, 0.4, 3.5);
  scene.add(keyLight, rimLight, pointLight);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexDark = createEnvTexture(false);
  const envTexLight = createEnvTexture(true);
  const envRTDark = pmrem.fromEquirectangular(envTexDark);
  const envRTLight = pmrem.fromEquirectangular(envTexLight);
  envTexDark.dispose();
  envTexLight.dispose();
  pmrem.dispose();
  scene.environment = envRTDark.texture;

  // ── Sombra de contacto (elipse suave bajo el texto) ─────────
  const shadowTexture = createShadowTexture();
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity: PALETTES.dark.shadowOpacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMaterial);
  shadow.position.set(0, box.min.y - emHeight * 0.06, -0.05);
  shadow.scale.set(emWidth * 0.85, emWidth * 0.22, 1);
  group.add(shadow);

  // ── Post-proceso: glow de bordes (no en gama baja) ──
  let composer: EffectComposer | null = null;
  let bloom: UnrealBloomPass | null = null;
  if (!reduced) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      PALETTES.dark.bloom,
      BLOOM_RADIUS,
      PALETTES.dark.bloomThreshold,
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  let isLight = false;
  let disposed = false;
  let elapsed = 0;
  const viewport = new THREE.Vector2();

  function fit() {
    renderer.getSize(viewport);
    const aspect = viewport.x / viewport.y || 1;
    const dist = camera.position.z - TITLE_Z;
    const halfV = Math.tan((camera.fov * Math.PI) / 360);
    const worldWidth = 2 * halfV * dist * aspect;
    const ratio =
      viewport.x <= 640 ? 0.9 : viewport.x <= 1024 ? 0.72 : TITLE_WIDTH_RATIO;
    group.scale.setScalar((worldWidth * ratio) / emWidth);
    reportLayout();
  }

  // Convierte el alto del título a píxeles CSS y lo reporta al exterior para
  // que el contenido DOM reserve espacio exacto y nunca se solapen.
  function reportLayout() {
    if (!onResize) return;
    renderer.getSize(viewport);
    if (!viewport.y) return;
    const worldH = emHeight * group.scale.x;
    const halfV = Math.tan((camera.fov * Math.PI) / 360) * (camera.position.z - TITLE_Z);
    const pxPerWorld = viewport.y / (2 * halfV);
    const centerPx = viewport.y / 2 - (TITLE_Y - camera.position.y) * pxPerWorld;
    const height = worldH * pxPerWorld;
    onResize({
      top: centerPx - height / 2,
      bottom: centerPx + height / 2,
      height,
    });
  }

  function applyPalette(light: boolean) {
    const p = light ? PALETTES.light : PALETTES.dark;
    isLight = light;
    material.color.setHex(p.color);
    material.roughness = p.roughness;
    material.transmission = p.transmission;
    material.envMapIntensity = p.envMapIntensity;
    material.dispersion = p.dispersion;
    material.attenuationColor.setHex(p.attenuation);
    material.attenuationDistance = p.attenuationDistance;
    keyLight.intensity = p.key;
    rimLight.intensity = p.rim;
    pointLight.intensity = p.point;
    scene.environment = light ? envRTLight.texture : envRTDark.texture;
    shadowMaterial.opacity = p.shadowOpacity;
    if (bloom) {
      bloom.strength = p.bloom;
      bloom.threshold = p.bloomThreshold;
    }
    material.needsUpdate = true;
  }

  function setTheme(light: boolean) {
    if (light !== isLight) applyPalette(light);
  }

  function setSize(width: number, height: number) {
    composer?.setSize(width, height);
    bloom?.setSize(width, height);
    fit();
  }

  function update(dt: number, ndc: THREE.Vector2) {
    elapsed += dt;
    const sway = reduceMotion ? 0 : Math.sin(elapsed * IDLE_SPEED) * IDLE_SWAY;
    inner.rotation.y += (ndc.x * 0.4 + sway - inner.rotation.y) * 0.06;
    inner.rotation.x += (TILT_X - ndc.y * 0.25 - inner.rotation.x) * 0.06;
    if (!reduceMotion) inner.position.y = Math.sin(elapsed * 1.2) * 0.06;

    // La cámara apunta siempre al centro del plano del título: el parallax
    // desplaza la escena pero el nombre queda centrado en cualquier pantalla.
    camera.lookAt(0, 0, TITLE_Z);
  }

  function render() {
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  function playIntro() {
    fit();

    if (reduceMotion) {
      inner.scale.setScalar(1);
      material.transmission = (isLight ? PALETTES.light : PALETTES.dark).transmission;
      return;
    }

    inner.scale.setScalar(0.85);
    material.transmission = 0.001;
    if (bloom) bloom.strength = 0;

    gsap.delayedCall(0.5, () => {
      if (disposed) return;
      const p = isLight ? PALETTES.light : PALETTES.dark;
      gsap.to(inner.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 1,
        ease: 'back.out(1.4)',
      });
      const state = { t: material.transmission };
      gsap.to(state, {
        t: p.transmission,
        duration: 0.8,
        ease: 'power2.out',
        onUpdate: () => (material.transmission = state.t),
      });
      if (bloom) {
        const target = { s: 0 };
        gsap.to(target, {
          s: p.bloom,
          duration: 0.9,
          ease: 'power2.out',
          onUpdate: () => (bloom!.strength = target.s),
        });
      }
    });
  }

  function dispose() {
    disposed = true;
    gsap.killTweensOf(inner.scale);
    scene.remove(group, keyLight, rimLight, pointLight);
    scene.environment = null;
    geometry.dispose();
    material.dispose();
    shadow.geometry.dispose();
    shadowMaterial.dispose();
    shadowTexture.dispose();
    envRTDark.dispose();
    envRTLight.dispose();
    composer?.dispose();
    bloom?.dispose();
  }

  return {
    group,
    setTheme,
    setSize,
    update,
    playIntro,
    render,
    dispose,
  };
}
