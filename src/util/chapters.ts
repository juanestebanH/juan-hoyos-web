import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type Lenis from 'lenis';
import { chapters } from '../data/chapters';

gsap.registerPlugin(ScrollTrigger);

let weights: number[] = chapters.map(() => 0);
let activeIndex = -1;
let teardown: (() => void) | undefined;

export function getChapterWeights() {
  return weights;
}

export function getActiveChapterIndex() {
  return activeIndex;
}

export function refreshChapterWeights() {
  if (typeof window === 'undefined') return weights;
  const viewport = window.innerHeight || 1;

  weights = chapters.map((chapter) => {
    const element = document.getElementById(chapter.id);
    if (!element) return 0;

    const rect = element.getBoundingClientRect();
    const visible = Math.max(
      0,
      Math.min(rect.bottom, viewport) - Math.max(rect.top, 0),
    );

    return Math.min(1, visible / viewport);
  });

  return weights;
}

function pickActiveIndex() {
  refreshChapterWeights();
  let index = 0;
  let max = -1;

  weights.forEach((weight, i) => {
    if (weight > max) {
      max = weight;
      index = i;
    }
  });

  if (max <= 0) {
    const viewport = window.innerHeight || 1;
    index = chapters.length - 1;
    chapters.forEach((chapter, i) => {
      const element = document.getElementById(chapter.id);
      if (element && element.getBoundingClientRect().top <= viewport * 0.5) {
        index = i;
      }
    });
  }

  return index;
}

export function chapterAccent(color: string) {
  const light = document.documentElement.classList.contains('light');
  if (light && color.toLowerCase() === '#ffffff') return '#1a1a1a';
  return color;
}

export function scrollToChapter(id: string) {
  const section = document.getElementById(id);
  if (!section) return;

  const pin = ScrollTrigger.getAll().find(
    (trigger) =>
      trigger.pin &&
      (trigger.trigger === section ||
        (trigger.trigger instanceof Element &&
          trigger.trigger.contains(section))),
  );

  const top = pin
    ? pin.start
    : section.getBoundingClientRect().top +
      window.scrollY -
      (id === 'inicio' ? 0 : 12);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lenis = (window as unknown as { __lenis?: Lenis }).__lenis;
  if (lenis) {
    lenis.scrollTo(top, reduced ? { immediate: true } : { duration: 1.25 });
  } else {
    window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
  }
}

export function initChapters() {
  if (teardown) return teardown;
  if (typeof window === 'undefined') return () => {};

  const root = document.documentElement;
  const progressBar = document.getElementById('scroll-progress-bar');
  let raf = 0;

  const emitAccent = (silent = false) => {
    if (activeIndex < 0) return;
    const chapter = chapters[activeIndex];
    const color = chapterAccent(chapter.color);
    root.style.setProperty('--chapter-accent', color);
    window.dispatchEvent(
      new CustomEvent('chapter:accent', { detail: color }),
    );
    if (!silent) {
      /* el cambio de acto ya se emitió en update */
    }
  };

  const setActive = (index: number, silent = false) => {
    if (index === activeIndex) {
      return;
    }
    activeIndex = index;
    const chapter = chapters[index];
    const color = chapterAccent(chapter.color);
    root.dataset.chapter = chapter.id;
    root.style.setProperty('--chapter-index', chapter.index);
    root.style.setProperty('--chapter-accent', color);

    window.dispatchEvent(
      new CustomEvent('chapter:change', {
        detail: {
          index,
          id: chapter.id,
          chapter,
          color,
          silent,
        },
      }),
    );
    window.dispatchEvent(
      new CustomEvent('chapter:accent', { detail: color }),
    );
  };

  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? gsap.utils.clamp(0, 1, window.scrollY / max) : 0;
    root.style.setProperty('--scroll-progress', progress.toFixed(4));
    if (progressBar) {
      progressBar.style.transform = `scaleX(${progress})`;
    }
  };

  const update = (silent = false) => {
    updateProgress();
    setActive(pickActiveIndex(), silent);
  };

  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      update();
    });
  };

  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    const anchor = target?.closest?.(
      'a[href^="#"]',
    ) as HTMLAnchorElement | null;
    if (!anchor) return;
    const id = anchor.getAttribute('href')?.slice(1);
    if (!id || !chapters.some((chapter) => chapter.id === id)) return;
    event.preventDefault();
    scrollToChapter(id);
  };

  const onResize = () => {
    schedule();
  };

  const onLoaderDone = () => {
    ScrollTrigger.refresh();
    update(true);
  };

  const onThemeChange = () => {
    emitAccent();
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('loader:done', onLoaderDone);
  window.addEventListener('theme:change', onThemeChange);
  window.addEventListener('load', onLoaderDone, { once: true });
  document.addEventListener('click', onClick);
  update(true);

  teardown = () => {
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('loader:done', onLoaderDone);
    window.removeEventListener('theme:change', onThemeChange);
    window.removeEventListener('load', onLoaderDone);
    document.removeEventListener('click', onClick);
    teardown = undefined;
    activeIndex = -1;
  };

  document.addEventListener('astro:before-swap', teardown, { once: true });

  return teardown;
}
