import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initChapters } from './chapters';
import { initScrollWorld } from './scrollWorld';
import { initScrollScenes } from './scrollScenes';

gsap.registerPlugin(ScrollTrigger);

let started = false;

export function initPortfolioPage() {
  if (started || typeof window === 'undefined') return;
  started = true;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lenis = new Lenis({
    lerp: reduced ? 1 : 0.08,
    smoothWheel: !reduced,
    wheelMultiplier: 1,
    touchMultiplier: 1.4,
  });
  (window as unknown as { __lenis?: Lenis }).__lenis = lenis;

  const teardownChapters = initChapters();
  const canvas = document.getElementById('world-canvas') as HTMLCanvasElement | null;
  const world = canvas ? initScrollWorld(canvas, lenis) : null;
  const teardownScenes = initScrollScenes(lenis);

  const onScroll = () => ScrollTrigger.update();
  lenis.on('scroll', onScroll);

  const tick = (time: number) => {
    lenis.raf(time * 1000);
  };
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  lenis.stop();

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    ScrollTrigger.refresh();
    lenis.start();
  };

  window.addEventListener('loader:done', release);
  if (!document.documentElement.classList.contains('is-loading')) release();

  const teardown = () => {
    window.removeEventListener('loader:done', release);
    started = false;
    teardownScenes?.();
    world?.destroy();
    teardownChapters?.();
    gsap.ticker.remove(tick);
    lenis.off('scroll', onScroll);
    lenis.destroy();
    (window as unknown as { __lenis?: Lenis }).__lenis = undefined;
  };

  document.addEventListener('astro:before-swap', teardown, { once: true });
}
