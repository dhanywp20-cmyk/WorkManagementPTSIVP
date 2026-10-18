'use client';

/**
 * Jadikan BOM desain sebagai checklist lokasi di proyek Project Progress: satu bagian per perangkat
 * yang dipasang tim (pasang, kabel, setting, tes) + Persiapan (material sesuai BOM) & Serah Terima
 * (inti/bom.ts checklistDariBom). Dibuat lewat POST /api/project-progress/<id>/checklist (isi impor) -
 * hanya admin Project Progress, sama seperti membuat checklist dari halaman proyek.
 */
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal, TombolModal } from '@/components/shared';
import type { DraftChecklist } from '@/lib/checklist';

interface ProyekPilihan { id: string; nama: string; client: string | null; status: string }

const isian = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const label = 'block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1';

export function ModalChecklistBom({ judulAwal, buatDraft, onTutup }: {
  judulAwal: string; buatDraft: (judul: string) => DraftChecklist; onTutup: () => void;
}) {
  const [proyek, setProyek] = useState<ProyekPilihan[] | null>(null);
  const [admin, setAdmin] = useState(false);
  const [cari, setCari] = useState('');
  const [pilih, setPilih] = useState('');
  const [judul, setJudul] = useState(judulAwal);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');
  const [selesai, setSelesai] = useState<string | null>(null);
  const draft = useMemo(() => buatDraft(judul.trim() || judulAwal), [buatDraft, judul, judulAwal]);
  const jumlahItem = draft.bagian.reduce((n, b) => n + b.items.length, 0);

  useEffect(() => {
    let batal = false;
    fetch('/api/project-progress', { cache: 'no-store' })
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (batal) return;
        if (!ok) { setGalat(j.error || 'Daftar proyek tidak terbaca.'); setProyek([]); return; }
        setAdmin(j.admin === true);
        setProyek(((j.proyek ?? []) as ProyekPilihan[]).sort((a, b) => Number(b.status === 'in_progress') - Number(a.status === 'in_progress')));
      })
      .catch(() => { if (!batal) { setGalat('Daftar proyek tidak terbaca.'); setProyek([]); } });
    return () => { batal = true; };
  }, []);

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (proyek ?? []).filter(p => !q || `${p.nama} ${p.client ?? ''}`.toLowerCase().includes(q)).slice(0, 60);
  }, [proyek, cari]);

  const buat = async () => {
    setSibuk(true); setGalat('');
    try {
      const r = await fetch(`/api/project-progress/${pilih}/checklist`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ judul: judul.trim(), isi: 'impor', sumber: 'teks', draft, anggota: [] }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setGalat(j.error || 'Gagal membuat checklist.');
      else setSelesai(proyek?.find(p => p.id === pilih)?.nama ?? 'proyek');
    } catch { setGalat('Gagal membuat checklist - periksa koneksi.'); }
    setSibuk(false);
  };

  if (selesai) {
    return (
      <Modal buka onTutup={onTutup} judul="Checklist dibuat" ukuran="sm" footer={<TombolModal jenis="utama" onClick={onTutup}>Selesai</TombolModal>}>
        <p className="text-sm text-slate-700">
          Checklist <b>{judul}</b> ({draft.bagian.length} bagian, {jumlahItem} item) dibuat di proyek <b>{selesai}</b>.
          Buka Project Progress untuk meng-assign tim dan mulai mencentang.
        </p>
      </Modal>
    );
  }

  return (
    <Modal buka onTutup={onTutup} judul="Jadikan checklist proyek" ukuran="md" tutupDiLuar={false}
      keterangan={`Dari BOM desain: ${draft.bagian.length} bagian, ${jumlahItem} item - Persiapan, satu bagian per perangkat (pasang, kabel, setting, tes), Serah Terima.`}
      footer={<>
        <TombolModal onClick={onTutup} disabled={sibuk}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={() => void buat()} disabled={sibuk || !admin || !pilih || !judul.trim()}>{sibuk ? 'Membuat…' : 'Buat checklist'}</TombolModal>
      </>}>
      <div className="space-y-3">
        {proyek && !admin && (
          <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[13px] text-amber-800">
            Hanya admin Project Progress yang bisa membuat checklist. Unduh <b>BOM Excel</b> lalu kirim ke admin, atau minta admin membuat dari sini.
          </p>
        )}
        <label className="block"><span className={label}>Nama lokasi / ruangan</span>
          <input value={judul} onChange={e => setJudul(e.target.value)} maxLength={200} className={isian} /></label>
        <div>
          <span className={label}>Proyek</span>
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama proyek / client" aria-label="Cari proyek" className={`${isian} pl-8`} />
          </div>
          <div className="rounded-xl border border-slate-200 max-h-56 overflow-y-auto divide-y divide-slate-100" role="radiogroup" aria-label="Proyek">
            {proyek === null && <p className="p-4 text-center text-sm text-slate-400">Memuat proyek…</p>}
            {proyek && tampil.length === 0 && <p className="p-4 text-center text-sm text-slate-500">{proyek.length ? 'Tidak ada yang cocok.' : 'Belum ada proyek.'}</p>}
            {tampil.map(p => (
              <button key={p.id} type="button" role="radio" aria-checked={pilih === p.id} onClick={() => setPilih(p.id)}
                className={`w-full text-left px-3 py-2 ${pilih === p.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                <span className={`block text-sm font-semibold truncate ${pilih === p.id ? 'text-blue-800' : 'text-slate-800'}`}>{p.nama}</span>
                <span className="block text-[11.5px] text-slate-500 truncate">{p.client || 'Tanpa client'}{p.status === 'done' ? ' · selesai' : ''}</span>
              </button>
            ))}
          </div>
        </div>
        <details className="rounded-xl border border-slate-200 px-3 py-2">
          <summary className="text-[12.5px] font-bold text-slate-700 cursor-pointer">Pratinjau bagian</summary>
          <ol className="mt-2 space-y-0.5 text-[12.5px] text-slate-600 max-h-40 overflow-y-auto">
            {draft.bagian.map(b => <li key={b.judul}>{b.judul} <span className="text-slate-400">· {b.items.length} item</span></li>)}
          </ol>
        </details>
        {galat && <p className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[13px] font-semibold text-rose-700">{galat}</p>}
      </div>
    </Modal>
  );
}
