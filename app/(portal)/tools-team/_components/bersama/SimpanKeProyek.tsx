'use client';

/**
 * Simpan hasil Kalkulator AV ke satu proyek Project Progress (POST /api/tools-team/hasil-av).
 * Yang disimpan potret hasilnya: ringkasan teks + lembar A4 - tampil di detail proyek dan bisa
 * dicetak ulang di sana. Proyek yang bisa dipilih = proyek yang boleh dilihat akun ini.
 */
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal, TombolModal } from '@/components/shared';
import type { Lembar } from '@/lib/lembar-cetak';

interface ProyekPilihan { id: string; nama: string; client: string | null; status: string }

const isian = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const label = 'block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1';

export function SimpanKeProyek({ judulAwal, ringkasan, lembar, onTutup }: {
  judulAwal: string; ringkasan: () => string; lembar: () => Lembar; onTutup: () => void;
}) {
  const [proyek, setProyek] = useState<ProyekPilihan[] | null>(null);
  const [cari, setCari] = useState('');
  const [pilih, setPilih] = useState('');
  const [judul, setJudul] = useState(judulAwal);
  const [catatan, setCatatan] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState('');
  const [tersimpan, setTersimpan] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    fetch('/api/project-progress', { cache: 'no-store' })
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (batal) return;
        if (!ok) { setGalat(j.error || 'Daftar proyek tidak terbaca.'); setProyek([]); return; }
        //  Proyek berjalan di atas - yang paling mungkin dipilih.
        const daftar = ((j.proyek ?? []) as ProyekPilihan[]).sort((a, b) => Number(b.status === 'in_progress') - Number(a.status === 'in_progress'));
        setProyek(daftar);
      })
      .catch(() => { if (!batal) { setGalat('Daftar proyek tidak terbaca.'); setProyek([]); } });
    return () => { batal = true; };
  }, []);

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (proyek ?? []).filter(p => !q || `${p.nama} ${p.client ?? ''}`.toLowerCase().includes(q)).slice(0, 60);
  }, [proyek, cari]);

  const simpan = async () => {
    setSibuk(true); setGalat('');
    try {
      const r = await fetch('/api/tools-team/hasil-av', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyek_id: pilih, judul, catatan, ringkasan: ringkasan(), lembar: lembar() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setGalat(j.error || 'Gagal menyimpan.');
      else setTersimpan(proyek?.find(p => p.id === pilih)?.nama ?? 'proyek');
    } catch { setGalat('Gagal menyimpan - periksa koneksi.'); }
    setSibuk(false);
  };

  if (tersimpan) {
    return (
      <Modal buka onTutup={onTutup} judul="Tersimpan" ukuran="sm" footer={<TombolModal jenis="utama" onClick={onTutup}>Selesai</TombolModal>}>
        <p className="text-sm text-slate-700">Hasil <b>{judul}</b> tersimpan di proyek <b>{tersimpan}</b>. Buka proyeknya di Project Progress untuk melihat atau mencetak ulang.</p>
      </Modal>
    );
  }

  return (
    <Modal buka onTutup={onTutup} judul="Simpan hasil ke proyek" ukuran="md" tutupDiLuar={false}
      keterangan="Ringkasan & lembar A4 hasil ini disimpan di proyek - bisa dicetak ulang dari detail proyek."
      footer={<>
        <TombolModal onClick={onTutup} disabled={sibuk}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={() => void simpan()} disabled={sibuk || !pilih || !judul.trim()}>{sibuk ? 'Menyimpan…' : 'Simpan'}</TombolModal>
      </>}>
      <div className="space-y-3">
        <label className="block"><span className={label}>Judul</span>
          <input value={judul} onChange={e => setJudul(e.target.value)} maxLength={120} className={isian} /></label>
        <div>
          <span className={label}>Proyek</span>
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama proyek / client" aria-label="Cari proyek" className={`${isian} pl-8`} />
          </div>
          <div className="rounded-xl border border-slate-200 max-h-60 overflow-y-auto divide-y divide-slate-100" role="radiogroup" aria-label="Proyek">
            {proyek === null && <p className="p-4 text-center text-sm text-slate-400">Memuat proyek…</p>}
            {proyek && tampil.length === 0 && <p className="p-4 text-center text-sm text-slate-500">{proyek.length ? 'Tidak ada yang cocok.' : 'Belum ada proyek yang bisa Anda lihat.'}</p>}
            {tampil.map(p => (
              <button key={p.id} type="button" role="radio" aria-checked={pilih === p.id} onClick={() => setPilih(p.id)}
                className={`w-full text-left px-3 py-2 ${pilih === p.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                <span className={`block text-sm font-semibold truncate ${pilih === p.id ? 'text-blue-800' : 'text-slate-800'}`}>{p.nama}</span>
                <span className="block text-[11.5px] text-slate-500 truncate">{p.client || 'Tanpa client'}{p.status === 'done' ? ' · selesai' : ''}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="block"><span className={label}>Catatan (opsional)</span>
          <textarea value={catatan} onChange={e => setCatatan(e.target.value)} maxLength={500} rows={2} className={isian}
            placeholder="mis. Ruang rapat lt. 3, versi 2 setelah survei" /></label>
        {galat && <p className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[13px] font-semibold text-rose-700">{galat}</p>}
      </div>
    </Modal>
  );
}
