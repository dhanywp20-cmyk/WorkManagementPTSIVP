import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const skalaTeks = require('../lib/tipografi/postcss-skala-teks.cjs');
type Dekl = { important?: boolean; parent?: { selector?: string } };
const { skalaPx, ubahUkuran, isianTerkunci, ubahRuang, ubahSpasiDasar, diLuarSkala } = skalaTeks as {
  skalaPx: (n: number) => number; ubahUkuran: (v: string) => string | null; isianTerkunci: (d: Dekl) => boolean;
  ubahRuang: (v: string) => string | null; ubahSpasiDasar: (v: string) => string | null; diLuarSkala: (d: Dekl) => boolean;
};

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\nSkala teks global');
cek('judul besar turun tepat 5 px (24 -> 19, 30 -> 25, 64 -> 59)', skalaPx(24) === 19 && skalaPx(30) === 25 && skalaPx(64) === 59);
cek('mulai 20 px turun penuh 5 px', skalaPx(20) === 15 && skalaPx(18) === 14);
cek('teks isi turun proporsional (16 -> 13, 14 -> 12, 13 -> 11.5)', skalaPx(16) === 13 && skalaPx(14) === 12 && skalaPx(13) === 11.5);
cek('teks kecil tetap terbaca (12 -> 11, 11 -> 10.5)', skalaPx(12) === 11 && skalaPx(11) === 10.5);
cek('tidak pernah di bawah 10 px', [10, 10.5, 11, 11.5, 12].every(n => skalaPx(n) >= 10) && skalaPx(10) === 10 && skalaPx(9) === 9);
const urut = [10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 16, 18, 20, 24, 30, 40];
cek('urutan hierarki tetap (lebih besar tetap lebih besar)', urut.every((n, i) => i === 0 || skalaPx(n) > skalaPx(urut[i - 1])));
cek('token rem Tailwind diubah + dijaga minimal 10 px', ubahUkuran('0.875rem') === 'max(10px, 0.75rem)' && ubahUkuran('0.75rem') === 'max(10px, 0.6875rem)');
cek('nilai px diubah', ubahUkuran('12.5px') === '11.25px');
cek('nilai relatif / var / calc dibiarkan', ubahUkuran('1.2em') === null && ubahUkuran('var(--text-sm)') === null && ubahUkuran('calc(1rem + 2px)') === null);
cek('plugin terpasang setelah Tailwind di postcss.config.js', /'@tailwindcss\/postcss'[\s\S]*postcss-skala-teks/.test(readFileSync('postcss.config.js', 'utf8')));
cek('input 16px !important di HP tidak dikecilkan (iOS tidak zoom)', isianTerkunci({ important: true, parent: { selector: "input:not([type='checkbox']),\n    select,\n    textarea" } }));
cek('kelas Tailwind bermodifier ! (mis. !text-[12px]) tetap ikut skala', !isianTerkunci({ important: true, parent: { selector: '.\\!text-\\[12px\\]' } }));
cek('input tanpa !important tetap ikut skala', !isianTerkunci({ important: false, parent: { selector: 'input' } }));
console.log('\nSkala ruang global (padding, gap, margin)');
const R = 'var(--skala-ruang, 1)';
cek('token --spacing Tailwind ikut skala ruang', ubahSpasiDasar('.25rem') === `calc(.25rem * ${R})`);
cek('padding px di CSS ikut skala ruang', ubahRuang('14px 24px') === `calc(14px * ${R}) calc(24px * ${R})`);
cek('margin negatif & 0 aman', ubahRuang('0 -6px') === `0 calc(-6px * ${R})`);
cek('garis rambut <= 2px & nilai calc/var dibiarkan', ubahRuang('1px') === null && ubahRuang('calc(var(--spacing) * 4)') === null && ubahRuang('auto') === null);
const css = readFileSync('app/globals.css', 'utf8');
cek('skala ruang 0.8 di desktop, 0.9 di HP (tombol tetap mudah disentuh)', /--skala-ruang: 0\.8;/.test(css) && /max-width: 640px\)[\s\S]{0,80}--skala-ruang: 0\.9;/.test(css));
const beranda = readFileSync('app/(portal)/dashboard/_components/beranda/IsiBeranda.tsx', 'utf8');
cek('Daily Report Tim di kolom kanan setelah Agenda Saya', /bb-samping bb-naik[\s\S]*bb-samping bb-samping-tim/.test(beranda) && !/kartuTim/.test(beranda));
cek('Agenda & Daily Report Tim setinggi kolom kiri (tanpa celah kosong)', /\.bb-utama:has\(> \.bb-kiri\) > \.bb-samping \{ min-height: 100%; \}/.test(css) && /\.bb-samping-tim \.bb-isi-ubin \{ overflow-y: auto;/.test(css));
cek('HP: kolom samping turun jadi satu kolom', /:has\(> \.bb-samping-tim:nth-child\(3\)\) \{ grid-template-columns: minmax\(0, 1fr\); \}/.test(css));
console.log('\nLogin: teks besar & jelas');
cek('aturan .skala-asli tidak ikut dikecilkan plugin', diLuarSkala({ parent: { selector: '.layar-masuk.skala-asli' } }) && !diLuarSkala({ parent: { selector: '.skala-asli-lain' } }));
const masuk = readFileSync('app/(portal)/_kerangka/LayarMasuk.tsx', 'utf8');
cek('Layar login memakai skala-asli', /layar-masuk skala-asli/.test(masuk));
cek('judul login text-4xl = 36 px + 10 px (2.875rem)', /\.layar-masuk\.skala-asli \{[\s\S]*--text-4xl: 2\.875rem;/.test(css));
cek('teks login lain proporsional (sm 14 -> ~18 px)', /--text-sm: 1\.12rem;/.test(css));
cek('scrollbar kolom samping hanya muncul saat hover', /\.bb-samping :is\(\.bb-isi-ubin, \[role="tabpanel"\]\) \{ scrollbar-color: transparent transparent; \}/.test(css) && /\.bb-samping:hover :is/.test(css));
console.log('\nGrafik dasbor');
const grafik = readFileSync('components/shared/grafik-kpi.tsx', 'utf8');
cek('Tren tiket: teks grafik ukuran piksel tetap (viewBox = lebar asli, bukan diperbesar)', /ResizeObserver/.test(grafik) && /width=\{W\} height=\{H\}/.test(grafik) && !/w-full h-auto/.test(grafik));
cek('Tren tiket: label nilai teratas tidak terpotong', /Math\.max\(11, Y\(/.test(grafik) && /pt = 24/.test(grafik));
const bento = readFileSync('app/(portal)/dashboard/_components/beranda/RincianBento.tsx', 'utf8');
cek('Sumber tiket di tengah: Menunggu keputusan 2 | Sumber 8 | Unit di luar 2', /'menunggu-keputusan', lebar: 2 \}, \{ kunci: 'sumber-tiket', lebar: 8 \}, \{ kunci: 'unit-di-luar', lebar: 2 \}/.test(bento));
cek('Kartu Sumber tiket dirender di antara Menunggu & Unit', /menunggu-keputusan'\] && \([\s\S]*KartuAsalTiket kpi[\s\S]*unit-di-luar'\] && s\.unit/.test(bento));
const pie = readFileSync('app/(portal)/dashboard/_components/beranda/PieSumber.tsx', 'utf8');
cek('Sumber tiket = 4 MiniPieChart global (Produk, Divisi, Handler, Status), bukan model pie baru', ['Produk', 'Divisi', 'Handler', 'Status'].every(k => pie.includes(`judul: '${k}'`)) && /<MiniPieChart /.test(pie) && !/<circle/.test(pie) && /\.bb-pie-kisi \{ flex: 1; min-width: 0; display: grid; grid-template-columns: repeat\(2,/.test(css));
cek('Sumber tiket: 2 chart per tampilan, panah kiri/kanan untuk geser', /PER_HALAMAN = 2/.test(pie) && /arah="kiri"/.test(pie) && /arah="kanan"/.test(pie) && /\.bb-pie-panah \{/.test(css));
cek('plugin bertanda PostCSS', (skalaTeks as { postcss?: boolean }).postcss === true);

console.log(`\n${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
