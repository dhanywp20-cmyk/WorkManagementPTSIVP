/** Label CSS2D: cegah tumpang-tindih label & gambar label ke kanvas foto (PNG / cetak). */
import { type KotakLayar, tataLabelProduk } from './labelProduk';
import type { Mesin } from './tipe';

/**
 * Label CSS2D (ukuran, jarak, nama proyektor, dll.) digambar ke kanvas foto di posisi yang
 * sama dengan di layar - label HTML tidak ikut tertangkap oleh WebGL. Gaya diambil dari
 * elemennya sendiri (warna, huruf), diperbesar sesuai resolusi foto.
 */
/**
 * Prioritas label "mengalah" (makin besar makin menang saat bertabrakan): ukuran ruang & plafon paling mudah
 * mengalah, angka ukur display & hasil analisis (jarak terjauh) paling bertahan.
 */
export const PRIORITAS_LABEL = { ruang: 1, sedang: 2, ukur: 3 } as const;
/** Tandai label CSS2D supaya ikut aturan anti-tumpuk (hindariTumpuk) dengan prioritas tertentu. */
export const mengalah = (el: HTMLElement, p: number = PRIORITAS_LABEL.sedang) => { el.dataset.mengalah = String(p); return el; };

/**
 * Label tidak boleh bertumpuk: label yang menabrak label lain disembunyikan sementara, dan muncul lagi saat
 * kamera di-zoom / diputar sampai ada ruang.
 *   - [data-penting]  (keterangan area blending, penggaris buatan sendiri) selalu tampil & menang atas label lain
 *   - [data-mengalah] bila menabrak label penting atau label mengalah lain yang sudah tampil, digeser dulu
 *                     sedikit ke atas / bawah (data-geser-y, ikut ke foto); baru disembunyikan bila tetap tidak
 *                     ada tempat - prioritas lebih tinggi (nilai data-mengalah, PRIORITAS_LABEL) didahulukan
 *   - [data-produk]   ditata dengan garis penunjuk di tempat kosong sekitar bendanya (mesin/labelProduk.ts)
 * Dulu tak satu pun label ukuran / analisis bertanda data-mengalah, jadi "terjauh 6,8 m" & "terjauh 8,7 m",
 * "plafon 3,2 m" & angka mm display saling menimpa.
 */
export function hindariTumpuk(wadah: HTMLElement, m: Mesin) {
  const penting: DOMRect[] = [];
  wadah.querySelectorAll<HTMLElement>('[data-penting]').forEach(el => {
    const r = el.style.display === 'none' ? null : el.getBoundingClientRect();
    if (r?.width) penting.push(r);
  });
  const tabrak = (r: DOMRect, daftar: DOMRect[]) => daftar.some(a => r.left < a.right + 2 && r.right > a.left - 2 && r.top < a.bottom + 1 && r.bottom > a.top - 1);
  /** Kotak label yang sudah tampil; label berikutnya (prioritas turun) tidak boleh menabraknya. */
  const terpakai = [...penting];
  [...wadah.querySelectorAll<HTMLElement>('[data-mengalah]')]
    .sort((a, b) => Number(b.dataset.mengalah || 1) - Number(a.dataset.mengalah || 1))
    .forEach(el => {
      if (el.style.display === 'none') return;
      el.style.visibility = 'visible';
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      //  Kotak di posisi asli (tanpa geseran sebelumnya), lalu coba geser 0, ±1, ±2 tinggi label.
      const lama = Number(el.dataset.geserY || 0), langkah = r.height + 3;
      for (const k of [0, -1, 1, -2, 2]) {
        const dy = k * langkah, c = new DOMRect(r.left, r.top - lama + dy, r.width, r.height);
        if (tabrak(c, terpakai)) continue;
        el.style.marginTop = dy ? `${dy}px` : ''; el.dataset.geserY = String(dy);
        terpakai.push(c);
        return;
      }
      el.style.visibility = 'hidden';
    });
  tataLabelProduk(m, wadah, terpakai.map((r): KotakLayar => ({ l: r.left, t: r.top, r: r.right, b: r.bottom })));
}

/**
 * "Sembunyikan teks": seluruh lapisan label CSS2D disembunyikan lewat display (bukan visibility - itu ditimpa per
 * label oleh hindariTumpuk). Foto / cetak ikut bersih (gambarLabel).
 */
