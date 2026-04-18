// @ts-check
import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'http://localhost:4321',
  integrations: [icon()],
  vite: {
    plugins: [tailwindcss()],
  },
});
