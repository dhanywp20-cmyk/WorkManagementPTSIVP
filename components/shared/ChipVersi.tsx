'use client';
import React from 'react';

/**
 * Keping identitas build: versi, commit, dan kapan dibangun.
 *
 * Gunanya bukan hiasan. Saat seseorang melaporkan "menu X error", pertanyaan
 * pertama selalu "Anda sedang melihat versi yang mana?" - dan selama jawabannya
 * harus ditebak, perbaikan yang sudah terkirim bisa disangka belum jalan
 * (persis yang terjadi waktu crash Incentive PTS: deploy lama dan baru terlihat
 * sama dari layar). Tujuh digit commit membuat layar mana pun bisa dipetakan
 * balik ke satu titik pasti di riwayat kode.
 *
 * Nilainya dibekukan saat build - lihat next.config.js.
 */
const VERSI    = process.env.NEXT_PUBLIC_VERSI_APP || '';
const KOMIT    = process.env.NEXT_PUBLIC_KOMIT_APP || '';
const DIBANGUN = process.env.NEXT_PUBLIC_DIBANGUN_APP || '';

export function ChipVersi({ gaya = 'gelap', className = '' }: {
  /** gelap = tinta gelap di atas latar terang; terang = tinta putih di atas latar gelap/foto. */
  gaya?: 'gelap' | 'terang';
  className?: string;
}) {
  //  Commit kosong di luar Vercel (mis. `next dev` di laptop) - segmennya
  //  dilewati, bukan ditampilkan sebagai strip kosong di antara dua titik.
  const bagian = [VERSI && `v${VERSI}`, KOMIT, DIBANGUN].filter(Boolean) as string[];
  if (bagian.length === 0) return null;

  const terang = gaya === 'terang';
  return (
    <span
      title={`Versi ${VERSI}${KOMIT ? ` · commit ${KOMIT}` : ''}${DIBANGUN ? ` · dibangun ${DIBANGUN}` : ''}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold tracking-wide ${className}`}
      style={terang
        ? { color: 'rgba(255,255,255,0.72)', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)' }
        : { color: '#64748b', background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(15,23,42,0.08)' }}>
      {bagian.map((b, i) => (
        <React.Fragment key={b}>
          {i > 0 && <span aria-hidden="true" style={{ opacity: 0.45 }}>·</span>}
          {/*  Commit ditulis monospace supaya terbaca sebagai KODE yang harus
              disalin apa adanya, bukan sebagai kata yang boleh diketik ulang
              sekenanya - tujuh huruf-angka acak gampang salah salin. */}
          <span className={i === 1 && KOMIT ? 'font-mono' : ''}>{b}</span>
        </React.Fragment>
      ))}
    </span>
  );
}
