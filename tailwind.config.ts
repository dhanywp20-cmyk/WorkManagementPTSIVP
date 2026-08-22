import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        /**
         * satulayar - dipakai form yang tata letaknya tiga kolom sekaligus.
         *
         * Tidak memakai lebar saja, dan itu disengaja. Zoom Chrome 125%
         * MENGECILKAN lebar viewport CSS: layar 1366px jadi 1092px, dan
         * breakpoint xl (1280px) langsung menjatuhkan tata letaknya jadi
         * satu kolom - padahal layarnya laptop yang sama, hanya tulisannya
         * diperbesar. Menumpuk ke bawah di situ salah sasaran.
         *
         * Yang sebenarnya membedakan laptop dari ponsel bukan lebar,
         * melainkan alat penunjuknya. `pointer: fine` berarti ada mouse atau
         * trackpad - dan itu tidak berubah walau di-zoom berapa pun. Ponsel
         * dan tablet menjawab `pointer: coarse`, jadi mereka tetap menumpuk
         * seperti sebelumnya.
         *
         * Batas 900px tetap ada untuk laptop supaya tiga kolom tidak
         * dipaksakan saat jendelanya benar-benar sempit (zoom 175% ke atas,
         * atau jendela yang dikecilkan setengah layar).
         */
        satulayar: {
          raw: '(min-width: 1280px), ((pointer: fine) and (min-width: 900px))',
        },
      },

      /**
       * Token di bawah ADITIF - namanya baru semua, jadi tidak ada satu pun
       * kelas yang sudah dipakai berubah artinya. Nilainya sengaja sama persis
       * dengan yang sudah dipakai (lihat lib/desain.ts), supaya memindahkan
       * satu komponen ke token tidak mengubah tampilannya sedikit pun -
       * hanya memberinya nama.
       */
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
