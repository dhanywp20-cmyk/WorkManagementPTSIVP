import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      borderRadius: {
        kecil: '0.5rem',
        kontrol: '0.75rem',
        kartu: '1rem',
        panel: '1.5rem',
      },
      boxShadow: {
        kartu: '0 4px 24px rgba(0,0,0,0.10)',
        dropdown: '0 8px 32px rgba(0,0,0,0.18)',
        modal: '0 8px 40px rgba(0,0,0,0.18)',
        toast: '0 4px 32px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
      },
      colors: {
        halaman: 'var(--halaman)',
        permukaan: { DEFAULT: 'var(--permukaan)', redam: 'var(--permukaan-redam)' },
        garis: { DEFAULT: 'var(--garis)', kuat: 'var(--garis-kuat)' },
        tinta: { DEFAULT: 'var(--tinta)', 2: 'var(--tinta-2)', 3: 'var(--tinta-3)' },
        merek: {
          DEFAULT: 'var(--merek-utama)',
          dua: 'var(--merek-utama-2)',
          aksen: 'var(--merek-aksen)',
          tembus: 'var(--merek-utama-tembus)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
