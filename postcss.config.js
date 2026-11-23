const path = require('path');

module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    [path.join(process.cwd(), 'lib', 'tipografi', 'postcss-skala-teks.cjs')]: {},
  },
};
