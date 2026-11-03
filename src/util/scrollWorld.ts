import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type Lenis from 'lenis';
import { getChapterWeights } from './chapters';

export interface ScrollWorldController {
  destroy: () => void;
  pulse: () => void;
}

interface Palette {
  block: number;
  ambient: number;
  key: number;
  rim: number;
  edge: number;
  edgeStrength: number;
  dust: number;
  fog: number;
}

const PALETTES: Record<'dark' | 'light', Palette> = {
  dark: {
    block: 0x0c0c0e,
    ambient: 0xbcbcbc,
    key: 0xffffff,
    rim: 0xffffff,
    edge: 0xffffff,
    edgeStrength: 0.52,
    dust: 0xffffff,
    fog: 0x050505,
  },
  light: {
    block: 0xd8d0c0,
    ambient: 0xfff8ee,
    key: 0xfff6ea,
    rim: 0xdde9f5,
    edge: 0xa79e8e,
    edgeStrength: 0,
    dust: 0x6a655b,
    fog: 0xf5f5f0,
  },
};

const CAMERA_PRESETS = [
  {
    position: new THREE.Vector3(0, 14, 28),
    look: new THREE.Vector3(0, -2, 0),
  },
  {
    position: new THREE.Vector3(0, 8, 21),
    look: new THREE.Vector3(0, 1, -8),
  },
  {
    position: new THREE.Vector3(11, 19, 23),
    look: new THREE.Vector3(-2, 2, -6),
  },
  {
    position: new THREE.Vector3(0, 22, 18),
    look: new THREE.Vector3(0, 2, -6),
  },
  {
    position: new THREE.Vector3(-11, 16, 24),
    look: new THREE.Vector3(2, 1.5, -7),
  },
  {
    position: new THREE.Vector3(0, 4, 9),
    look: new THREE.Vector3(0, 0, 0),
  },
];

function formationHeight(
  act: number,
  x: number,
  z: number,
  distance: number,
  angle: number,
  columnIndex: number,
  baseY: number,
  maxDistance: number,
) {
  if (act === 0) return baseY;

  if (act === 1) {
    return -2.4 + Math.cos(x * 0.35) * 1.1 + Math.sin(z * 0.2) * 0.6;
  }

  if (act === 2) {
    return columnIndex === 0 || columnIndex === 3
      ? Math.sin(x) * 3 + 2.5
      : baseY;
  }

  if (act === 3) {
    return distance > maxDistance * 0.35 && distance < maxDistance * 0.77
      ? 4.5 + Math.sin(x * 0.5) * 1.5
      : -2;
  }

  const radial = (distance / maxDistance) * 2.84;

  if (act === 4) {
    return 1 + radial + Math.sin(angle * 3 + radial * 3.5) * 1.2;
  }

  return Math.sin(radial * 5) * 4;
}

