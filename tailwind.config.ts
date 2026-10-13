import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Breakpoint satulayar & formulir (media query gabungan lebar + pointer) pindah ke
      // app/globals.css sebagai @custom-variant: Tailwind 4 tidak lagi menerima screens `raw`.

      borderRadius: {
        kecil: '0.5rem',    // lencana, chip, tombol ikon      (= rounded-lg)
        kontrol: '0.75rem', // input, tombol, baris daftar     (= rounded-xl)
        kartu: '1rem',      // kartu, panel, badan modal       (= rounded-2xl)
        panel: '1.5rem',    // panel besar: kartu login        (= rounded-3xl)
      },
      boxShadow: {
        kartu: '0 4px 24px rgba(0,0,0,0.10)',
        dropdown: '0 8px 32px rgba(0,0,0,0.18)',
        modal: '0 8px 40px rgba(0,0,0,0.18)',
        toast: '0 4px 32px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
      },
      colors: {
        /** Warna semantik - lihat WARNA di lib/desain.ts & --tinta dkk di globals.css. */
        halaman: 'var(--halaman)',
        permukaan: { DEFAULT: 'var(--permukaan)', redam: 'var(--permukaan-redam)' },
        garis: { DEFAULT: 'var(--garis)', kuat: 'var(--garis-kuat)' },
        tinta: { DEFAULT: 'var(--tinta)', 2: 'var(--tinta-2)', 3: 'var(--tinta-3)' },
        /** Warna merek dari database - lihat tulisWarnaKeCSS di lib/merek.ts. */
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
