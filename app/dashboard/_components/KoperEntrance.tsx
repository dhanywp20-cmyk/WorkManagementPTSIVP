'use client';

/**
 * KoperEntrance — lapisan animasi koper di panel putih halaman login.
 *
 * Tiga peristiwa yang ditanganinya:
 *
 *   masuk   koper berjalan dari kiri, menabrak, terguling, terbuka, lalu
 *           kartu login TUMBUH dari mulut koper. Dijalankan sekali saat
 *           halaman login pertama tampil.
 *   putar   pengguna menekan "Daftar di sini": koper berputar di tempat
 *           sementara kartunya bertukar isi.
 *   ulang   pengguna kembali ke form masuk: seluruh adegan diputar lagi dari
 *           nol, seperti pertama kali membuka halaman.
 *   keluar  login berhasil: kartu menyusut kembali ke mulut koper lewat jalur
 *           yang sama persis dengan waktu ia keluar, lalu tutup koper mengatup.
 *
 * ── Kartu login tidak boleh pernah hilang ────────────────────────────────
 * Komponen ini menggerakkan kartu lewat gaya sebaris (inline style), dan itu
 * berbahaya: kalau ada yang gagal di tengah jalan, kartu bisa tertinggal
 * dalam keadaan kecil atau tembus pandang, dan orang tidak bisa masuk.
 *
 * Karena itu kartu hanya disentuh SETELAH tiga hal terbukti berhasil: three.js
 * termuat, konteks WebGL terbentuk, dan gelung gambar benar-benar berjalan.
 * Bila salah satu gagal, komponen mengembalikan null dan tidak pernah
 * menyentuh kartu sama sekali — halaman login tampil apa adanya. Ditambah dua
 * jaring pengaman: pengatur waktu batas, dan pemulihan saat tab disembunyikan
 * (browser membekukan requestAnimationFrame di tab latar, dan tanpa ini kartu
 * akan membeku di tengah animasi).
 */

import React, { useEffect, useRef } from 'react';
import type { Adegan } from './koper-adegan';

/* Kartu login dikenali lewat kelas ini. Harus sama dengan yang dipasang di
   app/dashboard/page.tsx. */
const KELAS_KARTU = 'lc-kartu';

const WAKTU = {
  /** Panjang seluruh adegan masuk. */
  adegan: 6.8,
  /** Kartu mulai tumbuh dari mulut koper. */
  kartuMulai: 4.55,
  /** Lama tumbuhnya sampai ukuran penuh. */
  kartuLama: 0.80,
  /** Lebar menyusul tinggi sekian detik — kesan terdorong keluar, bukan di-zoom. */
  kartuJedaLebar: 0.05,
  /** Lama koper berputar saat pindah ke form pendaftaran. */
  putar: 0.8,
  /** Titik pada jam adegan tempat urutan "login berhasil" dimulai. */
  keluarMulai: 6.90,
  /** Kartu mulai menyusut kembali ke koper. Jedanya dari awal urutan sengaja
   *  pendek: tanda centang sudah tampil dalam ~25 ms lewat React, jadi menahan
   *  animasi seperempat detik hanya menambah waktu tunggu tanpa menambah
   *  informasi apa pun. */
  keluarKartu: 7.00,
  /** Lama kartu menyusut. */
  keluarKartuLama: 0.35,
  /** Seluruh urutan keluar selesai. Sengaja dipotong sedikit sebelum pantulan
   *  engsel benar-benar mereda: derajat terakhirnya nyaris tak terlihat, dan
   *  menunggunya hanya menambah waktu tunggu orang yang mau bekerja. */
  keluarHabis: 7.66,
  /** Batas aman: lewat ini kartu dipaksa utuh, apa pun yang terjadi. */
  batas: 12_000,
};

type Fase = 'masuk' | 'diam' | 'putar' | 'keluar';

/** Sedikit melewati ukuran penuh lalu mapan. */
function balik(u: number): number {
  const c1 = 1.15, c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}

