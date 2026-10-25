import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform vec2 uPointer;
  uniform float uStrength;
  uniform float uTime;
  uniform float uImageAspect;
  uniform float uPlaneAspect;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;

    // Distancia corregida por aspect respecto al puntero
    vec2 diff = uv - uPointer;
    diff.x *= uPlaneAspect;
    float d = length(diff);

    // Onda que decae con la distancia
    float wave = sin(d * 18.0 - uTime * 2.5) * exp(-d * 5.0);

    vec2 dir = normalize(vec2(diff.x, (uv.y - uPointer.y) * uPlaneAspect) + 0.0001);
    vec2 offset =
      vec2(dir.x / uPlaneAspect, dir.y) * wave * 0.07 * uStrength;

    vec2 tuv = uv + offset;

    // Cover: la textura llena el plano recortando sin deformar
    float s = uImageAspect / uPlaneAspect;
    if (uImageAspect > uPlaneAspect) {
      tuv.x = (tuv.x - 0.5) / s + 0.5;
    } else {
      tuv.y = (tuv.y - 0.5) * s + 0.5;
    }

    gl_FragColor = texture2D(uTexture, tuv);
  }
`;

export interface ProjectDistortion {
  setTexture(url: string): Promise<void>;
  setPointer(x: number, y: number): void;
  setStrength(value: number): void;
  resize(width: number, height: number): void;
  resume(): void;
  pause(): void;
  dispose(): void;
}

export function createProjectDistortion(
  canvas: HTMLCanvasElement,
): ProjectDistortion {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uTexture: { value: null as THREE.Texture | null },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uStrength: { value: 0 },
    uTime: { value: 0 },
    uImageAspect: { value: 1 },
    uPlaneAspect: { value: 1 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
  });

  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const loader = new THREE.TextureLoader();
  let texture: THREE.Texture | null = null;

  const targetPointer = new THREE.Vector2(0.5, 0.5);
  const targetStrength = { value: 0 };

  let raf = 0;
  let active = false;
  let last = performance.now();

  function loop(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    uniforms.uTime.value += dt;

    uniforms.uPointer.value.lerp(targetPointer, 0.12);
    uniforms.uStrength.value +=
      (targetStrength.value - uniforms.uStrength.value) * 0.1;

    renderer.render(scene, camera);

    if (active) raf = requestAnimationFrame(loop);
  }

  function setTexture(url: string) {
    return new Promise<void>((resolve) => {
      loader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.generateMipmaps = false;

        texture?.dispose();
        texture = tex;

        const image = tex.image as { width: number; height: number };
        uniforms.uTexture.value = tex;
        uniforms.uImageAspect.value = image.width / image.height;
        resolve();
      });
    });
  }

  return {
    setTexture,
    setPointer(x, y) {
      targetPointer.set(x, y);
    },
    setStrength(value) {
      targetStrength.value = value;
    },
    resize(width, height) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height, false);
      uniforms.uPlaneAspect.value = width / height;
    },
    resume() {
      if (active) return;
      active = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    pause() {
      active = false;
      cancelAnimationFrame(raf);
      raf = 0;
    },
    dispose() {
      active = false;
      cancelAnimationFrame(raf);
      texture?.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
