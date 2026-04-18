import ecommercerenta from '../assets/ecommercerenta.png';
import webip from '../assets/webip.png';
import architec from '../assets/architec.png';

export const projects = [
  {
    id: 'ecommerce',
    title: 'E-Commerce Renta de Carros',
    image: ecommercerenta,
    tags: ['React', 'Node.js', 'Supabase', 'Tailwind CSS'],
    color: 'hsl(var(--primary))',
    demo: 'https://ecommerce-renta-de-carros-1.onrender.com/',
    code: 'https://github.com/juanestebanH/Ecommerce-renta-de-carros',
  },
  {
    id: 'iptracker',
    title: 'IP Address Tracker',
    image: webip,
    tags: ['HTML', 'CSS', 'JavaScript', 'Leaflet'],
    color: 'hsl(var(--cn-turquoise))',
    demo: 'https://ip-ubicacion-uy7f.onrender.com/',
    code: 'https://github.com/juanestebanH/ip_ubicacion',
  },
  {
    id: 'architec',
    title: 'Architec IA',
    image: architec,
    tags: ['React', 'Node.js', 'Hugging Face', 'Tailwind CSS'],
    color: 'hsl(var(--cn-deep-purple))',
    demo: 'https://architec-ia-1.onrender.com/',
    code: 'https://github.com/juanestebanH/Architec-ia',
  },
];