function gerakDikurangi(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function KoperEntrance({
  modeDaftar,
  keluar = false,
  onKeluarSelesai,
}: {
  modeDaftar: boolean;
  keluar?: boolean;
  /** Dipanggil sekali saat tutup koper selesai mengatup. Halaman memakai ini
   *  untuk berpindah ke dashboard, alih-alih menebak dengan angka tetap —
   *  animasinya bisa mulai terlambat sepersekian detik (menunggu three.js,
   *  bingkai pertama), dan dengan angka tetap ujungnya terpotong. */
  onKeluarSelesai?: () => void;
}) {
  const kanvasRef = useRef<HTMLCanvasElement | null>(null);
  const adeganRef = useRef<Adegan | null>(null);
  const faseRef = useRef<Fase>('masuk');
  const waktuRef = useRef(0);
  const putarRef = useRef(0);
  const modeRef = useRef(modeDaftar);

  /* Dipakai efek kedua untuk memicu putaran / pengulangan tanpa membangun
     ulang seluruh adegan. */
  const perintahRef = useRef<((apa: 'putar' | 'ulang' | 'keluar') => void) | null>(null);
  const keluarRef = useRef(keluar);
  /* Disimpan di ref supaya gelung gambar selalu memanggil versi terbaru tanpa
     perlu disusun ulang tiap render. */
  const selesaiRef = useRef(onKeluarSelesai);
  selesaiRef.current = onKeluarSelesai;

  useEffect(() => {
    if (gerakDikurangi()) return;
    const kanvas = kanvasRef.current;
    if (!kanvas) return;

    let hidup = true;
    let bingkai = 0;
    let batasWaktu = 0;

    const kartu = () => document.querySelector<HTMLElement>('.' + KELAS_KARTU);

    /** Mengembalikan kartu ke keadaan wajarnya. Aman dipanggil kapan saja. */
    const bebaskanKartu = () => {
      const k = kartu();
      if (!k) return;
      k.style.opacity = '';
      k.style.transform = '';
      k.style.transformOrigin = '';
    };

    /** Titik tumbuh kartu = mulut koper, dihitung dari ukuran TATA LETAK.
     *  getBoundingClientRect tidak dipakai karena kartunya sedang diskalakan;
     *  rect selalu melaporkan kotak yang sudah tertransformasi, sehingga titik
     *  tumbuhnya ikut mengecil dan hasilnya melenceng makin jauh tiap bingkai. */
    const tautkanTitikTumbuh = (k: HTMLElement, adegan: Adegan) => {
      const lapisan = kanvas.parentElement;
      if (!lapisan || !k.offsetWidth || !lapisan.offsetWidth) return;
      const x = lapisan.offsetLeft + (adegan.mulut.x / 100) * lapisan.offsetWidth - k.offsetLeft;
      // Sedikit lebih ke dalam badan koper, bukan tepat di bibirnya: hanya
      // dengan begitu tepi bawah kartu benar-benar tertutup dinding koper.
      const y = lapisan.offsetTop + (adegan.mulut.y / 100 + 0.045) * lapisan.offsetHeight - k.offsetTop;
      k.style.transformOrigin = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    };

    /* Kartu menyusut kembali ke mulut koper. Titik tumbuhnya sengaja TIDAK
       dihitung ulang: ia sudah tertaut ke mulut koper saat kartu keluar tadi,
       dan memakai titik yang sama membuat jalur pergi dan pulangnya benar-benar
       satu garis. Kurvanya ease-IN — kebalikan dari waktu keluar yang melambat
       di ujung, sehingga terbaca seperti ditarik masuk, bukan mengempis. */
    const gambarKartuKeluar = (t: number) => {
      const k = kartu();
      if (!k) return;
      const u = Math.min(1, Math.max(0, (t - WAKTU.keluarKartu) / WAKTU.keluarKartuLama));
      const e = u * u * u;
      const s = 1 - 0.90 * e;
      k.style.opacity = String(1 - Math.max(0, (u - 0.72) / 0.28));
      k.style.transform = `scale(${s.toFixed(4)})`;
    };

    const gambarKartu = (t: number, adegan: Adegan) => {
      const k = kartu();
      if (!k) return;
      tautkanTitikTumbuh(k, adegan);
      const uy = Math.min(1, Math.max(0, (t - WAKTU.kartuMulai) / WAKTU.kartuLama));
      const ux = Math.min(1, Math.max(0, (t - WAKTU.kartuMulai - WAKTU.kartuJedaLebar) / WAKTU.kartuLama));
      if (uy >= 1 && ux >= 1) { bebaskanKartu(); return; }
      k.style.opacity = String(Math.min(1, uy / 0.18));
      k.style.transform = `scale(${(0.10 + 0.90 * balik(ux)).toFixed(4)},${(0.10 + 0.90 * balik(uy)).toFixed(4)})`;
    };

    (async () => {
      let adegan: Adegan;
      try {
        const modul = await import('./koper-adegan');
        if (!hidup) return;
        adegan = modul.buatAdegan(kanvas, { kecil: window.innerWidth < 1024 });
      } catch {
        // three.js gagal dimuat, atau WebGL tidak tersedia. Tidak ada animasi,
        // dan yang penting: kartu tidak pernah disentuh.
        return;
      }
      if (!hidup) { adegan.lepas(); return; }
      adeganRef.current = adegan;
      kanvas.style.opacity = '1';
      /* Penanda bahwa JS mengambil alih kartu. Selama kelas ini belum ada,
         CSS-lah yang memunculkan kartu (lihat app/globals.css). Dipasang di
         sini — bukan di awal — supaya kegagalan memuat three.js tidak pernah
         mematikan jaring pengamannya. */
      document.documentElement.classList.add('lc-js');

      perintahRef.current = (apa) => {
        if (apa === 'putar') { faseRef.current = 'putar'; putarRef.current = 0; }
        else if (apa === 'keluar') {
          // Kartu harus utuh dulu sebelum menyusut, apa pun keadaan sebelumnya.
          bebaskanKartu();
          adegan.setPutar(0);
          faseRef.current = 'keluar';
          waktuRef.current = WAKTU.keluarMulai;
        } else { faseRef.current = 'masuk'; waktuRef.current = 0; putarRef.current = 0; adegan.setPutar(0); }
        batasWaktu = performance.now() + WAKTU.batas;
      };

      const ukur = () => adegan.ukur();
      window.addEventListener('resize', ukur);

      /* Tab disembunyikan → requestAnimationFrame dibekukan browser. Tanpa ini
         kartu bisa membeku setengah tumbuh sampai tab dibuka lagi. */
      const saatTersembunyi = () => {
        if (document.visibilityState !== 'hidden') return;
        if (faseRef.current === 'masuk') {
          waktuRef.current = WAKTU.adegan;
          adegan.setWaktu(WAKTU.adegan);
          faseRef.current = 'diam';
          bebaskanKartu();
        } else if (faseRef.current !== 'keluar') {
          bebaskanKartu();
        }
      };
      document.addEventListener('visibilitychange', saatTersembunyi);

      let sebelum = 0;
      batasWaktu = performance.now() + WAKTU.batas;

      const langkah = (ms: number) => {
        if (!hidup) return;
        bingkai = requestAnimationFrame(langkah);
        const d = sebelum ? Math.min(0.05, (ms - sebelum) / 1000) : 0;
        sebelum = ms;

        // Jaring pengaman terakhir: apa pun yang terjadi, kartu tidak boleh
        // tertinggal kecil atau tembus pandang lebih lama dari ini.
        if (ms > batasWaktu && faseRef.current === 'masuk') {
          waktuRef.current = WAKTU.adegan;
          faseRef.current = 'diam';
          bebaskanKartu();
        }

        if (faseRef.current === 'masuk') {
          waktuRef.current = Math.min(WAKTU.adegan, waktuRef.current + d);
          adegan.setWaktu(waktuRef.current);
          gambarKartu(waktuRef.current, adegan);
          if (waktuRef.current >= WAKTU.adegan) { faseRef.current = 'diam'; bebaskanKartu(); }
        } else if (faseRef.current === 'keluar') {
          waktuRef.current = Math.min(WAKTU.keluarHabis, waktuRef.current + d);
          adegan.setWaktu(waktuRef.current);
          gambarKartuKeluar(waktuRef.current);
          if (waktuRef.current >= WAKTU.keluarHabis) {
            faseRef.current = 'diam';
            const beres = selesaiRef.current;
            selesaiRef.current = undefined;   // sekali saja
            beres?.();
          }
        } else if (faseRef.current === 'putar') {
          putarRef.current = Math.min(WAKTU.putar, putarRef.current + d);
          const u = putarRef.current / WAKTU.putar;
          adegan.setPutar(Math.PI * 2 * (u * u * (3 - 2 * u)));   // mulai & henti halus
          adegan.setWaktu(waktuRef.current);
          if (putarRef.current >= WAKTU.putar) { adegan.setPutar(0); faseRef.current = 'diam'; }
        }
      };
      bingkai = requestAnimationFrame(langkah);

      return () => {
        window.removeEventListener('resize', ukur);
        document.removeEventListener('visibilitychange', saatTersembunyi);
      };
    })();

    return () => {
      hidup = false;
      cancelAnimationFrame(bingkai);
      bebaskanKartu();
      adeganRef.current?.lepas();
      adeganRef.current = null;
      perintahRef.current = null;
    };
  }, []);

  /* Menanggapi perpindahan masuk ⇄ daftar. Diabaikan bila urutan keluar sudah
     berjalan — pada titik itu halaman login sedang ditinggalkan. */
  useEffect(() => {
    if (keluarRef.current) return;
    if (modeRef.current === modeDaftar) return;
    const keDaftar = modeDaftar;
    modeRef.current = modeDaftar;
    perintahRef.current?.(keDaftar ? 'putar' : 'ulang');
  }, [modeDaftar]);

  /* Login berhasil. Sekali dipicu, tidak bisa dibatalkan. */
  useEffect(() => {
    if (!keluar || keluarRef.current) return;
    keluarRef.current = true;
    perintahRef.current?.('keluar');
  }, [keluar]);

  if (gerakDikurangi()) return null;

  return (
    <div className="lc-anim" aria-hidden="true">
      {/* opacity dinaikkan setelah adegan benar-benar siap, supaya tidak ada
          kedipan kanvas kosong sebelum bingkai pertama tergambar. */}
      <canvas ref={kanvasRef} className="lc-anim-kanvas" style={{ opacity: 0 }} />
    </div>
  );
}

export default KoperEntrance;
