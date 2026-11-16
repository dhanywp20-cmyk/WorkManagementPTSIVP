'use client';
import { useMemo, useRef, useState } from 'react';
import type { AdapterBerkas, FileAktif } from './tipe';

type Pesan = { teks: string; galat: boolean } | null;

export function useBerkas({ adapter, data, terapkan, namaAwal, hanyaLihat = false, kosongkan }: {
  adapter: AdapterBerkas; data: unknown; terapkan: (d: unknown) => boolean; namaAwal: () => string; hanyaLihat?: boolean; kosongkan?: () => void;
}) {
  const [aktif, setAktif] = useState<FileAktif | null>(null);
  const kunci = useMemo(() => JSON.stringify(data) ?? '', [data]);
  const [dasar, setDasar] = useState<string | null>(null);
  if (dasar === null) setDasar(kunci);
  const berubah = dasar !== null && kunci !== dasar;
  const [dialog, setDialog] = useState<null | 'buka' | 'sebagai'>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesanState] = useState<Pesan>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setPesan = (p: Pesan) => {
    setPesanState(p);
    clearTimeout(timer.current);
    if (p && !p.galat) timer.current = setTimeout(() => setPesanState(null), 5000);
  };

  const kirim = async (nama: string, id?: string) => {
    if (hanyaLihat) { setPesan({ teks: 'Akun ini hanya bisa melihat - tidak bisa menyimpan.', galat: true }); return false; }
    setSibuk(true);
    try {
      const f = await adapter.kirim({ id, nama: nama.trim() || namaAwal(), data });
      setAktif(f); setDasar(kunci);
      setPesan({ teks: id ? (id === aktif?.id ? `Tersimpan: ${f.nama}` : `"${f.nama}" diganti dengan isi ini`) : `Tersimpan sebagai berkas baru: ${f.nama}`, galat: false });
      return true;
    } catch (e) { setPesan({ teks: (e as Error).message, galat: true }); return false; } finally { setSibuk(false); }
  };

  const simpan = async () => {
    if (aktif?.bolehUbah && !hanyaLihat) return kirim(aktif.nama, aktif.id);
    setDialog('sebagai');
    return false;
  };
  const simpanSebagai = async (nama: string, gantiId?: string) => {
    const ok = await kirim(nama, gantiId);
    if (ok) setDialog(null);
    return ok;
  };
  const buka = async (id: string) => {
    setSibuk(true);
    try {
      const { data: d, file } = await adapter.ambil(id);
      if (!terapkan(d)) throw new Error('Isi berkas tidak dikenali alat ini.');
      setAktif(file); setDasar(null); setDialog(null);
      setPesan({ teks: file.bolehUbah ? `Dibuka: ${file.nama}` : `Dibuka: ${file.nama} (milik anggota lain - Simpan membuat salinan Anda)`, galat: false });
      return true;
    } catch (e) { setPesan({ teks: (e as Error).message, galat: true }); return false; } finally { setSibuk(false); }
  };
  const hapus = async (id: string) => {
    await adapter.hapus(id);
    if (aktif?.id === id) setAktif(null);
  };
  const baru = kosongkan ? () => { kosongkan(); setAktif(null); setDasar(null); setPesan(null); } : undefined;
  const pakaiFile = (f: FileAktif | null) => { setAktif(f); setDasar(null); };

  return { adapter, aktif, berubah, dialog, setDialog, sibuk, pesan, setPesan, simpan, simpanSebagai, buka, hapus, baru, namaAwal, hanyaLihat, pakaiFile };
}

export type Berkas = ReturnType<typeof useBerkas>;
