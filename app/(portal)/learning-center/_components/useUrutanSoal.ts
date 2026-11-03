'use client';

import { supabase, Question, DialogState } from './shared';
import { perubahanUrutan, geser } from '@/lib/urutan-soal';

export interface UrutanSoalKonteks {
  load: () => Promise<void>;
  setDialog: import("react").Dispatch<import("react").SetStateAction<DialogState>>;
  setMenyimpanUrutan: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setUrutanDraf: import("react").Dispatch<import("react").SetStateAction<Record<string, string[]>>>;
  urutanDraf: Record<string, string[]>;
}

export function useUrutanSoal(k: UrutanSoalKonteks) {
  const { load, setDialog, setMenyimpanUrutan, setUrutanDraf, urutanDraf } = k;
  const susunanTampil = (kunci: string, grup: Question[]): Question[] => {
    const draf = urutanDraf[kunci];
    if (!draf) return grup;
    const peta = new Map(grup.map(q => [q.id, q]));
    const terurut = draf.map(id => peta.get(id)).filter((q): q is Question => !!q);
    const sisa = grup.filter(q => !draf.includes(q.id));
    return [...terurut, ...sisa];
  };

  const geserSoal = (kunci: string, grup: Question[], idx: number, arah: -1 | 1) => {
    const baru = geser(grup, idx, arah);
    if (!baru) return;
    setUrutanDraf(p => ({ ...p, [kunci]: baru.map(q => q.id) }));
  };

  const buangDraf = (kunci: string) =>
    setUrutanDraf(p => { const n = { ...p }; delete n[kunci]; return n; });

  const simpanUrutan = async (kunci: string, susunan: Question[]) => {
    const perubahan = perubahanUrutan(susunan);
    if (perubahan.length === 0) { buangDraf(kunci); return; }

    setMenyimpanUrutan(kunci);
    const hasil: { error: { message: string } | null }[] = await Promise.all(perubahan.map(x =>
      supabase.from('lc_questions').update({ urutan: x.urutan }).eq('id', x.id)
    ));
    setMenyimpanUrutan(null);

    const gagal = hasil.find(r => r.error)?.error;
    if (gagal) {
      setDialog({
        type: 'error', title: 'Urutan gagal disimpan',
        message: /urutan/i.test(gagal.message)
          ? 'Kolom urutan belum ada di database. Jalankan sql/learning-center-urutan-soal.sql lebih dulu.'
          : 'Error: ' + gagal.message,
      });
      return;
    }
    buangDraf(kunci);
    load();
    setDialog({ type: 'success', message: `Urutan ${perubahan.length} soal berhasil disimpan.` });
  };
  return { susunanTampil, geserSoal, buangDraf, simpanUrutan };
}
