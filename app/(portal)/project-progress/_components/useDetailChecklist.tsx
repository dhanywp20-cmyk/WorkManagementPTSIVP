'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { type ConfirmState } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { loadXLSX } from '@/lib/xlsx-loader';
import { KOLOM_TEMPLATE, formatWaktu, statDari, type ChecklistDetail, type ChecklistItem, type ChecklistRiwayat, type DraftChecklist } from '@/lib/checklist/inti';
import { itemPerBagian, kirimFoto } from './tampilan';
import { ringkasChecklist } from './ringkasan/hitung';
import { useTertunda } from './tertunda';
import { panggil, pesanGalat } from './api';
import type { FormItem, FormBagian, FormInfo } from './DetailChecklist';

export interface DetailChecklistKonteks {
  id: string;
  onBerubah: () => void;
  namaSaya: string;
  beritahu: (type: "success" | "error", msg: string) => void;
  onKembali: () => void;
}

export function useDetailChecklist(k: DetailChecklistKonteks) {
  const { id, onBerubah, namaSaya, beritahu, onKembali } = k;
  const [detail, setDetail] = useState<ChecklistDetail | null>(null);
  const [galat, setGalat] = useState('');
  const [sedangId, setSedangId] = useState<string | null>(null);
  const [sembunyikan, setSembunyikan] = useState(false);
  const [hanyaKendala, setHanyaKendala] = useState(false);
  const [formItem, setFormItem] = useState<FormItem | null>(null);
  const [formBagian, setFormBagian] = useState<FormBagian | null>(null);
  const [formInfo, setFormInfo] = useState<FormInfo | null>(null);
  const [formAnggota, setFormAnggota] = useState<string[] | null>(null);
  const [kendalaUntuk, setKendalaUntuk] = useState<ChecklistItem | null>(null);
  const [imporBuka, setImporBuka] = useState(false);
  const [shareBuka, setShareBuka] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [menyimpanCentang, setMenyimpanCentang] = useState(false);
  const [salinBuka, setSalinBuka] = useState(false);

  const muat = useCallback(async () => {
    try {
      setDetail(await panggil<ChecklistDetail>(`/api/project-progress/checklist/${id}`));
      setGalat('');
    } catch (e) {
      setGalat(pesanGalat(e, 'Gagal memuat checklist.'));
    }
  }, [id]);

  useEffect(() => { muat(); }, [muat]);

  const ubah = useCallback(async (body: Record<string, unknown>) => {
    const hasil = await panggil<Record<string, unknown>>(`/api/project-progress/checklist/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    onBerubah();
    return hasil;
  }, [id, onBerubah]);

  const gantiItem = (baru: ChecklistItem) => setDetail(d => d && { ...d, items: d.items.map(i => (i.id === baru.id ? baru : i)) });

  const hak = detail?.hak ?? { admin: false, edit: false };
  const t = useTertunda(detail?.items, namaSaya, 'admin');
  const itemsTampil = useMemo(() => (detail ? detail.items.map(t.tampil) : []), [detail, t.tampil]);
  const peta = useMemo(() => (detail ? itemPerBagian(detail.bagian, itemsTampil) : new Map<string, ChecklistItem[]>()), [detail, itemsTampil]);
  const stat = detail ? statDari(itemsTampil) : null;
  const ringkasan = useMemo(() => ringkasChecklist(detail?.daftar ?? { start_date: null, target_date: null }, itemsTampil, detail?.anggota ?? []), [detail, itemsTampil]);

  const toggle = (item: ChecklistItem) => t.toggle(item);

  const simpanKendala = async (item: ChecklistItem, kendala: boolean, catatan: string) => {
    t.aturKendala(item, kendala, catatan);
  };

  const simpanCentang = async () => {
    if (!t.jumlah || menyimpanCentang) return;
    setMenyimpanCentang(true);
    try {
      const hasil = await ubah({ aksi: 'simpan', perubahan: t.daftar }) as { items: ChecklistItem[]; riwayat: ChecklistRiwayat[] };
      const baru = new Map(hasil.items.map(i => [i.id, i]));
      setDetail(d => d && {
        ...d,
        items: d.items.map(i => baru.get(i.id) ?? i),
        riwayat: [...hasil.riwayat, ...(d.riwayat ?? [])].slice(0, 80),
      });
      t.reset();
      beritahu('success', `${hasil.items.length} item tersimpan.`);
    } catch (e) {
      beritahu('error', pesanGalat(e, 'Gagal menyimpan. Perubahan Anda masih ada - coba Simpan lagi.'));
    } finally {
      setMenyimpanCentang(false);
    }
  };

  const kembali = () => {
    if (!t.jumlah) { onKembali(); return; }
    setKonfirmasi({
      message: `${t.jumlah} perubahan belum disimpan`, description: 'Perubahan akan hilang bila kembali sekarang.',
      confirmLabel: 'Tetap kembali', danger: true, onConfirm: () => { setKonfirmasi(null); onKembali(); },
    });
  };

  const unggahFoto = async (item: ChecklistItem, file: File) => {
    setSedangId(item.id);
    try {
      gantiItem(await kirimFoto(`/api/project-progress/checklist/${id}/foto`, item.id, file));
      onBerubah();
      beritahu('success', 'Foto bukti tersimpan.');
    } catch (e) {
      beritahu('error', pesanGalat(e, 'Gagal mengunggah foto.'));
    } finally {
      setSedangId(null);
    }
  };

  const jalankan = async (body: Record<string, unknown>, sukses: string, tutup: () => void,
    terapkan: (hasil: Record<string, unknown>) => void) => {
    setMenyimpan(true);
    try { const hasil = await ubah(body); terapkan(hasil); tutup(); beritahu('success', sukses); }
    catch (e) { beritahu('error', pesanGalat(e, 'Gagal menyimpan.')); }
    finally { setMenyimpan(false); }
  };

  const hapusItem = (item: ChecklistItem) => setKonfirmasi({
    message: 'Hapus item ini?',
    description: `"${item.teks}" dihapus dari checklist. Riwayat centangnya tetap tersimpan.`,
    confirmLabel: 'Hapus', danger: true,
    onConfirm: async () => {
      setKonfirmasi(null);
      try {
        await ubah({ aksi: 'hapusItem', itemId: item.id });
        setDetail(d => d && { ...d, items: d.items.filter(i => i.id !== item.id) });
        beritahu('success', 'Item dihapus.');
      }
      catch (e) { beritahu('error', pesanGalat(e, 'Gagal menghapus.')); }
    },
  });

  const hapusChecklist = () => setKonfirmasi({
    message: `Hapus checklist "${detail?.daftar.judul}"?`,
    description: 'Semua item, centang, foto, kendala, dan riwayatnya ikut terhapus permanen. Link tim berhenti berfungsi.',
    confirmLabel: 'Hapus permanen', danger: true,
    onConfirm: async () => {
      setKonfirmasi(null);
      try {
        await panggil(`/api/project-progress/checklist/${id}`, { method: 'DELETE' });
        onBerubah();
        beritahu('success', 'Checklist dihapus.');
        onKembali();
      } catch (e) { beritahu('error', pesanGalat(e, 'Gagal menghapus.')); }
    },
  });

  const imporIsi = async (draft: DraftChecklist) => {
    const { jumlah } = await ubah({ aksi: 'impor', draft }) as { jumlah: number };
    setImporBuka(false);
    await muat();
    beritahu('success', `${jumlah} item ditambahkan.`);
  };

  const ubahShare = async (aksi: 'share' | 'tokenBaru', aktif?: boolean) => {
    const hasil = await ubah({ aksi, aktif }) as { share_aktif: boolean; share_token: string };
    setDetail(d => d && { ...d, daftar: { ...d.daftar, ...hasil } });
  };

  const ekspor = () => {
    if (!detail) return;
    loadXLSX(XLSX => {
      const rows: string[][] = [[...KOLOM_TEMPLATE, 'Oleh', 'Waktu', 'Lewat', 'Kendala', 'Foto']];
      for (const b of detail.bagian) {
        const items = peta.get(b.id) ?? [];
        if (!items.length && b.catatan) rows.push([b.judul, '', '', b.catatan.replace(/\n/g, ' '), '', '', '', '', '', '']);
        for (const it of items) {
          rows.push([b.judul, it.kelompok, it.teks, it.catatan, it.selesai ? 'Selesai' : it.kendala ? 'Kendala' : 'Belum',
            it.selesai_oleh ?? '', formatWaktu(it.selesai_pada), it.selesai_lewat === 'link' ? 'link' : it.selesai ? 'aplikasi' : '',
            it.kendala ? `${it.kendala_catatan} (${it.kendala_oleh ?? ''} ${formatWaktu(it.kendala_pada)})` : '', it.foto_url ?? '']);
        }
      }
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 60 }, { wch: 30 }, { wch: 9 }, { wch: 18 }, { wch: 16 }, { wch: 8 }, { wch: 40 }, { wch: 30 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Checklist');
      const nama = `${detail.proyek.nama} - ${detail.daftar.judul}`.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 100);
      XLSX.writeFile(wb, `${nama}.xlsx`);
    });
  };

  const isian = 'mt-1 w-full rounded-xl px-3 py-2 text-[13px] outline-hidden focus:ring-2';
  const gayaIsian = { border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta, background: NETRAL.permukaan };
  const label = (t: string) => <span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>{t}</span>;
  return {
    galat, detail, muat, stat, hak, toggle, setKendalaUntuk, unggahFoto,
    setFormItem, hapusItem, hanyaKendala, kembali, setShareBuka, setImporBuka, ekspor, setSalinBuka,
    setFormInfo, hapusChecklist, setFormAnggota, ringkasan, setHanyaKendala, sembunyikan, setSembunyikan, peta,
    sedangId, setFormBagian, formItem, menyimpan, jalankan, setDetail, label, isian,
    gayaIsian, formBagian, formInfo, formAnggota, kendalaUntuk, simpanKendala, t, menyimpanCentang,
    simpanCentang, salinBuka, imporBuka, imporIsi, ubahShare, shareBuka, konfirmasi, setKonfirmasi,
  };
}