export function initScrollWorld(
  canvas: HTMLCanvasElement,
  lenis?: Lenis,
): ScrollWorldController | null {
  if (typeof window === 'undefined') return null;

  const reduced = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  const mobile = window.innerWidth < 768;
  const motionScale = reduced ? 0 : mobile ? 0.6 : 1;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !mobile,
      powerPreference: 'high-performance',
    });
  } catch {
    canvas.style.display = 'none';
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTES.dark.fog, 27, 82);
  scene.environmentIntensity = 0.65;

  const environmentCanvas = document.createElement('canvas');
  environmentCanvas.width = 128;
  environmentCanvas.height = 64;
  const environmentContext = environmentCanvas.getContext('2d');
  let environmentTexture: THREE.CanvasTexture | null = null;
  if (environmentContext) {
    const sky = environmentContext.createLinearGradient(
      0,
      0,
      0,
      environmentCanvas.height,
    );
    sky.addColorStop(0, '#fffdf8');
    sky.addColorStop(0.46, '#f1ece1');
    sky.addColorStop(1, '#b8b0a1');
    environmentContext.fillStyle = sky;
    environmentContext.fillRect(
      0,
      0,
      environmentCanvas.width,
      environmentCanvas.height,
    );

    const glow = environmentContext.createRadialGradient(28, 16, 0, 28, 16, 38);
    glow.addColorStop(0, 'rgba(255, 248, 232, 0.95)');
    glow.addColorStop(1, 'rgba(255, 248, 232, 0)');
    environmentContext.fillStyle = glow;
    environmentContext.fillRect(
      0,
      0,
      environmentCanvas.width,
      environmentCanvas.height,
    );

    environmentTexture = new THREE.CanvasTexture(environmentCanvas);
    environmentTexture.mapping = THREE.EquirectangularReflectionMapping;
    environmentTexture.colorSpace = THREE.SRGBColorSpace;
    environmentTexture.needsUpdate = true;
  }

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    200,
  );
  const cameraPosition = CAMERA_PRESETS[0].position.clone();
  const lookTarget = CAMERA_PRESETS[0].look.clone();
  const cameraTargetPosition = new THREE.Vector3();
  const cameraTargetLook = new THREE.Vector3();
  camera.position.copy(cameraPosition);
  camera.lookAt(lookTarget);

  const ambient = new THREE.AmbientLight(PALETTES.dark.ambient, 0.85);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(PALETTES.dark.key, 2.45);
  keyLight.position.set(7, 12, 8);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(PALETTES.dark.rim, 1.15);
  rimLight.position.set(-10, 5, -8);
  scene.add(rimLight);

  const accentLight = new THREE.PointLight(0xffffff, mobile ? 22 : 36, 28, 2);
  accentLight.position.set(0, 4, 0);
  scene.add(accentLight);

  const columns = mobile ? 18 : 34;
  const rows = mobile ? 14 : 22;
  const spacingX = mobile ? 2.25 : 1.82;
  const spacingZ = mobile ? 2.25 : 1.82;
  const count = columns * rows;
  const maxDistance = Math.hypot(
    ((columns - 1) / 2) * spacingX,
    ((rows - 1) / 2) * spacingZ,
  );

  const geometry = new THREE.BoxGeometry(1.34, 1.34, 1.34);
  const lightGeometry = new RoundedBoxGeometry(1.34, 1.34, 1.34, 2, 0.075);
  const edgeUniforms = {
    uEdgeColor: { value: new THREE.Color(PALETTES.dark.edge) },
    uEdgeStrength: { value: PALETTES.dark.edgeStrength },
  };
  const material = new THREE.MeshStandardMaterial({
    color: PALETTES.dark.block,
    roughness: 0.3,
    metalness: 0.8,
    flatShading: true,
    emissive: 0x000000,
    emissiveIntensity: 0.04,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uEdgeColor = edgeUniforms.uEdgeColor;
    shader.uniforms.uEdgeStrength = edgeUniforms.uEdgeStrength;
    shader.fragmentShader = `
      uniform vec3 uEdgeColor;
      uniform float uEdgeStrength;
      ${shader.fragmentShader}
    `;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      float edgeRim = pow(1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0), 2.2);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uEdgeColor, edgeRim * uEdgeStrength);
      #include <dithering_fragment>
      `,
    );
  };
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const dummy = new THREE.Object3D();
  const blocks = Array.from({ length: count }, (_, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x =
      (col - (columns - 1) / 2) * spacingX + (Math.random() - 0.5) * 0.7;
    const z =
      (row - (rows - 1) / 2) * spacingZ + (Math.random() - 0.5) * 0.7;
    const baseY = (Math.random() - 0.5) * 0.4;
    const distance = Math.hypot(x, z);
    const angle = Math.atan2(z, x);
    const columnIndex = Math.floor(Math.abs(x) % 6);
    const height = CAMERA_PRESETS.map((_, act) =>
      formationHeight(
        act,
        x,
        z,
        distance,
        angle,
        columnIndex,
        baseY,
        maxDistance,
      ),
    );

    return {
      x,
      z,
      distance,
      angle,
      height,
      y: height[0],
      scale: 0.58 + Math.random() * 0.7,
      seed: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.35,
      offset: 0,
      velocity: 0,
      rotX: 0,
      rotZ: 0,
      rotVelX: 0,
      rotVelZ: 0,
      cursorRotX: 0,
      cursorRotZ: 0,
      introDelay: 0.12 + (distance / maxDistance) * 0.42 + Math.random() * 0.1,
      introRotX: (Math.random() - 0.5) * 0.42,
      introRotZ: (Math.random() - 0.5) * 0.34,
    };
  });

  const blockTints = blocks.map(() => 0.95 + Math.random() * 0.07);
  const instanceTint = new THREE.Color();

  const dustCount = mobile ? 240 : 420;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    const radius = 14 + Math.random() * 34;
    const angle = Math.random() * Math.PI * 2;
    dustPositions[i * 3] = Math.cos(angle) * radius;
    dustPositions[i * 3 + 1] = -8 + Math.random() * 28;
    dustPositions[i * 3 + 2] = Math.sin(angle) * radius;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(dustPositions, 3),
  );
  const dustMaterial = new THREE.PointsMaterial({
    color: PALETTES.dark.dust,
    size: 0.055,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dust);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(0, 0);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pointerWorld = new THREE.Vector3(9999, 0, 9999);
  const lightTarget = new THREE.Vector3(0, 4, 0);
  let hasPointer = false;

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    hasPointer = true;
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  };
  const onPointerLeave = () => {
    hasPointer = false;
  };
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('blur', onPointerLeave);

  const triggerPulse = () => {
    const originX =
      hasPointer && pointerWorld.x < 999 ? pointerWorld.x : 0;
    const originZ =
      hasPointer && pointerWorld.z < 999 ? pointerWorld.z : 0;

    for (const block of blocks) {
      const dx = block.x - originX;
      const dz = block.z - originZ;
      const distance = Math.hypot(dx, dz);
      if (distance < 18) {
        const falloff = 1 - distance / 18;
        block.velocity += falloff * 4.5 * 1.35;
        block.rotVelX += (Math.random() - 0.5) * 4.5 * 0.14 * falloff;
        block.rotVelZ += (Math.random() - 0.5) * 4.5 * 0.14 * falloff;
      }
    }

    window.dispatchEvent(new CustomEvent('sfx:impact'));
  };

  const onPulse = () => triggerPulse();
  window.addEventListener('world:pulse', onPulse);

  let introStarted = reduced;
  let introActive = false;
  let introElapsed = 0;
  const startIntro = () => {
    if (introStarted) return;
    introStarted = true;
    introActive = true;
    introElapsed = 0;
  };
  window.addEventListener('hero:intro', startIntro);
  const loader = document.getElementById('loader');
  if (!loader || loader.style.display === 'none') startIntro();
  else window.addEventListener('loader:done', startIntro, { once: true });

  let running = true;
  let raf = 0;
  let last = performance.now();
  let time = 0;
  let lenisVelocity = 0;
  let fallbackScrollY = window.scrollY;
  let scrollVelocitySmooth = 0;
  let theme: 'dark' | 'light' =
    document.documentElement.classList.contains('light') ? 'light' : 'dark';

  const smoothWeights = CAMERA_PRESETS.map((_, index) =>
    index === 0 ? 1 : 0,
  );

  const onLenisScroll = (instance: Lenis) => {
    lenisVelocity = instance.velocity ?? 0;
  };
  lenis?.on('scroll', onLenisScroll);

  const applyTheme = (next: 'dark' | 'light') => {
    theme = next;
    const palette = PALETTES[theme];
    const light = theme === 'light';
    const nextGeometry = light ? lightGeometry : geometry;
    if (mesh.geometry !== nextGeometry) mesh.geometry = nextGeometry;
    const nextFlat = !light;
    if (material.flatShading !== nextFlat) {
      material.flatShading = nextFlat;
      material.needsUpdate = true;
    }
    material.color.setHex(palette.block);
    material.emissive.setHex(light ? 0x000000 : 0x080808);
    material.emissiveIntensity = light ? 0 : 0.22;
    material.roughness = light ? 0.62 : 0.3;
    material.metalness = light ? 0.08 : 0.8;
    for (let i = 0; i < blocks.length; i++) {
      const variation = light ? blockTints[i] : 1;
      instanceTint.setRGB(variation, variation, variation);
      mesh.setColorAt(i, instanceTint);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    edgeUniforms.uEdgeColor.value.setHex(palette.edge);
    edgeUniforms.uEdgeStrength.value = palette.edgeStrength;
    scene.environment = light ? environmentTexture : null;
    ambient.color.setHex(palette.ambient);
    ambient.intensity = light ? 0.5 : 0.85;
    keyLight.color.setHex(palette.key);
    keyLight.intensity = light ? 2.15 : 2.45;
    rimLight.color.setHex(palette.rim);
    rimLight.intensity = light ? 0.45 : 1.15;
    dustMaterial.color.setHex(palette.dust);
    dustMaterial.opacity = light ? 0.18 : 0.45;
    dustMaterial.blending = light
      ? THREE.NormalBlending
      : THREE.AdditiveBlending;
    dustMaterial.needsUpdate = true;
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.setHex(palette.fog);
      scene.fog.near = light ? 36 : 27;
      scene.fog.far = light ? 105 : 82;
    }
    renderer.toneMappingExposure = light ? 1 : 1.05;
    accentLight.color.setHex(light ? 0xfff1dd : 0xffffff);
    accentLight.intensity = light ? 9 : mobile ? 22 : 36;
    if (reduced) renderOnce();
  };

  const updateSize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2),
    );
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (reduced) renderOnce();
  };

  const onResize = () => updateSize();
  window.addEventListener('resize', onResize, { passive: true });

  const onVisibility = () => {
    if (!document.hidden) last = performance.now();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const onThemeChange = () => {
    applyTheme(
      document.documentElement.classList.contains('light') ? 'light' : 'dark',
    );
  };
  window.addEventListener('theme:change', onThemeChange);

  function renderOnce() {
    renderer.render(scene, camera);
  }

  const updateWorld = (delta: number) => {
    if (!reduced) time += delta;

    if (introActive) {
      introElapsed += delta;
      if (introElapsed > 2.05) introActive = false;
    }

    const introPending = !introStarted;

    if (!lenis) {
      const scrollY = window.scrollY;
      lenisVelocity = scrollY - fallbackScrollY;
      fallbackScrollY = scrollY;
    }

    const targetSpeed = reduced
      ? 0
      : Math.min(1, Math.abs(lenisVelocity) / 80);
    const speedEase = reduced ? 1 : 1 - Math.exp(-delta * 4);
    scrollVelocitySmooth +=
      (targetSpeed - scrollVelocitySmooth) * speedEase;

    const chapterWeights = getChapterWeights();
    const weightSum = chapterWeights.reduce(
      (sum, weight) => sum + weight,
      0,
    );
    const targetWeights = chapterWeights.map((weight) =>
      weightSum > 0.0001 ? weight / weightSum : 0,
    );
    if (weightSum <= 0.0001) targetWeights[0] = 1;

    const weightEase = reduced ? 1 : 1 - Math.exp(-delta * 8);
    let smoothTotal = 0;
    for (let i = 0; i < smoothWeights.length; i++) {
      smoothWeights[i] +=
        ((targetWeights[i] ?? 0) - smoothWeights[i]) * weightEase;
      smoothTotal += smoothWeights[i];
    }
    if (smoothTotal > 0.0001) {
      for (let i = 0; i < smoothWeights.length; i++) {
        smoothWeights[i] /= smoothTotal;
      }
    }

    cameraTargetPosition.set(0, 0, 0);
    cameraTargetLook.set(0, 0, 0);

    for (let i = 0; i < CAMERA_PRESETS.length; i++) {
      const weight = smoothWeights[i] ?? 0;
      if (weight <= 0) continue;
      cameraTargetPosition.addScaledVector(
        CAMERA_PRESETS[i].position,
        weight,
      );
      cameraTargetLook.addScaledVector(CAMERA_PRESETS[i].look, weight);
    }

    cameraTargetPosition.y += Math.sin(time * 0.35) * 0.12 * motionScale;

    if (!cameraTargetPosition.lengthSq()) {
      cameraTargetPosition.copy(CAMERA_PRESETS[0].position);
    }

    const cameraEase = reduced ? 1 : 1 - Math.exp(-delta * 2.6);
    const lookEase = reduced ? 1 : 1 - Math.exp(-delta * 3.2);
    cameraPosition.lerp(cameraTargetPosition, cameraEase);
    lookTarget.lerp(cameraTargetLook, lookEase);
    camera.position.copy(cameraPosition);
    camera.lookAt(lookTarget);

    pointerWorld.set(9999, 0, 9999);
    let cursorX = 9999;
    let cursorZ = 9999;

    if (hasPointer && !reduced) {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(plane, pointerWorld)) {
        cursorX = pointerWorld.x;
        cursorZ = pointerWorld.z;
      }
    }

    if (cursorX < 999 && cursorZ < 999) {
      lightTarget.set(cursorX, 4.5, cursorZ);
    } else {
      lightTarget.set(
        Math.sin(time * 0.32) * 8,
        4.5,
        Math.cos(time * 0.26) * 9 + 2,
      );
    }
    accentLight.position.lerp(
      lightTarget,
      reduced ? 1 : 1 - Math.exp(-delta * 4),
    );
    accentLight.color.setHex(theme === 'light' ? 0xfff1dd : 0xffffff);
    accentLight.intensity =
      (theme === 'light' ? 9 : mobile ? 22 : 36) *
      (1 + scrollVelocitySmooth * 0.18);

    const waveAmplitude = reduced
      ? 0
      : (0.12 + scrollVelocitySmooth * 0.4) * motionScale;
    const targetEase = reduced ? 1 : 1 - Math.exp(-delta * 5);
    const rotEase = reduced ? 1 : 1 - Math.exp(-delta * 9);
    const cursorEase = reduced ? 1 : 1 - Math.exp(-delta * 8);

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      let morph = 0;
      for (let act = 0; act < smoothWeights.length; act++) {
        const weight = smoothWeights[act] ?? 0;
        if (weight > 0) morph += block.height[act] * weight;
      }

      let cursorPush = 0;
      let targetCursorRotX = 0;
      let targetCursorRotZ = 0;

      if (cursorX < 999 && cursorZ < 999) {
        const dx = block.x - cursorX;
        const dz = block.z - cursorZ;
        const distance = Math.hypot(dx, dz);
        if (distance < 7) {
          const proximity = 1 - distance / 7;
          cursorPush = proximity * 2.4 * motionScale;
          targetCursorRotX = dz * 0.04 * proximity;
          targetCursorRotZ = -dx * 0.04 * proximity;
        }
      }

      block.velocity += (-block.offset * 52 - block.velocity * 6) * delta;
      block.offset += block.velocity * delta;
      block.rotVelX += (-block.rotX * 34 - block.rotVelX * 5) * delta;
      block.rotX += block.rotVelX * delta;
      block.rotVelZ += (-block.rotZ * 34 - block.rotVelZ * 5) * delta;
      block.rotZ += block.rotVelZ * delta;
      block.cursorRotX +=
        (targetCursorRotX - block.cursorRotX) * cursorEase;
      block.cursorRotZ +=
        (targetCursorRotZ - block.cursorRotZ) * cursorEase;

      const wave =
        Math.sin(time * 1.35 + block.seed) * waveAmplitude;
      const targetY = morph + cursorPush + block.offset + wave;
      block.y += (targetY - block.y) * targetEase;

      const introT = introActive
        ? Math.max(
            0,
            Math.min(1, (introElapsed - block.introDelay) / 1.15),
          )
        : 0;
      const introFall = introT * introT * (3 - 2 * introT);
      const introDrop = introPending ? 1 : introActive ? 1 - introFall : 0;
      const introLift = introDrop * (20 + block.scale * 10);

      dummy.position.set(block.x, block.y + introLift, block.z);
      dummy.rotation.set(
        block.cursorRotX + block.rotX + introDrop * block.introRotX,
        block.seed + time * block.spin * 0.08 + introDrop * 0.16,
        block.cursorRotZ + block.rotZ + introDrop * block.introRotZ,
      );
      dummy.scale.setScalar(block.scale * (1 - introDrop * 0.22));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    if (!reduced) {
      dust.rotation.y += delta * 0.015;
      dust.rotation.x = Math.sin(time * 0.1) * 0.025;
    }

    renderer.toneMappingExposure = theme === 'light' ? 1 : 1.05;
  };

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (!running) return;
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (!document.hidden) {
      updateWorld(delta);
      renderer.render(scene, camera);
    }
  };

  applyTheme(theme);
  updateWorld(0);
  renderOnce();

  if (!reduced) {
    raf = requestAnimationFrame(loop);
  }

  const destroy = () => {
    running = false;
    cancelAnimationFrame(raf);
    lenis?.off('scroll', onLenisScroll);
    window.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('blur', onPointerLeave);
    window.removeEventListener('world:pulse', onPulse);
    window.removeEventListener('hero:intro', startIntro);
    window.removeEventListener('loader:done', startIntro);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('theme:change', onThemeChange);
    document.removeEventListener('visibilitychange', onVisibility);
    geometry.dispose();
    lightGeometry.dispose();
    environmentTexture?.dispose();
    material.dispose();
    dustGeometry.dispose();
    dustMaterial.dispose();
    renderer.dispose();
    window.removeEventListener('astro:before-swap', destroy);
  };

  window.addEventListener('astro:before-swap', destroy, { once: true });

  return { destroy, pulse: triggerPulse };
}
