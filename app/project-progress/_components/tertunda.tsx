'use client';

/**
 * Perubahan yang menunggu tombol Simpan.
 *
 * Centang & kendala TIDAK dikirim per klik. Semuanya ditampung di peramban,
 * langsung terlihat di layar (ditandai "belum disimpan"), lalu dikirim SEKALI
 * saat Simpan ditekan. Satu sesi kerja = satu permintaan ke server - penting
 * karena Vercel & Supabase dipakai di paket gratis (kuota egress & fungsi).
 *
 * Waktu tiap perubahan dicatat dari perangkat saat diklik, jadi riwayat
 * tetap menunjukkan kapan item dikerjakan, bukan kapan disimpan.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { NETRAL } from '@/lib/desain';
import type { ChecklistItem, LewatCentang, PerubahanItem } from '@/lib/checklist';
import { TEMA } from './tampilan';

/** Terapkan satu perubahan ke item - urutan sama dengan server (simpanPerubahan). */
function terapkan(it: ChecklistItem, p: PerubahanItem, nama: string, lewat: LewatCentang): ChecklistItem {
  const hasil: ChecklistItem = { ...it, tertunda: true };
  const waktu = p.waktu ?? new Date().toISOString();
  if (p.kendala === true) {
    Object.assign(hasil, {
      kendala: true, kendala_catatan: p.catatan ?? '', kendala_oleh: nama, kendala_pada: waktu,
      selesai: false, selesai_oleh: null, selesai_pada: null, selesai_lewat: null,
    });
  } else if (p.kendala === false) {
    hasil.kendala = false;
  }
  if (typeof p.selesai === 'boolean' && p.selesai !== hasil.selesai) {
    Object.assign(hasil, p.selesai
      ? { selesai: true, selesai_oleh: nama, selesai_pada: waktu, selesai_lewat: lewat, kendala: false }
      : { selesai: false, selesai_oleh: null, selesai_pada: null, selesai_lewat: null });
  }
  return hasil;
}

export function useTertunda(items: ChecklistItem[] | undefined, nama: string, lewat: LewatCentang) {
  const [peta, setPeta] = useState<Map<string, PerubahanItem>>(new Map());
  const asli = useMemo(() => new Map((items ?? []).map(i => [i.id, i])), [items]);

  const tampil = useCallback((it: ChecklistItem): ChecklistItem => {
    const p = peta.get(it.id);
    return p ? terapkan(it, p, nama || 'Anda', lewat) : it;
  }, [peta, nama, lewat]);

  const ubah = useCallback((itemId: string, fn: (p: PerubahanItem, dasar: ChecklistItem) => PerubahanItem | null) => {
    setPeta(prev => {
      const dasar = asli.get(itemId);
      if (!dasar) return prev;
      const lanjut = new Map(prev);
      const hasil = fn({ ...(prev.get(itemId) ?? { itemId }), waktu: new Date().toISOString() }, dasar);
      if (hasil) lanjut.set(itemId, hasil); else lanjut.delete(itemId);
      return lanjut;
    });
  }, [asli]);

  /** Balik centang item seperti yang sedang TAMPIL. Kembali ke asal = tidak ada perubahan. */
  const toggle = useCallback((it: ChecklistItem) => {
    ubah(it.id, (p, dasar) => {
      const sekarang = terapkan(dasar, p, '', lewat);
      const tujuan = !sekarang.selesai;
      const baru: PerubahanItem = { ...p, selesai: tujuan };
      // Menyelesaikan item melepas kendalanya - tidak perlu kendala tertunda.
      if (tujuan && baru.kendala === true) { delete baru.kendala; delete baru.catatan; }
      if (baru.selesai === dasar.selesai && !(dasar.kendala && tujuan)) delete baru.selesai;
      return baru.selesai === undefined && baru.kendala === undefined ? null : baru;
    });
  }, [ubah, lewat]);

  const aturKendala = useCallback((it: ChecklistItem, kendala: boolean, catatan: string) => {
    ubah(it.id, (p, dasar) => {
      const baru: PerubahanItem = { ...p, kendala, catatan: kendala ? catatan : undefined };
      // Kendala membatalkan centang selesai.
      if (kendala) delete baru.selesai;
      if (kendala === dasar.kendala && (!kendala || catatan === dasar.kendala_catatan)) { delete baru.kendala; delete baru.catatan; }
      return baru.selesai === undefined && baru.kendala === undefined ? null : baru;
    });
  }, [ubah]);

  const daftar = useMemo(() => Array.from(peta.values()), [peta]);
  const reset = useCallback(() => setPeta(new Map()), []);

  // Peringatan bila halaman ditutup / dimuat ulang sebelum Simpan.
  useEffect(() => {
    if (!peta.size) return;
    const tahan = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', tahan);
    return () => window.removeEventListener('beforeunload', tahan);
  }, [peta.size]);

  return { tampil, toggle, aturKendala, daftar, jumlah: peta.size, reset };
}

/** Bilah menempel di bawah layar selama ada perubahan yang belum disimpan. */
export function BilahSimpan({ jumlah, sibuk, onSimpan, onBatal }: {
  jumlah: number; sibuk: boolean; onSimpan: () => void; onBatal: () => void;
}) {
  if (!jumlah) return null;
  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] px-3 pb-3 pt-2 pointer-events-none" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
      <div className="pointer-events-auto max-w-3xl mx-auto rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ background: NETRAL.tinta, color: '#fff', boxShadow: '0 10px 30px rgba(15,23,42,0.35)' }}>
        <p className="flex-1 min-w-0 text-[13px] font-semibold">
          <span className="font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{jumlah}</span> perubahan belum disimpan
        </p>
        <button type="button" onClick={onBatal} disabled={sibuk}
          className="px-3 py-2 rounded-lg text-[12.5px] font-bold disabled:opacity-50" style={{ color: '#cbd5e1' }}>
          Batal
        </button>
        <button type="button" onClick={onSimpan} disabled={sibuk}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold disabled:opacity-60"
          style={{ background: TEMA.warna, color: '#fff' }}>
          {sibuk ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan
        </button>
      </div>
    </div>
  );
}
