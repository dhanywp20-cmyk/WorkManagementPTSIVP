'use client';
/**
 * "📚 Isi dari Pustaka" di panel Atur benda: proyektor, display/videowall & speaker diisi dari
 * katalog produk yang dikelola Admin (Tools Team › Pustaka). Tidak tampil bila belum ada entri cocok.
 */
import { cocokPustaka, isiDariPustaka, PUSTAKA_UNTUK, terapkanUkuran } from '../../inti';
import { PilihPustaka } from '../../../pustaka/PilihPustaka';
import type { KonteksAtur } from './konteks';

export function DariPustaka({ c }: { c: KonteksAtur }) {
  const { b, onUbah } = c;
  const jenis = PUSTAKA_UNTUK[b.jenis];
  if (!jenis) return null;
  return (
    <PilihPustaka jenis={jenis} label="Isi dari Pustaka" saring={e => cocokPustaka(b.jenis, e)}
      //  terapkanUkuran langsung (bukan setUkuran) supaya nama produk dari pustaka tidak diganti nama bawaan.
      onPilih={e => { const x = isiDariPustaka(b, e); if (x) onUbah(terapkanUkuran({ ...b, ...x })); }} />
  );
}
