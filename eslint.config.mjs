// ESLint (flat config) - aturan Next.js + TypeScript. Dijalankan: npm run lint.
//
// Aturan yang sudah lama dilanggar di kode warisan dijadikan PERINGATAN, bukan galat, supaya lint bisa
// langsung dipakai di CI tanpa menunggu ratusan berkas dibereskan; angkanya diturunkan bertahap.
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default [
  ...nextVitals,
  ...nextTs,
  {
    ignores: ['.next/**', 'node_modules/**', 'android/**', 'public/**', 'hasil/**', 'scripts/**', 'uji/**', 'next-env.d.ts', 'next.config.js'],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'prefer-const': ['error', { destructuring: 'all' }], // `let { data, error }` yang hanya data-nya diisi ulang
      '@next/next/no-img-element': 'off', // gambar dari Supabase Storage/unggahan, bukan aset statis
      'react/no-unescaped-entities': 'off', // tanda kutip/apostrof di teks bahasa Indonesia aman di JSX
      //  Aturan React Compiler (eslint-plugin-react-hooks 6). Platform ini TIDAK memakai React Compiler;
      //  pola yang ditandainya (setState di effect, mutasi objek, komponen di dalam render) sah di React
      //  biasa. Dijadikan peringatan supaya terlihat & dibereskan saat berkasnya disentuh.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/use-memo': 'warn',
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
];
