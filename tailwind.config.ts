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
    },
  },
  plugins: [],
};

export default config;
