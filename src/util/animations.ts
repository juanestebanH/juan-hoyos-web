import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

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
