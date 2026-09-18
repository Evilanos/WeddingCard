// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

// PUBLIC_SITE_URL wajib https absolut: dipakai untuk OG tags & link personal tamu.
const site = process.env.PUBLIC_SITE_URL || 'https://example.com';

export default defineConfig({
  site,
  output: 'static',
  integrations: [preact()],
  build: {
    // Satu halaman utama: CSS di-inline menghilangkan request yang memblokir render.
    inlineStylesheets: 'always',
  },
  image: {
    // Hanya dipakai saat build (sharp). Tidak ada image service runtime di Cloudflare Pages.
    responsiveStyles: true,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
