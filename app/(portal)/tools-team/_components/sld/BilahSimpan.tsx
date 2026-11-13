'use client';
import { useEffect, useRef, useState } from 'react';
import { FilePlus2, FolderOpen, History, Link2, Save, SaveAll, Search, Sparkles, Trash2 } from 'lucide-react';
import { ConfirmDialog, type ConfirmState } from '@/components/shared/ConfirmDialog';
import { Modal } from '@/components/shared/Modal';
import { Centang, kelasKecil, kelasTombol } from './isian';
import { GarisMenu, ItemMenu, kelasIkon, Menu } from './MenuBilah';
import type { KeadaanSimpanSLD, SldTim } from './useSimpanSLD';
import type { KeadaanSLD } from './useKeadaanSLD';

interface RequestPilihan { id: string; nama: string; dibuat: string; ruang: { idx: number; nama: string; boleh: boolean; alasan: string }[] }
type Dialog = null | 'sebagai' | 'tautkan' | 'buka' | 'riwayat';

const tgl = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const jam = (s: string) => new Date(s).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

function PilihRequest({ nilai, onUbah }: { nilai: { req: RequestPilihan; ruang: number } | null; onUbah: (v: { req: RequestPilihan; ruang: number } | null) => void }) {
  const [cari, setCari] = useState('');
  const [daftar, setDaftar] = useState<RequestPilihan[] | null>(null);
  const [galat, setGalat] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/tools-team/sld/request${cari.trim() ? `?q=${encodeURIComponent(cari.trim())}` : ''}`, { credentials: 'include', cache: 'no-store' })
        .then(r => r.json().then(j => ({ r, j }))).then(({ r, j }) => {
          if (!r.ok || !j?.ok) { setGalat(j?.alasan ?? 'Daftar request tidak bisa dimuat.'); setDaftar([]); return; }
          setGalat(''); setDaftar(j.daftar as RequestPilihan[]);
        }).catch(() => { setGalat('Tidak terhubung ke server.'); setDaftar([]); });
    }, 300);
    return () => clearTimeout(t);
  }, [cari]);
  return (
    <div className="space-y-2">
      <label className="relative block">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama proyek di Request Design..." aria-label="Cari Request Design" className={`${kelasKecil} pl-8`} />
      </label>
      {galat && <p className="text-[12px] text-rose-700">{galat}</p>}
      <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
        {daftar === null && <p className="p-3 text-[12.5px] text-slate-500">Memuat...</p>}
        {daftar?.length === 0 && !galat && <p className="p-3 text-[12.5px] text-slate-500">Tidak ada Request Design yang cocok.</p>}
        {daftar?.map(r => (
          <div key={r.id} className="p-2.5">
            <p className="text-[13px] font-semibold text-slate-800">{r.nama} <span className="text-[11px] font-normal text-slate-500">· {tgl(r.dibuat)}</span></p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {r.ruang.map(x => {
                const dipilih = nilai?.req.id === r.id && nilai.ruang === x.idx;
                return (
                  <button key={x.idx} type="button" disabled={!x.boleh} title={x.boleh ? '' : x.alasan} onClick={() => onUbah(dipilih ? null : { req: r, ruang: x.idx })}
                    className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold disabled:opacity-40 ${dipilih ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    {x.nama}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BilahSimpan({ a, s, onBaru, onContoh }: { a: KeadaanSLD; s: KeadaanSimpanSLD; onBaru: () => void; onContoh: () => void }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [nama, setNama] = useState('');
  const [pakaiTautan, setPakaiTautan] = useState(false);
  const [tautan, setTautan] = useState<{ req: RequestPilihan; ruang: number } | null>(null);
  const [cari, setCari] = useState('');
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const sRef = useRef(s); sRef.current = s;

  const bukaSebagai = () => {
    setNama(s.aktif ? `${s.aktif.nama} (salinan)` : [a.proyek.blok.proyek, a.proyek.blok.lokasi].filter(Boolean).join(' - ') || 'SLD baru');
    setPakaiTautan(false); setTautan(null); setDialog('sebagai');
  };
  const simpan = async () => { if (s.aktif?.bolehUbah) await s.simpan(); else bukaSebagai(); };
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return;
      e.preventDefault();
      if (e.shiftKey || !sRef.current.aktif?.bolehUbah) bukaSebagai(); else void sRef.current.simpan();
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  });

  const kirimSebagai = async () => {
    const id = await s.simpanSebagai(nama);
    if (!id) return;
    if (pakaiTautan && tautan) await s.tautkan(id, tautan.req.id, tautan.ruang, `${tautan.req.nama} · ${tautan.req.ruang[tautan.ruang]?.nama ?? ''}`);
    setDialog(null);
  };
  const kirimTautan = async () => {
    if (!s.aktif || !tautan) return;
    if (s.berubah && s.aktif.bolehUbah) await s.simpan();
    if (await s.tautkan(s.aktif.id, tautan.req.id, tautan.ruang, `${tautan.req.nama} · ${tautan.req.ruang[tautan.ruang]?.nama ?? ''}`)) setDialog(null);
  };
  const bukaDaftar = () => { setCari(''); setDialog('buka'); void s.muatDaftar(); };
  const status = s.aktif ? `${s.aktif.nama} · v${s.aktif.versi}${s.berubah ? ' · belum disimpan' : ' · tersimpan'}` : 'Draf (belum disimpan ke server)';
  const titik = s.aktif ? (s.berubah ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-400';

  return (
    <>
      <div className="flex items-center gap-0.5 min-w-0">
        <Menu label="Menu file" teks="File" lebar="w-64">
          <ItemMenu ikon={FilePlus2} label="SLD baru" onClick={onBaru} />
          <ItemMenu ikon={FolderOpen} label="Buka SLD tim..." onClick={bukaDaftar} />
          <GarisMenu />
          <ItemMenu ikon={Save} label="Simpan" pintas="Ctrl+S" onClick={() => void simpan()} disabled={s.sibuk === 'simpan'} />
          <ItemMenu ikon={SaveAll} label="Simpan sebagai..." pintas="Ctrl+Shift+S" onClick={bukaSebagai} />
          {s.aktif && <ItemMenu ikon={History} label="Riwayat versi" onClick={() => { setDialog('riwayat'); void s.muatRiwayat(s.aktif!.id); }} />}
          {s.aktif && <ItemMenu ikon={Link2} label="Tautkan ke Request Design" onClick={() => { setTautan(null); setDialog('tautkan'); }} />}
          <GarisMenu />
          <ItemMenu ikon={Sparkles} label="Buka contoh SLD" onClick={onContoh} />
        </Menu>
        <button type="button" className={`${kelasIkon} relative ${s.berubah ? '!bg-amber-50 !text-amber-900' : ''}`} onClick={() => void simpan()} disabled={s.sibuk === 'simpan'}
          title={`Simpan ke server tim (Ctrl+S) · ${status}`}>
          <Save size={16} /> {s.sibuk === 'simpan' ? 'Menyimpan...' : 'Simpan'}
          <span aria-hidden="true" className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${titik}`} />
        </button>
        <span className="hidden 2xl:inline max-w-[200px] truncate text-[11.5px] text-slate-500" title={status}>{status}</span>
        {s.versiServer && s.aktif && (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
            Ada v{s.versiServer.versi} dari {s.versiServer.oleh || 'tim'}
            <button type="button" className="underline font-bold" onClick={() => { const id = s.aktif!.id; s.tutupVersiServer(); void s.buka(id); }}>Muat terbaru</button>
          </span>
        )}
      </div>

      <Modal buka={dialog === 'sebagai'} onTutup={() => setDialog(null)} judul="Simpan sebagai SLD baru" ikon={<SaveAll size={18} />}
        keterangan="Disimpan di server tim (teks, posisi, kabel). Foto unggahan Anda tetap hanya di browser ini; foto produk bawaan ikut."
        footer={(
          <div className="flex justify-end gap-2 w-full">
            <button type="button" className={kelasTombol} onClick={() => setDialog(null)}>Batal</button>
            <button type="button" className={`${kelasTombol} !bg-blue-700 !text-white !border-blue-700`} disabled={!nama.trim() || s.sibuk === 'simpan' || (pakaiTautan && !tautan)}
              onClick={() => void kirimSebagai()}>{s.sibuk === 'simpan' ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        )}>
        <div className="space-y-3">
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Nama SLD</span>
            <input value={nama} onChange={e => setNama(e.target.value.slice(0, 120))} className={kelasKecil} autoFocus />
          </label>
          <Centang label="Tautkan juga ke Request Design (opsional)" nilai={pakaiTautan} onUbah={setPakaiTautan} />
          {pakaiTautan && <PilihRequest nilai={tautan} onUbah={setTautan} />}
        </div>
      </Modal>

      <Modal buka={dialog === 'tautkan'} onTutup={() => setDialog(null)} judul="Tautkan SLD ke Request Design" ikon={<Link2 size={18} />}
        keterangan={s.aktif ? `${s.aktif.nama} · v${s.aktif.versi}. Tautan memakai versi yang tersimpan; perubahan yang belum disimpan akan disimpan dulu.` : ''}
        footer={(
          <div className="flex justify-end gap-2 w-full">
            <button type="button" className={kelasTombol} onClick={() => setDialog(null)}>Batal</button>
            <button type="button" className={`${kelasTombol} !bg-blue-700 !text-white !border-blue-700`} disabled={!tautan || !!s.sibuk} onClick={() => void kirimTautan()}>Tautkan</button>
          </div>
        )}>
        <PilihRequest nilai={tautan} onUbah={setTautan} />
      </Modal>

      <Modal buka={dialog === 'buka'} onTutup={() => setDialog(null)} judul="Buka SLD tim" ikon={<FolderOpen size={18} />} ukuran="penuh"
        keterangan={s.halDaftar.total ? `${s.halDaftar.total} SLD tersimpan · terbaru di atas` : undefined}>
        <div className="space-y-2">
          <label className="relative block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input value={cari} onChange={e => setCari(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void s.muatDaftar(cari); }}
              placeholder="Cari nama SLD / pembuat, lalu Enter" aria-label="Cari SLD" className={`${kelasKecil} pl-8`} />
          </label>
          {s.sibuk === 'daftar' && <p className="p-3 text-[12.5px] text-slate-500">Memuat...</p>}
          {s.daftar?.length === 0 && s.sibuk !== 'daftar' && <p className="p-3 text-[12.5px] text-slate-500">{s.halDaftar.q ? 'Tidak ada SLD yang cocok.' : 'Belum ada SLD tersimpan di server tim.'}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {s.daftar?.map((x: SldTim) => (
              <div key={x.id} className={`flex items-start gap-1 rounded-xl border p-2.5 ${s.aktif?.id === x.id ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}>
                <button type="button" className="flex-1 min-w-0 text-left" onClick={() => void s.buka(x.id).then(ok => { if (ok) setDialog(null); })}>
                  <p className="text-[13px] font-semibold text-slate-800 line-clamp-2">{x.nama} <span className="text-[11px] font-bold text-blue-700">v{x.versi}</span></p>
                  <p className="mt-1 text-[11.5px] text-slate-600">{tgl(x.updated_at)} · <b>{jam(x.updated_at)}</b></p>
                  <p className="text-[11.5px] text-slate-500 truncate">{x.diubah_oleh_nama || x.dibuat_oleh_nama || '-'} · {x.jumlah_perangkat} perangkat</p>
                </button>
                {x.bolehUbah && (
                  <button type="button" aria-label={`Hapus ${x.nama}`} onClick={() => setKonfirmasi({ message: `Hapus SLD "${x.nama}"?`, confirmLabel: 'Hapus', danger: true,
                    description: 'Tidak bisa dibatalkan. Bila masih ditautkan ke Request Design, SLD hanya diarsipkan dan versinya tetap tersimpan.', onConfirm: () => s.hapus(x) })} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 size={15} /></button>
                )}
              </div>
            ))}
          </div>
          {s.halDaftar.total > s.halDaftar.perHalaman && (
            <nav className="flex items-center justify-center gap-2 pt-1" aria-label="Halaman daftar SLD">
              <button type="button" className={kelasTombol} disabled={s.halDaftar.hal === 0 || s.sibuk === 'daftar'} onClick={() => void s.muatDaftar(s.halDaftar.q, s.halDaftar.hal - 1)}>‹ Sebelumnya</button>
              <span className="text-[12.5px] text-slate-600">Halaman <b>{s.halDaftar.hal + 1}</b> dari {Math.ceil(s.halDaftar.total / s.halDaftar.perHalaman)}</span>
              <button type="button" className={kelasTombol} disabled={(s.halDaftar.hal + 1) * s.halDaftar.perHalaman >= s.halDaftar.total || s.sibuk === 'daftar'}
                onClick={() => void s.muatDaftar(s.halDaftar.q, s.halDaftar.hal + 1)}>Berikutnya ›</button>
            </nav>
          )}
        </div>
      </Modal>
      <Modal buka={dialog === 'riwayat'} onTutup={() => setDialog(null)} judul={`Riwayat versi${s.aktif ? `: ${s.aktif.nama}` : ''}`} ikon={<History size={18} />} ukuran="md"
        keterangan="Buka untuk melihat saja, atau Pulihkan untuk menjadikan isinya versi terbaru saat disimpan. Versi lama tidak pernah dihapus.">
        <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
          {s.riwayatVersi === null && <p className="p-3 text-[12.5px] text-slate-500">Memuat...</p>}
          {s.riwayatVersi?.length === 0 && <p className="p-3 text-[12.5px] text-slate-500">Riwayat tidak tersedia.</p>}
          {s.riwayatVersi?.map(v => (
            <div key={v.versi} className="flex items-center gap-2 px-3 py-2">
              <span className="text-[13px] font-bold text-blue-700 w-10">v{v.versi}</span>
              <span className="flex-1 min-w-0 text-[12.5px] text-slate-700">{tgl(v.created_at)} · <b>{jam(v.created_at)}</b> · {v.dibuat_oleh_nama || '-'}</span>
              {v.versi === s.aktif?.versi ? <span className="text-[11.5px] font-semibold text-emerald-700">dibuka</span> : (<>
                <button type="button" className={`${kelasTombol} !py-1 !text-[12px]`} onClick={() => void s.buka(s.aktif!.id, v.versi).then(ok => { if (ok) setDialog(null); })}>Lihat</button>
                {s.aktif?.bolehUbah && <button type="button" className={`${kelasTombol} !py-1 !text-[12px]`} onClick={() => void s.pulihkan(s.aktif!.id, v.versi).then(ok => { if (ok) setDialog(null); })}>Pulihkan</button>}
              </>)}
            </div>
          ))}
        </div>
      </Modal>
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </>
  );
}
