'use client';
/**
 * Checklist Barang - impor daftar barang dari Excel / PDF, cek satu per satu (✓ sesuai / ✗ tidak),
 * lalu unduh PDF hasil lengkap dengan kolom tanda tangan. Semua di peramban; isian tersimpan otomatis
 * di perangkat ini (localStorage) sampai "Mulai baru". Logika murni: lib/checklist-barang.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCheck, FileDown, FileSpreadsheet, Pencil, Plus, RotateCcw, Search, Trash2, Upload } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { ConfirmDialog, type ConfirmState } from '@/components/shared/ConfirmDialog';
import {
  bacaDraf, dokBaru, type DokChecklist, type ItemBarang, itemBaru, MAKS_ITEM, MAKS_PENANDA, type Penanda, ringkas,
} from '@/lib/checklist-barang';
import { Catatan, Kartu, kelasInput, Nilai, Segmen } from './bersama/ui';
import { BarisBarang, GRID_CEK } from './cekbarang/BarisBarang';
import { PadTtd } from './cekbarang/PadTtd';
import { FormTambah } from './cekbarang/FormTambah';
import { imporBerkas, unduhPdfChecklist, unduhTemplate } from './cekbarang/berkas';

const KUNCI = 'tools-team-checklist-barang-v1';
const TERIMA = '.xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv';

const hariIni = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
function muatDraf(): DokChecklist | null {
  try { return bacaDraf(JSON.parse(localStorage.getItem(KUNCI) ?? 'null')); } catch { return null; }
}

type Saring = 'semua' | 'belum' | 'ok' | 'tidak';
interface Impor { nama: string; items: ItemBarang[]; buang: Set<string> }

const kelasTombol = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60';

function Isian({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

export function ChecklistBarang() {
  const [d, setD] = useState<DokChecklist>(() => muatDraf() ?? dokBaru(hariIni()));
  //  Draf disimpan (tertunda) setiap ada perubahan - per perangkat, bukan data bersama.
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(KUNCI, JSON.stringify(d)); } catch { /* penuh / diblokir: abaikan */ } }, 400);
    return () => clearTimeout(t);
  }, [d]);

  const [ubah, setUbah] = useState(false);
  const [cari, setCari] = useState('');
  const [saring, setSaring] = useState<Saring>('semua');
  const [impor, setImpor] = useState<Impor | null>(null);
  const [sibuk, setSibuk] = useState<'' | 'baca' | 'pdf' | 'template'>('');
  const [pesan, setPesan] = useState<{ t: string; galat?: boolean } | null>(null);
  const [seret, setSeret] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const inputBerkas = useRef<HTMLInputElement>(null);

  const r = useMemo(() => ringkas(d.items), [d.items]);
  const nomor = useMemo(() => {
    const m = new Map<string, number>();
    let n = 0;
    for (const it of d.items) if (!it.grup) m.set(it.id, ++n);
    return m;
  }, [d.items]);
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q && saring === 'semua') return d.items;
    return d.items.filter(it => !it.grup
      && (saring === 'semua' || (saring === 'belum' ? !it.status : it.status === saring))
      && (!q || `${it.nama} ${it.spek} ${it.ket}`.toLowerCase().includes(q)));
  }, [d.items, cari, saring]);

  const ubahDok = (p: Partial<DokChecklist>) => setD(x => ({ ...x, ...p }));
  const ubahItem = useCallback((id: string, p: Partial<ItemBarang>) =>
    setD(x => ({ ...x, items: x.items.map(it => (it.id === id ? { ...it, ...p } : it)) })), [setD]);
  const hapusItem = useCallback((id: string) => setD(x => ({ ...x, items: x.items.filter(it => it.id !== id) })), [setD]);
  const ubahPenanda = (i: number, p: Partial<Penanda>) => setD(x => ({ ...x, penanda: x.penanda.map((v, j) => (j === i ? { ...v, ...p } : v)) }));

  //  Barang baru selalu terlihat: saringan & pencarian dilepas.
  const tambahItem = (isi: Pick<ItemBarang, 'nama' | 'spek' | 'qty' | 'satuan'>) => {
    setD(x => (x.items.length >= MAKS_ITEM ? x : { ...x, items: [...x.items, itemBaru(isi)] }));
    setCari(''); setSaring('semua'); setPesan(null);
  };

  const bacaBerkas = async (f?: File | null) => {
    if (!f || sibuk) return;
    setSibuk('baca'); setPesan(null);
    try { setImpor({ nama: f.name, items: await imporBerkas(f), buang: new Set() }); } catch (e) {
      setPesan({ t: e instanceof Error ? e.message : 'Berkas gagal dibaca.', galat: true });
    } finally {
      setSibuk('');
      if (inputBerkas.current) inputBerkas.current.value = '';
    }
  };
  const pakaiImpor = (cara: 'ganti' | 'tambah') => {
    if (!impor) return;
    const baru = impor.items.filter(it => !impor.buang.has(it.id));
    setD(x => ({ ...x, items: (cara === 'ganti' ? baru : [...x.items, ...baru]).slice(0, MAKS_ITEM) }));
    setPesan({ t: `${baru.filter(it => !it.grup).length} barang dari ${impor.nama} ${cara === 'ganti' ? 'dipakai' : 'ditambahkan'}.` });
    setImpor(null); setUbah(false); setCari(''); setSaring('semua');
  };

  const unduhPdf = async () => {
    setSibuk('pdf'); setPesan(null);
    try {
      const u = getSession<{ full_name?: string; username?: string }>();
      const oleh = u?.full_name || u?.username;
      const waktu = new Date().toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      await unduhPdfChecklist(d, `Dicetak ${waktu}${oleh ? ` oleh ${oleh}` : ''}`);
    } catch (e) {
      setPesan({ t: e instanceof Error ? e.message : 'PDF gagal dibuat.', galat: true });
    } finally { setSibuk(''); }
  };

  const sisaKeSesuai = () => {
    if (!r.belum) return;
    setKonfirmasi({
      message: `Tandai ${r.belum} barang yang belum dicek sebagai sesuai / ada?`, confirmLabel: 'Tandai sesuai',
      onConfirm: () => setD(x => ({ ...x, items: x.items.map(it => (it.grup || it.status ? it : { ...it, status: 'ok' })) })),
    });
  };
  const kosongkanCek = () => setKonfirmasi({
    message: 'Kosongkan semua hasil cek & keterangan?', description: 'Daftar barang tetap.', danger: true, confirmLabel: 'Kosongkan',
    onConfirm: () => setD(x => ({ ...x, items: x.items.map(it => ({ ...it, status: '', ket: '' })), penanda: x.penanda.map(p => ({ ...p, ttd: '' })) })),
  });
  const mulaiBaru = () => setKonfirmasi({
    message: 'Mulai checklist baru?', description: 'Daftar, hasil cek & tanda tangan saat ini dihapus dari perangkat ini.', danger: true, confirmLabel: 'Mulai baru',
    onConfirm: () => {
      setD(x => ({ ...dokBaru(hariIni()), penanda: x.penanda.map(p => ({ ...p, ttd: '' })) }));
      setImpor(null); setUbah(false); setCari(''); setSaring('semua'); setPesan(null);
    },
  });

  const dicek = r.ok + r.tidak;
  const persen = r.total ? Math.round((dicek / r.total) * 100) : 0;

  return (
    <div className="space-y-4 pb-24">
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
      <Kartu judul="Dokumen">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <Isian label="Judul" className="lg:col-span-2"><input value={d.judul} onChange={e => ubahDok({ judul: e.target.value })} placeholder="Checklist Barang" className={kelasInput} /></Isian>
          <Isian label="No. dokumen / PO"><input value={d.nomor} onChange={e => ubahDok({ nomor: e.target.value })} placeholder="Opsional" className={kelasInput} /></Isian>
          <Isian label="Tanggal"><input type="date" value={d.tanggal} onChange={e => ubahDok({ tanggal: e.target.value })} className={kelasInput} /></Isian>
          <Isian label="Project / Customer"><input value={d.project} onChange={e => ubahDok({ project: e.target.value })} placeholder="Opsional" className={kelasInput} /></Isian>
          <Isian label="Lokasi"><input value={d.lokasi} onChange={e => ubahDok({ lokasi: e.target.value })} placeholder="Opsional" className={kelasInput} /></Isian>
        </div>
      </Kartu>

      <Kartu judul={`Daftar Barang${r.total ? ` (${r.total})` : ''}`} aksi={
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => inputBerkas.current?.click()} disabled={!!sibuk} className={kelasTombol}>
            <Upload size={15} /> {sibuk === 'baca' ? 'Membaca…' : 'Impor Excel / PDF'}
          </button>
          <button type="button" disabled={!!sibuk} className={kelasTombol} title="Unduh contoh format Excel"
            onClick={async () => { setSibuk('template'); try { await unduhTemplate(); } catch { setPesan({ t: 'Template gagal dibuat - periksa koneksi.', galat: true }); } finally { setSibuk(''); } }}>
            <FileSpreadsheet size={15} /> Template Excel
          </button>
        </div>
      }>
        <input ref={inputBerkas} type="file" accept={TERIMA} className="hidden" onChange={e => void bacaBerkas(e.target.files?.[0])} />

        {pesan && (
          <p role={pesan.galat ? 'alert' : 'status'} className={`mb-3 rounded-xl px-3 py-2 text-[13px] ${pesan.galat ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
            {pesan.t}
          </p>
        )}

        {impor ? (
          <PratinjauImpor impor={impor} adaDaftar={d.items.length > 0} onUbah={setImpor} onPakai={pakaiImpor} onBatal={() => setImpor(null)} />
        ) : !d.items.length ? (
          <div onDragOver={e => { e.preventDefault(); setSeret(true); }} onDragLeave={() => setSeret(false)}
            onDrop={e => { e.preventDefault(); setSeret(false); void bacaBerkas(e.dataTransfer.files?.[0]); }}
            className={`rounded-2xl border-2 border-dashed px-4 py-10 text-center ${seret ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50/60'}`}>
            <Upload size={28} className="mx-auto text-slate-400" />
            <p className="mt-2 text-[14px] font-semibold text-slate-800">Impor daftar barang dari Excel atau PDF</p>
            <p className="mt-1 text-[12.5px] text-slate-500">Seret berkas ke sini, atau ketik barang satu per satu di bawah.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => inputBerkas.current?.click()} disabled={!!sibuk}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60">
                <Upload size={15} /> {sibuk === 'baca' ? 'Membaca…' : 'Pilih berkas'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <Nilai label="Total barang" nilai={r.total} />
              <Nilai label="Sesuai / ada" nilai={r.ok} nada={r.ok ? 'baik' : undefined} />
              <Nilai label="Tidak sesuai" nilai={r.tidak} nada={r.tidak ? 'buruk' : undefined} />
              <Nilai label="Belum dicek" nilai={r.belum} nada={r.belum ? 'awas' : 'baik'} />
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={persen} aria-valuemin={0} aria-valuemax={100} aria-label="Progres cek">
              <div className="h-full flex">
                <div className="bg-emerald-500" style={{ width: `${r.total ? (r.ok / r.total) * 100 : 0}%` }} />
                <div className="bg-rose-500" style={{ width: `${r.total ? (r.tidak / r.total) * 100 : 0}%` }} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="relative flex-1 min-w-[12rem]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari barang…" aria-label="Cari barang" className={`${kelasInput} pl-9`} />
              </label>
              {!ubah && (
                <div className="w-full sm:w-auto sm:min-w-[22rem]">
                  <Segmen<Saring> nilai={saring} onUbah={setSaring} opsi={[
                    { v: 'semua', l: 'Semua' }, { v: 'belum', l: `Belum ${r.belum}` }, { v: 'ok', l: `✓ ${r.ok}` }, { v: 'tidak', l: `✗ ${r.tidak}` },
                  ]} />
                </div>
              )}
              <button type="button" onClick={() => setUbah(v => !v)} aria-pressed={ubah}
                className={ubah ? 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold bg-blue-700 text-white hover:bg-blue-800' : kelasTombol}>
                <Pencil size={15} /> {ubah ? 'Selesai ubah' : 'Ubah daftar'}
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              {!ubah && (
                <div className={`hidden sm:grid ${GRID_CEK} px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600`}>
                  <span className="text-center">No</span><span>Nama barang</span><span>Qty</span><span className="text-center">Cek</span><span>Keterangan</span>
                </div>
              )}
              {tampil.length ? (
                <ul className="divide-y divide-slate-100">
                  {tampil.map(it => (
                    <BarisBarang key={it.id} it={it} no={nomor.get(it.id) ?? 0} ubah={ubah} onUbah={ubahItem} onHapus={hapusItem} />
                  ))}
                </ul>
              ) : <p className="px-3 py-6 text-center text-[13px] text-slate-500">Tidak ada barang yang cocok.</p>}
            </div>

          </div>
        )}

        {/* Satu posisi tetap untuk layar kosong & daftar: form tidak dipasang ulang, fokus & satuan terakhir tetap. */}
        {!impor && (
          <div className="mt-3 space-y-3">
            <FormTambah onTambah={tambahItem} penuh={d.items.length >= MAKS_ITEM} />
            {!ubah && r.belum > 0 && (
              <button type="button" onClick={sisaKeSesuai} className={kelasTombol} title="Tandai semua barang yang belum dicek sebagai sesuai">
                <CheckCheck size={15} /> Sisa {r.belum} → sesuai
              </button>
            )}
          </div>
        )}
      </Kartu>

      <Kartu judul="Catatan & tanda tangan">
        <Isian label="Catatan (opsional)">
          <textarea value={d.catatan} onChange={e => ubahDok({ catatan: e.target.value })} rows={2} className={`${kelasInput} resize-y`}
            placeholder="Mis. barang diterima dalam kondisi baik, kekurangan menyusul…" />
        </Isian>
        <div className="mt-4 flex items-center gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Penanda tangan</span>
          <Catatan>Tanda tangan bisa langsung digores di kotak (mouse / jari). Biarkan kosong bila ditandatangani basah setelah PDF dicetak - garis tanda tangan tetap ada di PDF.</Catatan>
        </div>
        <div className={`mt-2 grid grid-cols-1 sm:grid-cols-2 ${d.penanda.length >= 3 ? 'lg:grid-cols-3' : ''} ${d.penanda.length === 4 ? 'xl:grid-cols-4' : ''} gap-3`}>
          {d.penanda.map((p, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input value={p.label} onChange={e => ubahPenanda(i, { label: e.target.value })} aria-label="Peran penanda tangan"
                  className="flex-1 min-w-0 bg-transparent text-[13px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 rounded px-1" />
                {d.penanda.length > 1 && (
                  <button type="button" onClick={() => setD(x => ({ ...x, penanda: x.penanda.filter((_, j) => j !== i) }))}
                    aria-label={`Hapus kolom ${p.label}`} title="Hapus kolom tanda tangan" className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <PadTtd nilai={p.ttd} label={p.label} onUbah={v => ubahPenanda(i, { ttd: v })} />
              <input value={p.nama} onChange={e => ubahPenanda(i, { nama: e.target.value })} placeholder="Nama jelas" aria-label={`Nama ${p.label}`} className={kelasInput} />
            </div>
          ))}
        </div>
        {d.penanda.length < MAKS_PENANDA && (
          <button type="button" onClick={() => setD(x => ({ ...x, penanda: [...x.penanda, { label: 'Mengetahui', nama: '', ttd: '' }] }))} className={`${kelasTombol} mt-3`}>
            <Plus size={15} /> Tambah kolom tanda tangan
          </button>
        )}
      </Kartu>

      <div className="sticky bottom-3 z-10">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur px-3 py-2.5 shadow-lg">
          <p className="text-[13px] text-slate-700 tabular-nums mr-auto">
            <b>{dicek}</b> / {r.total} dicek{r.tidak ? <span className="text-rose-700"> · {r.tidak} tidak sesuai</span> : null}
          </p>
          {d.items.length > 0 && (
            <button type="button" onClick={kosongkanCek} className={kelasTombol} title="Kosongkan hasil cek, daftar tetap"><RotateCcw size={15} /> <span className="hidden sm:inline">Ulang cek</span></button>
          )}
          <button type="button" onClick={mulaiBaru} className={kelasTombol}><Trash2 size={15} /> <span className="hidden sm:inline">Mulai baru</span></button>
          <button type="button" onClick={() => void unduhPdf()} disabled={!!sibuk || !d.items.length}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, var(--merek-utama, #1d4ed8), var(--merek-utama-2, #1e40af))' }}>
            <FileDown size={15} /> {sibuk === 'pdf' ? 'Membuat PDF…' : 'Unduh PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PratinjauImpor({ impor, adaDaftar, onUbah, onPakai, onBatal }: {
  impor: Impor; adaDaftar: boolean; onUbah: (x: Impor) => void; onPakai: (cara: 'ganti' | 'tambah') => void; onBatal: () => void;
}) {
  const dipakai = impor.items.filter(it => !impor.buang.has(it.id) && !it.grup).length;
  const alih = (id: string) => {
    const buang = new Set(impor.buang);
    if (buang.has(id)) buang.delete(id); else buang.add(id);
    onUbah({ ...impor, buang });
  };
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-slate-700">
        Terbaca <b>{impor.items.filter(it => !it.grup).length} barang</b> dari <b className="break-all">{impor.nama}</b>. Hilangkan centang baris yang bukan barang.
      </p>
      <ul className="max-h-[22rem] overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
        {impor.items.map(it => (
          <li key={it.id}>
            <label className={`flex items-start gap-3 px-3 py-2 cursor-pointer ${it.grup ? 'bg-slate-100' : ''} ${impor.buang.has(it.id) ? 'opacity-45' : ''}`}>
              <input type="checkbox" checked={!impor.buang.has(it.id)} onChange={() => alih(it.id)} className="mt-0.5 w-4 h-4 accent-blue-700 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className={`block text-[13px] break-words ${it.grup ? 'font-bold uppercase tracking-wide text-slate-700 text-[12px]' : 'font-semibold text-slate-900'}`}>{it.nama}</span>
                {it.spek && <span className="block text-[11.5px] text-slate-500 break-words">{it.spek}</span>}
              </span>
              {!it.grup && <span className="shrink-0 text-[12.5px] tabular-nums text-slate-600">{[it.qty, it.satuan].filter(Boolean).join(' ') || '-'}</span>}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onPakai('ganti')} disabled={!dipakai}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60">
          {adaDaftar ? `Ganti daftar dengan ${dipakai} barang` : `Pakai ${dipakai} barang`}
        </button>
        {adaDaftar && <button type="button" onClick={() => onPakai('tambah')} disabled={!dipakai} className={kelasTombol}>Tambahkan ke daftar</button>}
        <button type="button" onClick={onBatal} className={kelasTombol}>Batal</button>
      </div>
    </div>
  );
}
