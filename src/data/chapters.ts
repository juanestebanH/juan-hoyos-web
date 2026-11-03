export type ChapterLang = 'es' | 'en';

export interface ChapterCopy {
  short: string;
  label: string;
  tag: string;
}

export interface ChapterDef {
  id: string;
  index: string;
  color: string;
  es: ChapterCopy;
  en: ChapterCopy;
}

export const chapters: ChapterDef[] = [
  {
    id: 'inicio',
    index: '01',
    color: '#ffffff',
    es: { short: 'CORE', label: 'Inicio', tag: 'NÚCLEO' },
    en: { short: 'CORE', label: 'Start', tag: 'CORE' },
  },
  {
    id: 'sobre-mi',
    index: '02',
    color: '#ffffff',
    es: { short: 'SOBRE MÍ', label: 'Sobre mí', tag: 'PERFIL' },
    en: { short: 'ABOUT', label: 'About', tag: 'PROFILE' },
  },
  {
    id: 'tecnologias',
    index: '03',
    color: '#ffffff',
    es: { short: 'STACK', label: 'Tecnologías', tag: 'STACK' },
    en: { short: 'STACK', label: 'Stack', tag: 'STACK' },
  },
  {
    id: 'proyectos',
    index: '04',
    color: '#ffffff',
    es: { short: 'WORKS', label: 'Proyectos', tag: 'OBRAS' },
    en: { short: 'WORKS', label: 'Works', tag: 'WORKS' },
  },
  {
    id: 'experiencia',
    index: '05',
    color: '#ffffff',
    es: { short: 'JOURNEY', label: 'Experiencia', tag: 'TRAYECTORIA' },
    en: { short: 'JOURNEY', label: 'Experience', tag: 'JOURNEY' },
  },
  {
    id: 'contacto',
    index: '06',
    color: '#ffffff',
    es: { short: 'PORTAL', label: 'Contacto', tag: 'PORTAL' },
    en: { short: 'PORTAL', label: 'Contact', tag: 'PORTAL' },
  },
];

export function getChapterCopy(chapter: ChapterDef, lang: ChapterLang) {
  return chapter[lang];
}
