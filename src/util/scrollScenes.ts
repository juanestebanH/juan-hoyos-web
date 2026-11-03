import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const TITLE_SELECTOR =
  '.tech-title, .project-title-anim, .timeline-title, .about-title, .contact-title';

const CONTENT_SELECTOR: Record<string, string> = {
  tecnologias: '.stack-head',
  proyectos: '.works-head',
  experiencia: '.exp-heading',
  contacto: '.contact-head',
};

interface ContentMotion {
  from: number;
  to: number;
  x: number;
  scaleFrom: number;
  scaleTo: number;
  rotateFrom: number;
  rotateTo: number;
}

const CONTENT_PARALLAX: Record<string, ContentMotion> = {
  tecnologias: {
    from: 140,
    to: -80,
    x: -26,
    scaleFrom: 0.96,
    scaleTo: 1.02,
    rotateFrom: -1,
    rotateTo: 1,
  },
  proyectos: {
    from: 90,
    to: -60,
    x: 18,
    scaleFrom: 0.97,
    scaleTo: 1.01,
    rotateFrom: 0.8,
    rotateTo: -0.8,
  },
  experiencia: {
    from: 150,
    to: -95,
    x: -24,
    scaleFrom: 0.95,
    scaleTo: 1.02,
    rotateFrom: -1.1,
    rotateTo: 1.1,
  },
  contacto: {
    from: 170,
    to: -110,
    x: 30,
    scaleFrom: 0.94,
    scaleTo: 1.02,
    rotateFrom: 1.2,
    rotateTo: -1.2,
  },
};

type DepthLayer = Omit<ContentMotion, 'rotateFrom' | 'rotateTo'> & {
  selector: string;
};

const SECONDARY_PARALLAX: Record<string, DepthLayer[]> = {
  contacto: [
    {
      selector: '.contact-layout',
      from: 120,
      to: -90,
      x: 26,
      scaleFrom: 0.97,
      scaleTo: 1.02,
    },
  ],
};

const AMBIENT_PARALLAX: Record<
  string,
  Array<{ selector: string; from: number; to: number; x: number }>
> = {
  tecnologias: [{ selector: '.stack-bg', from: -10, to: 10, x: 44 }],
  proyectos: [{ selector: '.works-glow', from: -14, to: 14, x: -64 }],
  contacto: [{ selector: '.contact-grid', from: -9, to: 9, x: -48 }],
};

let teardown: (() => void) | undefined;

export function initScrollScenes(lenis?: Lenis): () => void {
  if (teardown) return teardown;
  if (typeof window === 'undefined') return () => {};

  const reduced = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const triggers: ScrollTrigger[] = [];

  const sections = document.querySelectorAll<HTMLElement>('section[id]');

  sections.forEach((section) => {
    if (reduced) return;

    const isSmall = window.matchMedia('(max-width: 768px)').matches;

    const contentSelector = CONTENT_SELECTOR[section.id];
    const content = contentSelector
      ? section.querySelector<HTMLElement>(contentSelector)
      : null;
    const contentRange = CONTENT_PARALLAX[section.id];

    if (content && contentRange) {
      const x = isSmall ? contentRange.x * 0.4 : contentRange.x;
      const scaleFrom = isSmall
        ? 1 - (1 - contentRange.scaleFrom) * 0.5
        : contentRange.scaleFrom;
      const scaleTo = isSmall
        ? 1 + (contentRange.scaleTo - 1) * 0.5
        : contentRange.scaleTo;
      const rotateFrom = isSmall
        ? contentRange.rotateFrom * 0.5
        : contentRange.rotateFrom;
      const rotateTo = isSmall
        ? contentRange.rotateTo * 0.5
        : contentRange.rotateTo;

      const contentParallax = gsap.fromTo(
        content,
        {
          y: contentRange.from,
          x: -x,
          scale: scaleFrom,
          rotate: rotateFrom,
          transformOrigin: '50% 50%',
        },
        {
          y: contentRange.to,
          x,
          scale: scaleTo,
          rotate: rotateTo,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1,
          },
        },
      );
      if (contentParallax.scrollTrigger) {
        triggers.push(contentParallax.scrollTrigger);
      }
    }

    SECONDARY_PARALLAX[section.id]?.forEach((layer) => {
      const element = section.querySelector<HTMLElement>(layer.selector);
      if (!element) return;

      const x = isSmall ? layer.x * 0.4 : layer.x;
      const scaleFrom = isSmall
        ? 1 - (1 - layer.scaleFrom) * 0.5
        : layer.scaleFrom;
      const scaleTo = isSmall
        ? 1 + (layer.scaleTo - 1) * 0.5
        : layer.scaleTo;
      const layerParallax = gsap.fromTo(
        element,
        {
          y: isSmall ? layer.from * 0.55 : layer.from,
          x: -x,
          scale: scaleFrom,
          transformOrigin: '50% 50%',
        },
        {
          y: isSmall ? layer.to * 0.55 : layer.to,
          x,
          scale: scaleTo,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1,
          },
        },
      );
      if (layerParallax.scrollTrigger) {
        triggers.push(layerParallax.scrollTrigger);
      }
    });

    AMBIENT_PARALLAX[section.id]?.forEach((layer) => {
      const element = section.querySelector<HTMLElement>(layer.selector);
      if (!element) return;

      const x = isSmall ? layer.x * 0.45 : layer.x;
      const ambientParallax = gsap.fromTo(
        element,
        { yPercent: layer.from, x: -x },
        {
          yPercent: layer.to,
          x,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1,
          },
        },
      );
      if (ambientParallax.scrollTrigger) {
        triggers.push(ambientParallax.scrollTrigger);
      }
    });

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
    const titleAmount = currentVelocity * 1.7;

    for (const set of titleSkew) set(titleAmount);
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
    teardown = undefined;
  };

  document.addEventListener('astro:before-swap', teardown, { once: true });

  return teardown;
}
