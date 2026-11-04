import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default [
  ...nextVitals,
  ...nextTs,
  {
    ignores: ['.next/**', 'node_modules/**', 'android/**', 'public/**', 'hasil/**', 'arsip/**', 'scripts/**', 'uji/**', 'e2e/**', '.claude/**', '.playwright-cli/**', 'next-env.d.ts', 'next.config.js'],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'prefer-const': ['error', { destructuring: 'all' }],
      '@next/next/no-img-element': 'off',
      'react/no-unescaped-entities': 'off',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'error',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/use-memo': 'warn',
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
];
