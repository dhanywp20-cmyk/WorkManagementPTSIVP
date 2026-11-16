'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal, TombolModal } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { STATUS_PROYEK, type StatusProyek } from '@/lib/checklist/inti';
import { KATEGORI_BAWAAN, type IsuGrup } from '@/lib/isu/inti';
import { TEMA } from '../tampilan';

const isian = 'mt-1 w-full rounded-xl px-3 py-2 text-[13px] outline-hidden focus:ring-2';
const gayaIsian = { border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta, background: NETRAL.permukaan };
const Label = ({ t }: { t: string }) => <span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>{t}</span>;

export interface ProyekPilihan { id: string; nama: string; client: string | null; status: string }
export interface IsianGrup { nama: string; client: string; keterangan: string; proyek_ids: string[]; kategori: string[] }

export function ModalGrup({ buka, awal, proyek, onTutup, onSimpan }: {
  buka: boolean;
  awal: IsuGrup | null;
  proyek: ProyekPilihan[];
  onTutup: () => void;
  onSimpan: (f: IsianGrup) => Promise<void>;
}) {
  const [nama, setNama] = useState('');
  const [client, setClient] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [dipilih, setDipilih] = useState<string[]>([]);
  const [kategori, setKategori] = useState('');
  const [cari, setCari] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    if (!buka) return;
    setGalat(''); setCari('');
    setNama(awal?.nama ?? ''); setClient(awal?.client ?? ''); setKeterangan(awal?.keterangan ?? '');
    setDipilih(awal?.proyek_ids ?? []); setKategori((awal?.kategori ?? KATEGORI_BAWAAN).join(', '));
  }, [buka, awal]);

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return proyek
      .filter(p => !q || [p.nama, p.client].some(v => (v ?? '').toLowerCase().includes(q)))
      .sort((a, b) => Number(dipilih.includes(b.id)) - Number(dipilih.includes(a.id)));
  }, [proyek, cari, dipilih]);

  const siap = !!nama.trim() && dipilih.length > 0;
  const simpan = async () => {
    setSibuk(true); setGalat('');
    try {
      await onSimpan({
        nama: nama.trim(), client: client.trim(), keterangan: keterangan.trim(), proyek_ids: dipilih,
        kategori: kategori.split(/[,\n]/).map(k => k.trim()).filter(Boolean),
      });
    } catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.'); }
    finally { setSibuk(false); }
  };

  return (
    <Modal buka={buka} onTutup={() => !sibuk && onTutup()} ukuran="lg" tutupDiLuar={false} ikon="🗂️"
      judul={awal ? 'Ubah nama & proyek grup' : 'Grup Issue Log baru'}
      keterangan="Satu grup menggabungkan beberapa proyek. Semua lokasi checklist dari proyek terpilih menjadi pilihan lokasi isu."
      footer={<>
        <TombolModal onClick={onTutup} disabled={sibuk}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={simpan} disabled={sibuk || !siap}>{sibuk ? 'Menyimpan…' : 'Simpan'}</TombolModal>
      </>}>
      {galat && <p role="alert" className="mb-3 px-3 py-2 rounded-lg text-[12.5px] font-semibold" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>{galat}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><Label t="Nama grup" />
          <input value={nama} maxLength={120} autoFocus placeholder="mis. BPKP 33 Kota" onChange={e => setNama(e.target.value)} className={isian} style={gayaIsian} /></label>
        <label className="block"><Label t="Client" />
          <input value={client} maxLength={120} placeholder="mis. BPKP" onChange={e => setClient(e.target.value)} className={isian} style={gayaIsian} /></label>
        <label className="block sm:col-span-2"><Label t="Keterangan (tampil di link eksternal)" />
          <textarea value={keterangan} rows={2} maxLength={1000} onChange={e => setKeterangan(e.target.value)} className={isian} style={gayaIsian} /></label>
        <div className="sm:col-span-2">
          <Label t={`Proyek dalam grup ini · ${dipilih.length} dipilih`} />
          {dipilih.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {dipilih.map(id => (
                <span key={id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-[12px] font-semibold"
                  style={{ background: TEMA.tint, color: TEMA.warnaTua, border: `1px solid ${TEMA.garisTint}` }}>
                  {proyek.find(p => p.id === id)?.nama ?? 'Proyek'}
                  <button type="button" onClick={() => setDipilih(d => d.filter(x => x !== id))} aria-label="Keluarkan proyek dari grup"
                    className="w-5 h-5 rounded-full text-[13px] leading-none hover:bg-white">×</button>
                </span>
              ))}
            </div>
          )}
          <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari proyek…" aria-label="Cari proyek" className={isian} style={gayaIsian} />
          <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl divide-y" style={{ border: `1px solid ${NETRAL.garis}`, borderColor: NETRAL.garis }}>
            {tampil.map(p => {
              const st = STATUS_PROYEK[p.status as StatusProyek] ?? STATUS_PROYEK.in_progress;
              return (
                <li key={p.id}>
                  <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={dipilih.includes(p.id)}
                      onChange={e => setDipilih(d => (e.target.checked ? [...d, p.id] : d.filter(x => x !== p.id)))} />
                    <span className="flex-1 min-w-0 text-[13px] font-semibold truncate" style={{ color: NETRAL.tinta }}>{p.nama}</span>
                    {p.client && <span className="text-[11.5px] truncate" style={{ color: TEMA.samar }}>{p.client}</span>}
                    <span className="px-1.5 py-0.5 rounded-full text-[10.5px] font-bold" style={{ background: st.tint, color: st.warna }}>{st.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
        <label className="block sm:col-span-2"><Label t="Kategori isu (pisahkan dengan koma)" />
          <input value={kategori} onChange={e => setKategori(e.target.value)} className={isian} style={gayaIsian} /></label>
      </div>
    </Modal>
  );
}
