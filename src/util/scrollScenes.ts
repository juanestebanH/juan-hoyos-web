import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const TITLE_SELECTOR =
  '.tech-title, .project-title-anim, .timeline-title, .about-title, .contact-title';

let teardown: (() => void) | undefined;

export function initScrollScenes(lenis?: Lenis): () => void {
  if (teardown) return teardown;
  if (typeof window === 'undefined') return () => {};

  const reduced = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const triggers: ScrollTrigger[] = [];
  const sceneIndexes: HTMLElement[] = [];

  const sections = document.querySelectorAll<HTMLElement>('section[id]');

  sections.forEach((section) => {
    const mark = section.querySelector<HTMLElement>('[data-scene-mark]');
    if (!mark) return;

    const rule = mark.querySelector<HTMLElement>('[data-scene-rule]');
    const float = mark.querySelector<HTMLElement>('[data-scene-float]');
    const index = mark.querySelector<HTMLElement>('[data-scene-index]');
    if (!rule || !float || !index) return;

    sceneIndexes.push(index);

    if (reduced) {
      gsap.set(rule, { scaleX: 1 });
      gsap.set(index, { opacity: 0.32 });
      return;
    }

    const isSmall = window.matchMedia('(max-width: 768px)').matches;
    gsap.set(index, { yPercent: 12 });

    const entrance = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top 88%',
        end: 'top 48%',
        scrub: 0.8,
      },
    });

    entrance
      .to(rule, { scaleX: 1, ease: 'none' }, 0)
      .to(
        index,
        { opacity: isSmall ? 0.3 : 0.42, yPercent: 0, ease: 'none' },
        0,
      );

    const parallax = gsap.fromTo(
      float,
      { yPercent: -7 },
      {
        yPercent: 7,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      },
    );

    if (entrance.scrollTrigger) triggers.push(entrance.scrollTrigger);
    if (parallax.scrollTrigger) triggers.push(parallax.scrollTrigger);
  });

  const titles = gsap.utils.toArray<HTMLElement>(TITLE_SELECTOR);
  const canSkew = !reduced && !coarse && !!lenis;
  const titleSkew = canSkew
    ? titles.map((el) =>
        gsap.quickTo(el, 'skewY', {
          duration: 0.35,
          ease: 'power2.out',
        }),
      )
    : [];
  const indexSkew = canSkew
    ? sceneIndexes.map((el) =>
        gsap.quickTo(el, 'skewY', {
          duration: 0.4,
          ease: 'power2.out',
        }),
      )
    : [];

  let targetVelocity = 0;
  let currentVelocity = 0;
  let lastApplied = 99;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;

  const onScroll = (instance: Lenis) => {
    targetVelocity = gsap.utils.clamp(-1, 1, instance.velocity / 45);
    window.clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      targetVelocity = 0;
    }, 140);
  };

  const tick = () => {
    currentVelocity += (targetVelocity - currentVelocity) * 0.14;

    if (Math.abs(currentVelocity) < 0.0005) currentVelocity = 0;
    if (Math.abs(currentVelocity - lastApplied) < 0.0015) return;

    lastApplied = currentVelocity;
    const titleAmount = currentVelocity * 1.1;
    const indexAmount = currentVelocity * 0.55;

    for (const set of titleSkew) set(titleAmount);
    for (const set of indexSkew) set(indexAmount);
  };

  if (canSkew && lenis) {
    unsubscribe = lenis.on('scroll', onScroll);
    gsap.ticker.add(tick);
  }

  teardown = () => {
    unsubscribe?.();
    window.clearTimeout(idleTimer);
    gsap.ticker.remove(tick);
    triggers.forEach((trigger) => trigger.kill());
    gsap.killTweensOf(titles);
    gsap.killTweensOf(sceneIndexes);
    teardown = undefined;
  };

  document.addEventListener('astro:before-swap', teardown, { once: true });

  return teardown;
}
