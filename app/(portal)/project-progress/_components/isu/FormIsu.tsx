'use client';

import { useEffect, useMemo, useState } from 'react';
import { Camera } from 'lucide-react';
import { Modal, TombolModal } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { PRIORITAS_ISU, STATUS_ISU, URUTAN_STATUS, hariIni, type Isu, type LokasiIsu, type PrioritasIsu, type StatusIsu } from '@/lib/isu/inti';

const isian = 'mt-1 w-full rounded-xl px-3 py-2 text-[13px] outline-hidden focus:ring-2';
const gayaIsian = { border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta, background: NETRAL.permukaan };
const Label = ({ t, wajib }: { t: string; wajib?: boolean }) => (
  <span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>{t}{wajib && <span style={{ color: '#b91c1c' }}> *</span>}</span>
);
const LAIN = '__lain__';

export interface IsianFormIsu {
  daftar_id: string;
  lokasi: string;
  tanggal: string;
  kategori: string;
  prioritas: PrioritasIsu;
  judul: string;
  deskripsi: string;
  pelapor: string;
  pic: string;
  status: StatusIsu;
  action: string;
  solusi: string;
  catatan_internal: string;
}

export function ModalFormIsu({ buka, awal, lokasi, kategori, namaSaya, onTutup, onSimpan }: {
  buka: boolean;
  awal: Isu | null;
  lokasi: LokasiIsu[];
  kategori: string[];
  namaSaya: string;
  onTutup: () => void;
  onSimpan: (f: IsianFormIsu, foto: File | null) => Promise<void>;
}) {
  const kosong = (): IsianFormIsu => ({
    daftar_id: '', lokasi: '', tanggal: hariIni(), kategori: kategori[0] ?? 'Lainnya', prioritas: 'sedang', judul: '', deskripsi: '',
    pelapor: '', pic: namaSaya, status: 'open', action: '', solusi: '', catatan_internal: '',
  });
  const [f, setF] = useState<IsianFormIsu>(kosong);
  const [lain, setLain] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    if (!buka) return;
    setGalat(''); setFoto(null);
    if (awal) {
      setF({
        daftar_id: awal.daftar_id ?? '', lokasi: awal.lokasi, tanggal: awal.tanggal, kategori: awal.kategori, prioritas: awal.prioritas,
        judul: awal.judul, deskripsi: awal.deskripsi, pelapor: awal.pelapor, pic: awal.pic, status: awal.status, action: awal.action,
        solusi: awal.solusi, catatan_internal: awal.catatan_internal ?? '',
      });
      setLain(!awal.daftar_id);
    } else { setF(kosong()); setLain(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buka, awal]);

  const perProyek = useMemo(() => {
    const m = new Map<string, LokasiIsu[]>();
    for (const l of lokasi) m.set(l.proyek, [...(m.get(l.proyek) ?? []), l]);
    return [...m.entries()];
  }, [lokasi]);
  const daftarKategori = kategori.includes(f.kategori) || !f.kategori ? kategori : [...kategori, f.kategori];

  const set = <K extends keyof IsianFormIsu>(k: K, v: IsianFormIsu[K]) => setF(x => ({ ...x, [k]: v }));
  const lokasiTerisi = lain ? !!f.lokasi.trim() : !!f.daftar_id;
  const siap = lokasiTerisi && !!f.judul.trim() && (f.status !== 'solved' || !!f.solusi.trim());

  const simpan = async () => {
    if (!siap) { setGalat(f.status === 'solved' && !f.solusi.trim() ? 'Isi solusi untuk isu yang Solved.' : 'Lokasi dan judul isu wajib diisi.'); return; }
    setSibuk(true); setGalat('');
    try { await onSimpan({ ...f, daftar_id: lain ? '' : f.daftar_id }, foto); }
    catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.'); }
    finally { setSibuk(false); }
  };

  return (
    <Modal buka={buka} onTutup={() => !sibuk && onTutup()} ukuran="lg" tutupDiLuar={false} ikon="🛠️"
      judul={awal ? `Ubah isu #${awal.nomor}` : 'Catat isu baru'}
      keterangan="Isu tampil di ringkasan harian sesuai tanggal lapor, dan terus terbawa ke hari berikutnya sampai Solved."
      footer={<>
        <TombolModal onClick={onTutup} disabled={sibuk}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={simpan} disabled={sibuk || !siap}>{sibuk ? 'Menyimpan…' : 'Simpan'}</TombolModal>
      </>}>
      {galat && <p role="alert" className="mb-3 px-3 py-2 rounded-lg text-[12.5px] font-semibold" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>{galat}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><Label t="Lokasi" wajib />
          <select value={lain ? LAIN : f.daftar_id} className={isian} style={gayaIsian}
            onChange={e => { const v = e.target.value; if (v === LAIN) { setLain(true); set('daftar_id', ''); } else { setLain(false); set('daftar_id', v); } }}>
            <option value="">Pilih lokasi…</option>
            {perProyek.map(([proyek, ls]) => (
              <optgroup key={proyek} label={proyek}>{ls.map(l => <option key={l.id} value={l.id}>{l.nama}</option>)}</optgroup>
            ))}
            <option value={LAIN}>Lokasi lain (ketik)…</option>
          </select>
          {lain && <input value={f.lokasi} maxLength={120} placeholder="Nama lokasi" onChange={e => set('lokasi', e.target.value)} className={isian} style={gayaIsian} />}
        </label>
        <label className="block"><Label t="Tanggal lapor" wajib />
          <input type="date" value={f.tanggal} max={hariIni()} onChange={e => set('tanggal', e.target.value)} className={isian} style={gayaIsian} /></label>
        <label className="block sm:col-span-2"><Label t="Isu" wajib />
          <input value={f.judul} maxLength={200} autoFocus placeholder="mis. Mic delegate kursi 4 tidak bunyi"
            onChange={e => set('judul', e.target.value)} className={isian} style={gayaIsian} /></label>
        <label className="block sm:col-span-2"><Label t="Deskripsi / gejala" />
          <textarea value={f.deskripsi} rows={2} maxLength={3000} placeholder="Detail kondisi, kapan terjadi, sudah dicek apa saja"
            onChange={e => set('deskripsi', e.target.value)} className={isian} style={gayaIsian} /></label>
        <label className="block"><Label t="Kategori" />
          <select value={f.kategori} onChange={e => set('kategori', e.target.value)} className={isian} style={gayaIsian}>
            {daftarKategori.map(k => <option key={k} value={k}>{k}</option>)}
          </select></label>
        <label className="block"><Label t="Prioritas" />
          <select value={f.prioritas} onChange={e => set('prioritas', e.target.value as PrioritasIsu)} className={isian} style={gayaIsian}>
            {(Object.keys(PRIORITAS_ISU) as PrioritasIsu[]).map(p => <option key={p} value={p}>{PRIORITAS_ISU[p].label}</option>)}
          </select></label>
        <label className="block"><Label t="Pelapor" />
          <input value={f.pelapor} maxLength={120} placeholder="mis. Pak Budi (user BPKP)" onChange={e => set('pelapor', e.target.value)} className={isian} style={gayaIsian} /></label>
        <label className="block"><Label t="PIC penanganan" />
          <input value={f.pic} maxLength={120} placeholder="Teknisi yang menangani" onChange={e => set('pic', e.target.value)} className={isian} style={gayaIsian} /></label>
        <label className="block"><Label t="Status" />
          <select value={f.status} onChange={e => set('status', e.target.value as StatusIsu)} className={isian} style={gayaIsian}>
            {URUTAN_STATUS.map(s => <option key={s} value={s}>{STATUS_ISU[s].label}</option>)}
          </select></label>
        {!awal && (
          <div><Label t="Foto (opsional)" />
            <label className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-semibold cursor-pointer" style={{ ...gayaIsian, color: NETRAL.tinta2 }}>
              <Camera size={15} /> <span className="truncate">{foto ? foto.name : 'Pilih / ambil foto'}</span>
              <input type="file" accept="image/*" className="sr-only" onChange={e => setFoto(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        )}
        <label className="block sm:col-span-2"><Label t="Action / tindakan" />
          <textarea value={f.action} rows={2} maxLength={1500} placeholder="Apa yang sudah / akan dilakukan, mis. kirim unit pengganti dari Jakarta"
            onChange={e => set('action', e.target.value)} className={isian} style={gayaIsian} /></label>
        {(f.status === 'solved' || f.solusi) && (
          <label className="block sm:col-span-2"><Label t="Solusi akhir" wajib={f.status === 'solved'} />
            <textarea value={f.solusi} rows={2} maxLength={1500} placeholder="Penyebab & cara penyelesaian"
              onChange={e => set('solusi', e.target.value)} className={isian} style={gayaIsian} /></label>
        )}
        <label className="block sm:col-span-2"><Label t="Catatan internal (tidak tampil di link eksternal)" />
          <textarea value={f.catatan_internal} rows={2} maxLength={3000} placeholder="mis. biaya, eskalasi ke vendor, catatan tim"
            onChange={e => set('catatan_internal', e.target.value)} className={isian} style={{ ...gayaIsian, background: '#fffbeb' }} /></label>
      </div>
    </Modal>
  );
}