export function aturTeksTersembunyi(m: Mesin, sembunyi: boolean) {
  m.labelRenderer.domElement.style.display = sembunyi ? 'none' : '';
}
const teksTersembunyi = (m: Mesin) => m.labelRenderer.domElement.style.display === 'none';

export function gambarLabel(m: Mesin, g: CanvasRenderingContext2D, w: number, h: number) {
  if (teksTersembunyi(m)) return;
  //  Sedikit lebih besar dari di layar supaya tetap terbaca saat gambar diperkecil / dicetak.
  const skala = (w / Math.max(1, m.renderer.domElement.clientWidth || w)) * 1.35;
  const v = new m.THREE.Vector3();
  m.scene.updateMatrixWorld();
  m.scene.traverseVisible(o => {
    const el = (o as { element?: HTMLElement }).element;
    if (!(o as { isCSS2DObject?: boolean }).isCSS2DObject || !el || el.style.display === 'none' || el.style.visibility === 'hidden') return;
    //  data-teks: label bertombol (mis. penggaris dengan ✕) - yang tercetak hanya teksnya.
    const teks = (el.dataset.teks || el.innerText || el.textContent || '').trim(); if (!teks) return;
    v.setFromMatrixPosition(o.matrixWorld).project(m.kamera);
    if (v.z < -1 || v.z > 1) return;
    let x = ((v.x + 1) / 2) * w, y = ((1 - v.y) / 2) * h + Number(el.dataset.geserY || 0) * (skala / 1.35);
    //  Label produk bergaris penunjuk: titik & garis dari benda, pil di tempat hasil penataan di layar.
    const isi = el.dataset.produk ? el.querySelector<HTMLElement>('[data-isi]') : null;
    if (isi && el.dataset.ox !== undefined) {
      const px = skala / 1.35, ox = Number(el.dataset.ox) * px, oy = Number(el.dataset.oy) * px;
      g.save(); g.strokeStyle = '#64748b'; g.fillStyle = '#64748b'; g.lineWidth = Math.max(1, px);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + ox, y + oy); g.stroke();
      g.beginPath(); g.arc(x, y, 2 * px, 0, Math.PI * 2); g.fill(); g.restore();
      x += ox; y += oy;
    }
    const cs = getComputedStyle(isi ?? el);
    const uk = (parseFloat(cs.fontSize) || 11) * skala;
    g.font = `${cs.fontWeight || '600'} ${uk}px ${cs.fontFamily || 'system-ui, sans-serif'}`;
    const baris = teks.split('\n').map(b => b.trim()).filter(Boolean);
    const lebar = Math.max(...baris.map(b => g.measureText(b).width));
    const padX = 6 * skala, tb = uk * 1.3, kw = lebar + padX * 2, kh = baris.length * tb + 4 * skala;
    const tegak = (cs.writingMode || '').startsWith('vertical');
    //  Label produk menempel: digeser setengah tinggi (data-dy -1 = di atas titik, 1 = di bawah).
    //  Titik tumpu CSS2D (center, bawaan 0,5 ; 0,5 = tengah) ikut: (0,5 ; 0) = tepi atas di titiknya.
    const c = (o as { center?: { x: number; y: number } }).center;
    const dx = c ? (0.5 - c.x) * kw : 0;
    const dy = isi ? 0 : Number(el.dataset.dy || 0) * (kh / 2 + 1 * skala) + (c ? (0.5 - c.y) * kh : 0);
    const latar = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent' ? cs.backgroundColor : 'rgba(15,23,42,0.85)';
    g.save();
    g.translate(x + dx, y + dy);
    if (tegak) g.rotate(Math.PI / 2);
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = 3 * skala; g.shadowOffsetY = 1 * skala;
    g.fillStyle = latar;
    g.beginPath();
    if (typeof g.roundRect === 'function') g.roundRect(-kw / 2, -kh / 2, kw, kh, 6 * skala); else g.rect(-kw / 2, -kh / 2, kw, kh);
    g.fill();
    g.restore();
    //  Rata kiri (keterangan proyektor di bidang gambar) atau tengah, mengikuti gaya elemennya.
    const kiri = cs.textAlign === 'left' || cs.textAlign === 'start';
    g.fillStyle = cs.color || '#ffffff'; g.textAlign = kiri ? 'left' : 'center'; g.textBaseline = 'middle';
    baris.forEach((b, i) => g.fillText(b, kiri ? -kw / 2 + padX : 0, -kh / 2 + 2 * skala + tb * (i + 0.5)));
    g.restore();
  });
}
