'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FileText, Copy as IkonSalin, Search, Upload } from 'lucide-react';
import { Modal, SalesPicker, TombolModal, type SalesPickerUser } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { BATAS, STATUS_PROYEK, hitungItemDraft, type ChecklistProyek, type DraftChecklist, type StatusProyek } from '@/lib/checklist';
import { TEMA } from './tampilan';
import { ModalImpor } from './ModalImpor';
import { PilihAnggota, type CalonAnggota } from './PilihAnggota';
import { panggil } from './api';

const isian = 'mt-1 w-full rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2';
const gayaIsian = { border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta, background: NETRAL.permukaan };
const Label = ({ t }: { t: string }) => <span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>{t}</span>;

export interface IsianProyek {
  nama: string; client: string; sales_name: string; status: StatusProyek;
  start_date: string; target_date: string; deskripsi: string;
}

/** Form proyek (admin) - info yang sama dengan Project Progress lama. */
export function ModalProyek({ buka, awal, salesUsers, onTutup, onSimpan }: {
  buka: boolean;
  awal: ChecklistProyek | null;
  salesUsers: SalesPickerUser[];
  onTutup: () => void;
  onSimpan: (isian: IsianProyek) => Promise<void>;
}) {
  const kosong: IsianProyek = { nama: '', client: '', sales_name: '', status: 'in_progress', start_date: '', target_date: '', deskripsi: '' };
  const [f, setF] = useState<IsianProyek>(kosong);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    if (!buka) return;
    setGalat('');
    setF(awal ? {
      nama: awal.nama, client: awal.client ?? '', sales_name: awal.sales_name ?? '', status: awal.status,
      start_date: awal.start_date ?? '', target_date: awal.target_date ?? '', deskripsi: awal.deskripsi ?? '',
    } : kosong);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buka, awal]);

  const divisi = salesUsers.find(u => u.full_name === f.sales_name)?.sales_division ?? null;

  const simpan = async () => {
    if (!f.nama.trim()) { setGalat('Nama proyek wajib diisi.'); return; }
    setSibuk(true);
    setGalat('');
    try { await onSimpan(f); }
    catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.'); }
    finally { setSibuk(false); }
  };

  return (
    <Modal buka={buka} onTutup={() => !sibuk && onTutup()} ukuran="lg" tutupDiLuar={false} ikon="📊"
      judul={awal ? 'Ubah proyek' : 'Proyek baru'}
      keterangan="Divisi mengikuti Sales yang dipilih. Checklist per lokasi ditambahkan sesudah proyek dibuat."
      footer={<>
        <TombolModal onClick={onTutup} disabled={sibuk}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={simpan} disabled={sibuk || !f.nama.trim()}>{sibuk ? 'Menyimpan…' : 'Simpan'}</TombolModal>
      </>}>
      {galat && <p role="alert" className="mb-3 px-3 py-2 rounded-lg text-[12.5px] font-semibold" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>{galat}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2"><Label t="Nama proyek" />
          <input value={f.nama} maxLength={BATAS.judul} autoFocus placeholder="mis. Smart Meeting Room BPKP"
            onChange={e => setF({ ...f, nama: e.target.value })} className={isian} style={gayaIsian} /></label>
        <label className="block"><Label t="Client" />
          <input value={f.client} maxLength={BATAS.judul} placeholder="mis. BPKP"
            onChange={e => setF({ ...f, client: e.target.value })} className={isian} style={gayaIsian} /></label>
        <div><Label t={`Sales${divisi ? ` · divisi ${divisi}` : ''}`} />
          <div className="mt-1">
            <SalesPicker value={f.sales_name} users={salesUsers} onChange={nama => setF({ ...f, sales_name: nama })}
              triggerClassName="w-full rounded-xl px-3 py-2 text-[13px] text-left" triggerStyle={gayaIsian} dropdownZIndex={2100} />
          </div>
        </div>
        <label className="block"><Label t="Mulai" />
          <input type="date" value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value })} className={isian} style={gayaIsian} /></label>
        <label className="block"><Label t="Target selesai" />
          <input type="date" value={f.target_date} onChange={e => setF({ ...f, target_date: e.target.value })} className={isian} style={gayaIsian} /></label>
        {awal && (
          <div className="sm:col-span-2"><Label t="Status" />
            <div className="mt-1 flex gap-2 flex-wrap">
              {(Object.keys(STATUS_PROYEK) as StatusProyek[]).map(s => (
                <button key={s} type="button" onClick={() => setF({ ...f, status: s })}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-bold"
                  style={f.status === s
                    ? { background: STATUS_PROYEK[s].tint, color: STATUS_PROYEK[s].warna, border: `1.5px solid ${STATUS_PROYEK[s].warna}` }
                    : { background: NETRAL.permukaan, color: NETRAL.tinta2, border: `1px solid ${NETRAL.garis}` }}>
                  {STATUS_PROYEK[s].label}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="block sm:col-span-2"><Label t="Deskripsi" />
          <textarea value={f.deskripsi} rows={3} maxLength={BATAS.keterangan}
            onChange={e => setF({ ...f, deskripsi: e.target.value })} className={isian} style={gayaIsian} /></label>
      </div>
    </Modal>
  );
}

interface SumberSalin { id: string; judul: string; proyek: string; jumlah: number }
type IsiAwal = 'kosong' | 'impor' | 'salin';

/**
 * Checklist lokasi baru (admin): nama, jadwal, anggota yang di-assign, dan
 * isi awal - kosong, impor teks/Excel, atau salin dari checklist lain
 * (centang dikosongkan). Tidak ada item yang perlu diketik satu per satu.
 */
export function ModalChecklistBaru({ proyekId, buka, calonAnggota, onTutup, onDibuat }: {
  proyekId: string;
  buka: boolean;
  calonAnggota: CalonAnggota[];
  onTutup: () => void;
  onDibuat: (id: string) => void;
}) {
  const [judul, setJudul] = useState('');
  const [mulai, setMulai] = useState('');
  const [target, setTarget] = useState('');
  const [anggota, setAnggota] = useState<string[]>([]);
  const [isi, setIsi] = useState<IsiAwal>('impor');
  const [draft, setDraft] = useState<{ draft: DraftChecklist; sumber: 'teks' | 'excel' } | null>(null);
  const [imporBuka, setImporBuka] = useState(false);
  const [sumberSalin, setSumberSalin] = useState<SumberSalin[] | null>(null);
  const [salinDari, setSalinDari] = useState('');
  const [cariSalin, setCariSalin] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    if (!buka) return;
    setJudul(''); setMulai(''); setTarget(''); setAnggota([]); setIsi('impor'); setDraft(null);
    setSalinDari(''); setCariSalin(''); setGalat(''); setSibuk(false);
  }, [buka]);

  useEffect(() => {
    if (!buka || isi !== 'salin' || sumberSalin) return;
    panggil<{ checklist: SumberSalin[] }>('/api/project-progress/checklist')
      .then(r => setSumberSalin(r.checklist))
      .catch(e => setGalat(e instanceof Error ? e.message : 'Gagal memuat daftar checklist.'));
  }, [buka, isi, sumberSalin]);

  const salinTampil = useMemo(() => {
    const q = cariSalin.trim().toLowerCase();
    return (sumberSalin ?? []).filter(s => !q || s.judul.toLowerCase().includes(q) || s.proyek.toLowerCase().includes(q));
  }, [sumberSalin, cariSalin]);

  const siap = !!judul.trim() && (isi === 'kosong' || (isi === 'impor' && !!draft) || (isi === 'salin' && !!salinDari));

  const buat = async () => {
    if (!siap) return;
    setSibuk(true);
    setGalat('');
    try {
      const { id } = await panggil<{ id: string }>(`/api/project-progress/${proyekId}/checklist`, {
        method: 'POST',
        body: JSON.stringify({
          judul, start_date: mulai || null, target_date: target || null, anggota, isi,
          ...(isi === 'impor' && draft ? { draft: draft.draft, sumber: draft.sumber } : {}),
          ...(isi === 'salin' ? { salinDari } : {}),
        }),
      });
      onDibuat(id);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal membuat checklist.');
    } finally {
      setSibuk(false);
    }
  };

  const pilihan: { k: IsiAwal; ikon: ReactNode; judul: string; sub: string }[] = [
    { k: 'impor', ikon: <Upload size={17} />, judul: 'Impor', sub: 'Teks/Markdown atau Excel' },
    { k: 'salin', ikon: <IkonSalin size={17} />, judul: 'Salin dari checklist lain', sub: 'Centang dikosongkan' },
    { k: 'kosong', ikon: <FileText size={17} />, judul: 'Kosong', sub: 'Diisi menyusul' },
  ];

  return (
    <>
      <Modal buka={buka && !imporBuka} onTutup={() => !sibuk && onTutup()} ukuran="lg" tutupDiLuar={false} ikon="📋"
        judul="Checklist lokasi baru"
        keterangan="Satu checklist per lokasi/ruangan. Yang di-assign bisa mengedit dan mencentang setelah login."
        footer={<>
          <TombolModal onClick={onTutup} disabled={sibuk}>Batal</TombolModal>
          <TombolModal jenis="utama" onClick={buat} disabled={sibuk || !siap}>{sibuk ? 'Membuat…' : 'Buat checklist'}</TombolModal>
        </>}>
        {galat && <p role="alert" className="mb-3 px-3 py-2 rounded-lg text-[12.5px] font-semibold" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>{galat}</p>}
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-3"><Label t="Nama lokasi / ruangan" />
              <input value={judul} onChange={e => setJudul(e.target.value)} maxLength={BATAS.judul} autoFocus
                placeholder="mis. Ruang Rapat Lt. 3 - Palembang" className={isian} style={gayaIsian} /></label>
            <label className="block"><Label t="Mulai" />
              <input type="date" value={mulai} onChange={e => setMulai(e.target.value)} className={isian} style={gayaIsian} /></label>
            <label className="block"><Label t="Target selesai" />
              <input type="date" value={target} onChange={e => setTarget(e.target.value)} className={isian} style={gayaIsian} /></label>
          </div>

          <div>
            <Label t="Isi awal" />
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              {pilihan.map(p => (
                <button key={p.k} type="button" onClick={() => setIsi(p.k)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left"
                  style={isi === p.k
                    ? { background: TEMA.tint, color: TEMA.warnaTua, border: `1.5px solid ${TEMA.warna}` }
                    : { background: NETRAL.permukaan, color: NETRAL.tinta2, border: `1px solid ${NETRAL.garis}` }}>
                  {p.ikon}
                  <span><span className="block text-[13px] font-bold">{p.judul}</span><span className="block text-[11px] opacity-80">{p.sub}</span></span>
                </button>
              ))}
            </div>
            {isi === 'impor' && (
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <button type="button" onClick={() => setImporBuka(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold text-white" style={{ background: TEMA.warna }}>
                  <Upload size={14} /> {draft ? 'Ganti isi impor' : 'Pilih isi untuk diimpor'}
                </button>
                {draft && (
                  <span className="text-[12.5px] font-semibold" style={{ color: TEMA.selesai }}>
                    ✓ {draft.draft.bagian.length} bagian · {hitungItemDraft(draft.draft)} item siap
                  </span>
                )}
              </div>
            )}
            {isi === 'salin' && (
              <div className="mt-2 space-y-2">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: TEMA.samar }} />
                  <input value={cariSalin} onChange={e => setCariSalin(e.target.value)} placeholder="Cari proyek atau lokasi…" aria-label="Cari checklist sumber"
                    className="w-full rounded-lg pl-9 pr-3 py-2 text-[13px] outline-none focus:ring-2" style={gayaIsian} />
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg divide-y" style={{ border: `1px solid ${NETRAL.garis}`, borderColor: NETRAL.garis }}>
                  {!sumberSalin && <p className="px-3 py-3 text-[12px]" style={{ color: TEMA.samar }}>Memuat…</p>}
                  {sumberSalin && salinTampil.length === 0 && <p className="px-3 py-3 text-[12px]" style={{ color: TEMA.samar }}>Tidak ada checklist berisi yang cocok.</p>}
                  {salinTampil.map(s => (
                    <label key={s.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                      <input type="radio" name="salin-dari" checked={salinDari === s.id} onChange={() => setSalinDari(s.id)} className="w-4 h-4 accent-blue-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold truncate" style={{ color: NETRAL.tinta }}>{s.judul}</span>
                        <span className="block text-[11px] truncate" style={{ color: TEMA.samar }}>{s.proyek} · {s.jumlah} item</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <Label t="Di-assign ke (boleh lebih dari satu)" />
            <div className="mt-1"><PilihAnggota calon={calonAnggota} terpilih={anggota} onUbah={setAnggota} /></div>
          </div>
        </div>
      </Modal>

      <ModalImpor buka={buka && imporBuka} onTutup={() => setImporBuka(false)} labelSimpan={n => `Pakai ${n} item`}
        onSimpan={async (d, sumber) => {
          setDraft({ draft: d, sumber });
          if (!judul.trim() && d.judul) setJudul(d.judul.slice(0, BATAS.judul));
          setImporBuka(false);
        }} />
    </>
  );
}
