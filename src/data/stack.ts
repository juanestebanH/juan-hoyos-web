export type StackCategory = 'frontend' | 'backend' | 'data' | 'creative';

export interface Capability {
  id: string;
  category: StackCategory;
  level: number;
  color: string;
  techs: string[];
  shape: 'cube' | 'pyramid' | 'torus' | 'cylinder' | 'icosa' | 'octa';
}

export const techIcons: Record<string, string> = {
  React: 'mdi:react',
  Astro: 'mdi:rocket-launch-outline',
  TypeScript: 'mdi:language-typescript',
  Tailwind: 'mdi:tailwind',
  'Node.js': 'mdi:nodejs',
  Express: 'mdi:server',
  FastAPI: 'mdi:api',
  Python: 'mdi:language-python',
  JWT: 'mdi:key-variant',
  PHP: 'mdi:language-php',
  Laravel: 'mdi:laravel',
  PostgreSQL: 'mdi:database-outline',
  MySQL: 'mdi:database',
  Supabase: 'mdi:database-lock',
  SQL: 'mdi:database-search-outline',
  'Three.js': 'mdi:cube-outline',
  GSAP: 'mdi:animation',
  Lenis: 'mdi:gesture-swipe-horizontal',
  WebGL: 'mdi:vector-triangle',
  NativeWind: 'mdi:wind-power',
  'React Native': 'mdi:cellphone',
  Kotlin: 'mdi:language-kotlin',
  Ionic: 'mdi:cellphone-link',
  'Design Systems': 'mdi:shape-outline',
};

export const capabilities: Capability[] = [
  {
    id: 'frontend',
    category: 'frontend',
    level: 95,
    color: '#ffffff',
    techs: ['React', 'Astro', 'TypeScript', 'Tailwind'],
    shape: 'cube',
  },
  {
    id: 'backend',
    category: 'backend',
    level: 90,
    color: '#ffffff',
    techs: ['Node.js', 'Express', 'PHP', 'Laravel', 'FastAPI', 'Python', 'JWT'],
    shape: 'pyramid',
  },
  {
    id: 'data',
    category: 'data',
    level: 92,
    color: '#ffffff',
    techs: ['PostgreSQL', 'MySQL', 'Supabase', 'SQL'],
    shape: 'cylinder',
  },
  {
    id: 'creative',
    category: 'creative',
    level: 85,
    color: '#ffffff',
    techs: ['Three.js', 'GSAP', 'Lenis', 'WebGL'],
    shape: 'icosa',
  },
  {
    id: 'ui',
    category: 'frontend',
    level: 96,
    color: '#ffffff',
    techs: ['Tailwind', 'NativeWind', 'React Native', 'Design Systems', 'Kotlin', 'Ionic'],
    shape: 'octa',
  },
];
