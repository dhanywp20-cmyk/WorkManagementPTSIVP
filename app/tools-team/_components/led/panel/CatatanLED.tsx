'use client';
/** Catatan cara hitung Kalkulator LED. */
import { f } from '../../bersama/ui';
import { PER_M2 } from '../data';
import type { AlatLED } from './alat';

export function CatatanLED({ a }: { a: AlatLED }) {
  const { faktorDaya, faktorRata, lingkungan, namaUnit, tegangan } = a.K;
  return (
    <>
      <details className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
        <summary className="text-[13px] font-bold text-slate-800 cursor-pointer">Rumus & asumsi</summary>
        <ul className="mt-3 space-y-1.5 text-[12.5px] text-slate-700 list-disc pl-5">
          <li>Kolom = lebar target ÷ lebar {namaUnit}; baris = tinggi target ÷ tinggi {namaUnit}, dibulatkan sesuai pilihan (terdekat / ke bawah / ke atas).</li>
          <li>Resolusi = kolom × pixel/{namaUnit} (W), baris × pixel/{namaUnit} (H). Pixel/modul diambil dari tabel referensi; bisa diganti sesuai datasheet.</li>
          <li>Jarak pandang minimum (m) ≈ pitch (mm); nyaman ≈ 3 × pitch. Estimasi.</li>
          <li>Daya bawaan = {PER_M2[lingkungan].daya} W/m² maks ({lingkungan}); rata-rata = {faktorRata}% dari maks. Arus = W ÷ ({tegangan} V × PF {f(faktorDaya)}); MCB ≥ 1,25 × arus maks.</li>
          <li>Panas = daya rata-rata × 3,412 BTU/jam; 1 PK AC ≈ 9.000 BTU/jam.</li>
          <li>Port LAN = total pixel ÷ (655.360 × 60/refresh × 8/bit).</li>
          <li>Hardware dipilih yang terkecil dengan kapasitas pixel & port cukup; bila tidak ada, jumlah unit dihitung dari yang terbesar.</li>
        </ul>
      </details>
    </>
  );
}
