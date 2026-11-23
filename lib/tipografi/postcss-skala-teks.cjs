const PENGURANG_MAKS = 5;
const BATAS_BAWAH = 10;
const LAJU = 0.5;
const PX_PER_REM = 16;

const bulat = n => Math.round(n * 100) / 100;

function skalaPx(px) {
  if (!(px > BATAS_BAWAH)) return px;
  const kurang = Math.min(PENGURANG_MAKS, (px - BATAS_BAWAH) * LAJU);
  return bulat(px - kurang);
}

const POLA_PX = /^(\d*\.?\d+)px$/;
const POLA_REM = /^(\d*\.?\d+)rem$/;
const POLA_TOKEN = /^--text-([a-z0-9]+)$/;
const POLA_TINGGI = /^--text-([a-z0-9]+)--line-height$/;

function ubahUkuran(nilai) {
  const v = nilai.trim();
  const px = v.match(POLA_PX);
  if (px) return `${skalaPx(parseFloat(px[1]))}px`;
  const rem = v.match(POLA_REM);
  if (rem) {
    const baru = skalaPx(parseFloat(rem[1]) * PX_PER_REM) / PX_PER_REM;
    return `max(${BATAS_BAWAH}px, ${bulat(baru * 10000) / 10000}rem)`;
  }
  return null;
}

const dariPustaka = root => /[\\/]node_modules[\\/]/.test(root.source?.input?.file ?? '');
const POLA_ISIAN = /(^|[^\w-])(input|select|textarea)\b/;
const isianTerkunci = d => d.important && POLA_ISIAN.test(d.parent?.selector ?? '');

const VAR_RUANG = 'var(--skala-ruang, 1)';
const POLA_PROP_RUANG = /^((padding|margin)(-[a-z-]+)?|(row-|column-)?gap)$/;
const POLA_ANGKA_RUANG = /(-?\d*\.?\d+)(px|rem)(?![\w-])/g;

function ubahRuang(nilai) {
  if (/(calc|var|env|min|max|clamp)\(/.test(nilai)) return null;
  let berubah = false;
  const baru = nilai.replace(POLA_ANGKA_RUANG, (asli, angka, satuan) => {
    if (satuan === 'px' && Math.abs(parseFloat(angka)) <= 2) return asli;
    berubah = true;
    return `calc(${angka}${satuan} * ${VAR_RUANG})`;
  });
  return berubah ? baru : null;
}

function ubahSpasiDasar(nilai) {
  const rem = nilai.trim().match(POLA_REM);
  return rem ? `calc(${rem[1]}rem * ${VAR_RUANG})` : null;
}

function skalaTeks() {
  return {
    postcssPlugin: 'skala-teks',
    OnceExit(root) {
      if (dariPustaka(root)) return;
      const rasio = {};
      root.walkDecls(d => {
        if (isianTerkunci(d)) return;
        const ruang = d.prop === '--spacing' ? ubahSpasiDasar(d.value) : POLA_PROP_RUANG.test(d.prop) ? ubahRuang(d.value) : null;
        if (ruang) { d.value = ruang; return; }
        const token = d.prop.match(POLA_TOKEN);
        if (d.prop !== 'font-size' && !token) return;
        const rem = d.value.trim().match(POLA_REM);
        const baru = ubahUkuran(d.value);
        if (!baru) return;
        if (token && rem) rasio[token[1]] = skalaPx(parseFloat(rem[1]) * PX_PER_REM) / (parseFloat(rem[1]) * PX_PER_REM);
        d.value = baru;
      });
      root.walkDecls(POLA_TINGGI, d => {
        const nama = d.prop.match(POLA_TINGGI)[1];
        const rem = d.value.trim().match(POLA_REM);
        if (!rem || !rasio[nama]) return;
        d.value = `${bulat(parseFloat(rem[1]) * rasio[nama] * 10000) / 10000}rem`;
      });
    },
  };
}
skalaTeks.postcss = true;

module.exports = skalaTeks;
module.exports.skalaPx = skalaPx;
module.exports.ubahUkuran = ubahUkuran;
module.exports.isianTerkunci = isianTerkunci;
module.exports.ubahRuang = ubahRuang;
module.exports.ubahSpasiDasar = ubahSpasiDasar;
