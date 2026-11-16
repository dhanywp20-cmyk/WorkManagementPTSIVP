'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Pencil, Trash2 } from 'lucide-react';
import { Modal, TombolModal } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { formatWaktu } from '@/lib/checklist/inti';
import {
  PRIORITAS_ISU, STATUS_ISU, URUTAN_STATUS, hariIni, labelHari, tanggalSelesai, umurIsu,
  type HakIsu, type Isu, type RiwayatIsu, type StatusIsu,
} from '@/lib/isu/inti';
import { TEMA } from '../tampilan';
import { KepingPrioritas, KepingStatus, TimelineRiwayat } from './tampilan-isu';

const isian = 'mt-1 w-full rounded-xl px-3 py-2 text-[13px] outline-hidden focus:ring-2';
const gayaIsian = { border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta, background: NETRAL.permukaan };

function Baris({ label, isi }: { label: string; isi: React.ReactNode }) {
  if (!isi) return null;
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: TEMA.samar }}>{label}</p>
      <div className="text-[13px] mt-0.5 whitespace-pre-wrap" style={{ color: NETRAL.tinta }}>{isi}</div>
    </div>
  );
}

export interface UpdateCepat { status: StatusIsu; action?: string; solusi?: string }

export function ModalDetailIsu({ isu, hak, muatRiwayat, versi, onTutup, onUpdate, onUbah, onHapus, onFoto }: {
  isu: Isu | null;
  hak: HakIsu;
  muatRiwayat: (id: string) => Promise<RiwayatIsu[]>;
  versi?: string;
  onTutup: () => void;
  onUpdate?: (u: UpdateCepat) => Promise<void>;
  onUbah?: () => void;
  onHapus?: () => Promise<void>;
  onFoto?: (f: File) => Promise<void>;
}) {
  const [riwayat, setRiwayat] = useState<RiwayatIsu[] | null>(null);
  const [status, setStatus] = useState<StatusIsu>('open');
  const [action, setAction] = useState('');
  const [solusi, setSolusi] = useState('');
  const [sibuk, setSibuk] = useState<'' | 'update' | 'foto' | 'hapus'>('');
  const [galat, setGalat] = useState('');
  const [yakinHapus, setYakinHapus] = useState(false);
  const inputFoto = useRef<HTMLInputElement>(null);
  const id = isu?.id;

  useEffect(() => {
    if (!isu) return;
    setStatus(isu.status); setAction(''); setSolusi(isu.solusi); setGalat(''); setYakinHapus(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let hidup = true;
    setRiwayat(null);
    muatRiwayat(id).then(r => { if (hidup) setRiwayat(r); }).catch(() => { if (hidup) setRiwayat([]); });
    return () => { hidup = false; };
  }, [id, versi, muatRiwayat]);

  if (!isu) return null;
  const selesai = tanggalSelesai(isu);
  const umur = umurIsu(isu, hariIni());
  const berubah = status !== isu.status || !!action.trim() || (status === 'solved' && solusi.trim() !== isu.solusi);

  const jalankan = async (jenis: 'update' | 'foto' | 'hapus', f: () => Promise<void>) => {
    setSibuk(jenis); setGalat('');
    try { await f(); }
    catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.'); }
    finally { setSibuk(''); }
  };

  const simpanUpdate = () => {
    if (status === 'solved' && !solusi.trim()) { setGalat('Isi solusi sebelum menandai Solved.'); return; }
    void jalankan('update', async () => {
      await onUpdate?.({ status, ...(action.trim() ? { action: action.trim() } : {}), ...(status === 'solved' ? { solusi: solusi.trim() } : {}) });
      setAction('');
    });
  };

  return (
    <Modal buka onTutup={() => !sibuk && onTutup()} ukuran="lg" ikon="🛠️"
      judul={<span>#{isu.nomor} · {isu.judul}</span>}
      keterangan={`${isu.lokasi} · dilaporkan ${labelHari(isu.tanggal)}`}
      footer={<>
        {hak.admin && onHapus && (yakinHapus
          ? <TombolModal jenis="bahaya" disabled={!!sibuk} onClick={() => void jalankan('hapus', onHapus)}>{sibuk === 'hapus' ? 'Menghapus…' : 'Ya, hapus isu'}</TombolModal>
          : <button type="button" onClick={() => setYakinHapus(true)} className="mr-auto inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: TEMA.bahaya }}><Trash2 size={13} /> Hapus</button>)}
        <TombolModal onClick={onTutup} disabled={!!sibuk}>Tutup</TombolModal>
      </>}>
      <div className="space-y-4">
        {galat && <p role="alert" className="px-3 py-2 rounded-lg text-[12.5px] font-semibold" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>{galat}</p>}

        <div className="flex items-center gap-2 flex-wrap">
          <KepingStatus status={isu.status} />
          <KepingPrioritas p={isu.prioritas} />
          <span className="text-[12px] font-semibold" style={{ color: TEMA.samar }}>
            {isu.kategori} · {selesai ? `Solved ${labelHari(selesai)} (${umur} hari)` : `Terbuka ${umur} hari`} · Prioritas {PRIORITAS_ISU[isu.prioritas].label.toLowerCase()}
          </span>
          {hak.edit && onUbah && (
            <button type="button" onClick={onUbah} className="ml-auto inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: TEMA.warna }}>
              <Pencil size={13} /> Ubah data
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Baris label="Deskripsi" isi={isu.deskripsi} /></div>
          <Baris label="Pelapor" isi={isu.pelapor} />
          <Baris label="PIC" isi={isu.pic} />
          <div className="sm:col-span-2"><Baris label="Action terakhir" isi={isu.action} /></div>
          <div className="sm:col-span-2"><Baris label="Solusi" isi={isu.solusi} /></div>
          {isu.catatan_internal && (
            <div className="sm:col-span-2 rounded-lg px-3 py-2" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
              <Baris label="Catatan internal" isi={isu.catatan_internal} />
            </div>
          )}
        </div>

        {(isu.foto_url || (hak.edit && onFoto)) && (
          <div className="flex items-end gap-3 flex-wrap">
            {isu.foto_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <a href={isu.foto_url} target="_blank" rel="noopener noreferrer" className="block"><img src={isu.foto_thumb_url ?? isu.foto_url} alt={`Foto isu #${isu.nomor}`} className="h-28 w-auto rounded-lg object-cover" style={{ border: `1px solid ${NETRAL.garis}` }} /></a>
            )}
            {hak.edit && onFoto && (
              <>
                <button type="button" disabled={!!sibuk} onClick={() => inputFoto.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold disabled:opacity-60"
                  style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
                  <Camera size={14} /> {sibuk === 'foto' ? 'Mengunggah…' : isu.foto_url ? 'Ganti foto' : 'Tambah foto'}
                </button>
                <input ref={inputFoto} type="file" accept="image/*" className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void jalankan('foto', () => onFoto(f)); }} />
              </>
            )}
          </div>
        )}

        {hak.edit && onUpdate && (
          <section className="rounded-xl px-3 py-3 space-y-2" style={{ background: NETRAL.permukaanRedam, border: `1px solid ${NETRAL.garis}` }}>
            <p className="text-[13px] font-bold" style={{ color: NETRAL.tinta }}>Update penanganan</p>
            <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Status">
              {URUTAN_STATUS.map(s => {
                const x = STATUS_ISU[s];
                return (
                  <button key={s} type="button" onClick={() => setStatus(s)} aria-pressed={status === s}
                    className="px-2.5 py-1 rounded-full text-[12px] font-bold"
                    style={status === s ? { background: x.warna, color: '#fff' } : { background: x.tint, color: x.warna, border: `1px solid ${x.garis}` }}>
                    {x.label}
                  </button>
                );
              })}
            </div>
            <textarea value={action} rows={2} maxLength={1500} onChange={e => setAction(e.target.value)} aria-label="Action hari ini"
              placeholder="Action / progres hari ini, mis. sudah ganti kabel XLR, menunggu tes user" className={isian} style={gayaIsian} />
            {status === 'solved' && (
              <textarea value={solusi} rows={2} maxLength={1500} onChange={e => setSolusi(e.target.value)} aria-label="Solusi akhir"
                placeholder="Solusi akhir (wajib untuk Solved)" className={isian} style={gayaIsian} />
            )}
            <div className="flex justify-end">
              <TombolModal jenis="utama" disabled={!berubah || !!sibuk} onClick={simpanUpdate}>{sibuk === 'update' ? 'Menyimpan…' : 'Simpan update'}</TombolModal>
            </div>
          </section>
        )}

        <section>
          <p className="text-[13px] font-bold mb-2" style={{ color: NETRAL.tinta }}>Riwayat penanganan</p>
          <TimelineRiwayat riwayat={riwayat} />
          {isu.diubah_oleh_nama && (
            <p className="text-[11px] mt-3" style={{ color: TEMA.samar }}>Terakhir diubah {isu.diubah_oleh_nama} · {formatWaktu(isu.updated_at)}</p>
          )}
        </section>
      </div>
    </Modal>
  );
}
