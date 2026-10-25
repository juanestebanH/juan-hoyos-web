import * as THREE from 'three';
import gsap from 'gsap';

interface BlockData {
  mesh: THREE.Mesh;
  originX: number;
  originY: number;
  originZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  rotSpeedX: number;
  rotSpeedY: number;
  rotSpeedZ: number;
  floatSpeed: number;
  phase: number;
}

export interface HeroBlocksController {
  playIntro?(): void;
  updateTheme(light: boolean): void;
  destroy(): void;
}

export function initHeroBlocks(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  onTitleResize?: (box: { top: number; bottom: number; height: number }) => void,
): HeroBlocksController {
  const isMobile = window.innerWidth < 768;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isLight = document.documentElement.classList.contains('light');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(isLight ? 0xf5f5f0 : 0x050505, 0.035);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  const startCamZ = isMobile ? 28 : 26;
  camera.position.set(0, 0, startCamZ);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(ambientLight);

  const cursorLight = new THREE.PointLight(0xffffff, 2.5, 25);
  cursorLight.position.set(0, 0, 8);
  scene.add(cursorLight);

  const rimLightLeft = new THREE.DirectionalLight(0xffffff, 0.8);
  rimLightLeft.position.set(-15, 10, -5);
  scene.add(rimLightLeft);

  const rimLightRight = new THREE.DirectionalLight(0x888888, 0.6);
  rimLightRight.position.set(15, -10, -5);
  scene.add(rimLightRight);

  const blocksGroup = new THREE.Group();
  scene.add(blocksGroup);
  const blocks: BlockData[] = [];

  const whiteBlockMaterial = new THREE.MeshStandardMaterial({
    color: isLight ? 0x1a1a1a : 0xffffff,
    roughness: 0.1,
    metalness: 0.9,
  });
  const blockMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.2, metalness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.1, metalness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.6 }),
    whiteBlockMaterial,
  ];
  const wireframeMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: isLight ? 0.22 : 0.12,
  });

  const numBlocks = isMobile ? 48 : 65;
  for (let i = 0; i < numBlocks; i++) {
    let posX: number, posY: number;
    const side = Math.random();
    if (side < 0.45) {
      posX = -6 - Math.random() * 8;
      posY = (Math.random() - 0.5) * 14;
    } else if (side < 0.9) {
      posX = 6 + Math.random() * 8;
      posY = (Math.random() - 0.5) * 14;
    } else {
      posX = (Math.random() - 0.5) * 20;
      posY = Math.random() > 0.5 ? 5 + Math.random() * 5 : -5 - Math.random() * 5;
    }
    const posZ = (Math.random() - 0.5) * 10 - 2;

    const width = 0.8 + Math.random() * 1.5;
    const height = 0.8 + Math.random() * 1.5;
    const depth = 0.8 + Math.random() * 1.5;

    const boxGeo = new THREE.BoxGeometry(width, height, depth);
    const mat = blockMaterials[Math.floor(Math.random() * blockMaterials.length)];
    const mesh = new THREE.Mesh(boxGeo, mat);

    const edges = new THREE.EdgesGeometry(boxGeo);
    const line = new THREE.LineSegments(edges, wireframeMaterial);
    mesh.add(line);

    mesh.position.set(posX, posY, posZ - (12 + Math.random() * 6));
    mesh.scale.set(0, 0, 0);
    mesh.rotation.x = Math.random() * Math.PI * 2;
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.rotation.z = Math.random() * Math.PI * 2;

    blocks.push({
      mesh,
      originX: posX,
      originY: posY,
      originZ: posZ,
      targetX: posX,
      targetY: posY,
      targetZ: posZ,
      rotSpeedX: (Math.random() - 0.5) * 0.006,
      rotSpeedY: (Math.random() - 0.5) * 0.006,
      rotSpeedZ: (Math.random() - 0.5) * 0.006,
      floatSpeed: 0.8 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
    });
    blocksGroup.add(mesh);
  }

  const raycaster = new THREE.Raycaster();
  const mouseNorm = new THREE.Vector2(-999, -999);
  const mouse3D = new THREE.Vector3();
  const intersectionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  function onPointerMove(e: PointerEvent) {
    mouseNorm.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseNorm.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouseNorm, camera);
    raycaster.ray.intersectPlane(intersectionPlane, mouse3D);
    if (!reduceMotion && !introActive) {
      gsap.to(cursorLight.position, { x: mouse3D.x, y: mouse3D.y, z: 6, duration: 0.5, ease: 'power2.out' });
    } else {
      cursorLight.position.set(mouse3D.x, mouse3D.y, 6);
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (e.touches.length > 0) {
      const t = e.touches[0];
      mouseNorm.x = (t.clientX / window.innerWidth) * 2 - 1;
      mouseNorm.y = -(t.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouseNorm, camera);
      raycaster.ray.intersectPlane(intersectionPlane, mouse3D);
      cursorLight.position.set(mouse3D.x, mouse3D.y, 6);
    }
  }

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('touchmove', onTouchMove, { passive: true });

  let introActive = true;
  let introStarted = false;

  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
    renderer.setSize(w, h, false);
    if (window.innerWidth < 768) camera.position.z = introActive ? 28 : 20;
    else camera.position.z = introActive ? 26 : 16;
    if (onTitleResize) onTitleResize({ top: 0, bottom: 0, height: 0 });
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(container);
  resize();

  let inView = true;
  const io = new IntersectionObserver((entries) => {
    inView = entries.some((en) => en.isIntersecting);
  }, { threshold: 0 });
  io.observe(container);

  function playIntro() {
    if (introStarted) return;
    if (reduceMotion) {
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const mesh = b.mesh;
        mesh.position.set(b.originX, b.originY, b.originZ);
        mesh.scale.set(1, 1, 1);
        mesh.rotation.set(0, 0, 0);
        b.targetX = b.originX;
        b.targetY = b.originY;
        b.targetZ = b.originZ;
      }
      gsap.to(camera.position, { z: isMobile ? 20 : 16, duration: 0.6, ease: 'power2.out' });
      introActive = false;
      introStarted = true;
      return;
    }
    introStarted = true;
    gsap.to(camera.position, { z: isMobile ? 20 : 16, duration: 2.0, ease: 'power3.inOut', delay: 0.2 });
    gsap.to({}, { duration: 2.2, onUpdate: () => camera.lookAt(0, 0, 0) });
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const mesh = b.mesh;
      const delay = Math.random() * 0.4;
      b.targetX = b.originX;
      b.targetY = b.originY;
      b.targetZ = b.originZ;
      gsap.to(mesh.position, { x: b.originX, y: b.originY, z: b.originZ, duration: 1.8, ease: 'power2.out', delay });
      gsap.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 1.6, ease: 'back.out(1.2)', delay });
      gsap.to(mesh.rotation, { x: 0, y: 0, z: 0, duration: 1.8, ease: 'power2.out', delay });
    }
    gsap.delayedCall(2.4, () => { introActive = false; });
  }

  const clock = new THREE.Clock();
  function animate() {
    if (!inView || document.hidden) {
      requestAnimationFrame(animate);
      return;
    }
    const elapsedTime = clock.getElapsedTime();

    if (introActive) {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
      return;
    }

    if (!reduceMotion) {
      blocksGroup.rotation.y += (mouseNorm.x * 0.15 - blocksGroup.rotation.y) * 0.04;
      blocksGroup.rotation.x += (-mouseNorm.y * 0.15 - blocksGroup.rotation.x) * 0.04;
    }

    const radius = 6.0;
    const repulsionForceMultiplier = 2.8;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const block = b.mesh;
      if (reduceMotion) {
        block.position.x += (b.originX - block.position.x) * 0.06;
        block.position.y += (b.originY - block.position.y) * 0.06;
        block.position.z += (b.originZ - block.position.z) * 0.06;
        continue;
      }
      const dist = mouse3D.distanceTo(block.position);
      if (dist < radius) {
        const force = (1 - dist / radius) * repulsionForceMultiplier;
        const dir = block.position.clone().sub(mouse3D).normalize();
        b.targetX = b.originX + dir.x * force * 1.4;
        b.targetY = b.originY + dir.y * force * 1.4;
        b.targetZ = b.originZ + dir.z * force * 2.0;
        block.rotation.x += force * 0.02;
        block.rotation.y += force * 0.02;
      } else {
        b.targetX = b.originX;
        b.targetY = b.originY + Math.sin(elapsedTime * b.floatSpeed + b.phase) * 0.25;
        b.targetZ = b.originZ + Math.cos(elapsedTime * b.floatSpeed * 0.8 + b.phase) * 0.15;
      }
      block.position.x += (b.targetX - block.position.x) * 0.06;
      block.position.y += (b.targetY - block.position.y) * 0.06;
      block.position.z += (b.targetZ - block.position.z) * 0.06;
      block.rotation.x += b.rotSpeedX;
      block.rotation.y += b.rotSpeedY;
      block.rotation.z += b.rotSpeedZ;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  function updateTheme(light: boolean) {
    (scene.fog as THREE.FogExp2).color.setHex(light ? 0xf5f5f0 : 0x050505);
    wireframeMaterial.opacity = light ? 0.22 : 0.12;
    whiteBlockMaterial.color.setHex(light ? 0x1a1a1a : 0xffffff);
  }

  function cleanup() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('touchmove', onTouchMove);
    ro.disconnect();
    io.disconnect();
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const block = b.mesh;
      if (block.geometry) block.geometry.dispose();
      const children = block.children;
      for (let j = 0; j < children.length; j++) {
        const c = children[j] as THREE.Mesh;
        if ((c as any).geometry) (c as any).geometry.dispose();
      }
    }
    for (let i = 0; i < blockMaterials.length; i++) blockMaterials[i].dispose();
    wireframeMaterial.dispose();
    scene.clear();
    renderer.dispose();
    gsap.killTweensOf(cursorLight.position);
  }

  return { playIntro, updateTheme, destroy: cleanup };
}
