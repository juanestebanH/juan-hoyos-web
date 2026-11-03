import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * Animación de títulos para usar dentro de timelines
 * (Recomendada para tu portafolio)
 */
export function animateSectionTitle(tl: gsap.core.Timeline, selector: string) {
  tl.from(selector, {
    x: -60,
    opacity: 0,
    duration: 0.9,
    ease: 'power3.out',
  });
}

/**
 * Versión independiente por si alguna sección no usa timeline
 */
export function animateSectionTitleScroll(selector: string, trigger?: string) {
  const element = document.querySelector(selector);
  if (!element) {
    console.warn(`Element with selector "${selector}" not found for animation`);
    return;
  }

  gsap.fromTo(
    selector,
    {
      x: -60,
      opacity: 0,
    },
    {
      x: 0,
      opacity: 1,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: trigger || selector,
        start: 'top 85%',
        toggleActions: 'play none none reset',
      },
    },
  );
}

export function animateTitleChars(selector: string, trigger?: string) {
  const element = document.querySelector(selector);
  if (!element) {
    console.warn(`Element with selector "${selector}" not found for animation`);
    return;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const split = SplitText.create(selector, { type: 'chars', autoSplit: true });

  gsap.set(split.chars, { yPercent: 110 });
  gsap.to(split.chars, {
    yPercent: 0,
    duration: 0.8,
    stagger: 0.03,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: trigger || selector,
      start: 'top 94%',
      end: 'top 58%',
      scrub: 1,
    },
  });
}
