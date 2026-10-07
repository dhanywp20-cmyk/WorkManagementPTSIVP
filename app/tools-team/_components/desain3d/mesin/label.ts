/** Label CSS2D: cegah tumpang-tindih label produk & gambar label ke kanvas foto (PNG / cetak). */
import type { Mesin } from './tipe';

/**
 * Label CSS2D (ukuran, jarak, nama proyektor, dll.) digambar ke kanvas foto di posisi yang
 * sama dengan di layar - label HTML tidak ikut tertangkap oleh WebGL. Gaya diambil dari
 * elemennya sendiri (warna, huruf), diperbesar sesuai resolusi foto.
 */
/**
 * Label produk tidak boleh bertumpuk: label yang menabrak label lain (urutan = prioritas) disembunyikan
 * sementara, dan muncul lagi saat kamera di-zoom / diputar sampai ada ruang.
 */
export function hindariTumpuk(wadah: HTMLElement) {
  const ambil: DOMRect[] = [];
  wadah.querySelectorAll<HTMLElement>('[data-produk]').forEach(el => {
    if (el.style.display === 'none') return;
    el.style.visibility = 'visible';
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const tabrak = ambil.some(a => r.left < a.right + 2 && r.right > a.left - 2 && r.top < a.bottom + 1 && r.bottom > a.top - 1);
    if (tabrak) el.style.visibility = 'hidden'; else ambil.push(r);
  });
}

export function gambarLabel(m: Mesin, g: CanvasRenderingContext2D, w: number, h: number) {
  //  Sedikit lebih besar dari di layar supaya tetap terbaca saat gambar diperkecil / dicetak.
  const skala = (w / Math.max(1, m.renderer.domElement.clientWidth || w)) * 1.35;
  const v = new m.THREE.Vector3();
  m.scene.updateMatrixWorld();
  m.scene.traverseVisible(o => {
    const el = (o as { element?: HTMLElement }).element;
    if (!(o as { isCSS2DObject?: boolean }).isCSS2DObject || !el || el.style.display === 'none' || el.style.visibility === 'hidden') return;
    const teks = (el.innerText || el.textContent || '').trim(); if (!teks) return;
    v.setFromMatrixPosition(o.matrixWorld).project(m.kamera);
    if (v.z < -1 || v.z > 1) return;
    const x = ((v.x + 1) / 2) * w, y = ((1 - v.y) / 2) * h;
    const cs = getComputedStyle(el);
    const uk = (parseFloat(cs.fontSize) || 11) * skala;
    g.font = `${cs.fontWeight || '600'} ${uk}px ${cs.fontFamily || 'system-ui, sans-serif'}`;
    const baris = teks.split('\n').map(b => b.trim()).filter(Boolean);
    const lebar = Math.max(...baris.map(b => g.measureText(b).width));
    const padX = 6 * skala, tb = uk * 1.3, kw = lebar + padX * 2, kh = baris.length * tb + 4 * skala;
    const tegak = (cs.writingMode || '').startsWith('vertical');
    //  Label produk menempel: digeser setengah tinggi (data-dy -1 = di atas titik, 1 = di bawah).
    const dy = Number(el.dataset.dy || 0) * (kh / 2 + 1 * skala);
    const latar = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent' ? cs.backgroundColor : 'rgba(15,23,42,0.85)';
    g.save();
    g.translate(x, y + dy);
    if (tegak) g.rotate(Math.PI / 2);
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = 3 * skala; g.shadowOffsetY = 1 * skala;
    g.fillStyle = latar;
    g.beginPath();
    if (typeof g.roundRect === 'function') g.roundRect(-kw / 2, -kh / 2, kw, kh, 6 * skala); else g.rect(-kw / 2, -kh / 2, kw, kh);
    g.fill();
    g.restore();
    g.fillStyle = cs.color || '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    baris.forEach((b, i) => g.fillText(b, 0, -kh / 2 + 2 * skala + tb * (i + 0.5)));
    g.restore();
  });
}
