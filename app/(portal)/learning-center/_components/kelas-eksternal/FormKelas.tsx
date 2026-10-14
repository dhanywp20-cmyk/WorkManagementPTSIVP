'use client';

/** Buat / ubah Kelas Eksternal. Soal dipilih dari Bank Soal (hanya pilihan ganda ABCD - dinilai otomatis). */
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal, TombolModal } from '@/components/shared';
import { supabase } from '@/lib/supabase';
import type { KelasEksternal } from '@/lib/kelas-eksternal';

interface SoalRingkas { id: string; materi_name: string | null; batch_name: string | null; question: string }

const isian = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const label = 'block text-[11.5px] font-bold uppercase tracking-wider text-slate-500 mb-1';
const keLokal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export function FormKelas({ awal, onTutup, onSimpan }: {
  awal: KelasEksternal | null; onTutup: () => void; onSimpan: (k: Record<string, unknown>) => Promise<string | null>;
}) {
  const [f, setF] = useState(() => ({
    judul: awal?.judul ?? '', keterangan: awal?.keterangan ?? '',
    timer_menit: awal?.timer_menit ? String(awal.timer_menit) : '', passing_grade: String(awal?.passing_grade ?? 70),
    maks_peserta: String(awal?.maks_peserta ?? 200), buka_pada: keLokal(awal?.buka_pada ?? null), tutup_pada: keLokal(awal?.tutup_pada ?? null),
    acak_soal: awal?.acak_soal ?? true, satu_kali: awal?.satu_kali ?? true, aktif: awal?.aktif ?? true,
  }));
  const [pilih, setPilih] = useState<Set<string>>(() => new Set(awal?.question_ids ?? []));
  const [soal, setSoal] = useState<SoalRingkas[] | null>(null);
  const [cari, setCari] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    let batal = false;
    supabase.from('lc_questions').select('id,materi_name,batch_name,question').eq('question_type', 'abcd')
      .order('materi_name').order('batch_name').order('urutan', { ascending: true, nullsFirst: false }).limit(2000)
      .then(({ data, error }) => { if (!batal) { if (error) setGalat('Bank soal tidak terbaca.'); setSoal((data ?? []) as SoalRingkas[]); } });
    return () => { batal = true; };
  }, []);

  const grup = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const m = new Map<string, SoalRingkas[]>();
    for (const s of soal ?? []) {
      const kunci = [s.materi_name || 'Tanpa materi', s.batch_name].filter(Boolean).join(' · ');
      if (q && !`${kunci} ${s.question}`.toLowerCase().includes(q)) continue;
      m.set(kunci, [...(m.get(kunci) ?? []), s]);
    }
    return [...m];
  }, [soal, cari]);

  const ubahSet = (ids: string[], nyala: boolean) => setPilih(p => {
    const b = new Set(p);
    for (const id of ids) { if (nyala) b.add(id); else b.delete(id); }
    return b;
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF(x => ({ ...x, [k]: e.target.value }));

  const simpan = async () => {
    setSibuk(true); setGalat('');
    const urut = (soal ?? []).filter(s => pilih.has(s.id)).map(s => s.id);
    const g = await onSimpan({
      ...f, question_ids: urut.length ? urut : [...pilih],
      buka_pada: f.buka_pada ? new Date(f.buka_pada).toISOString() : null,
      tutup_pada: f.tutup_pada ? new Date(f.tutup_pada).toISOString() : null,
    });
    setSibuk(false);
    if (g) setGalat(g);
  };

  return (
    <Modal buka onTutup={onTutup} judul={awal ? 'Ubah kelas' : 'Kelas eksternal baru'} ukuran="xl" tutupDiLuar={false}
      footer={<>
        <TombolModal onClick={onTutup}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={() => void simpan()} disabled={sibuk || !f.judul.trim() || pilih.size === 0}>
          {sibuk ? 'Menyimpan…' : 'Simpan'}
        </TombolModal>
      </>}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-3">
          <div><label className={label} htmlFor="kx-judul">Judul kelas</label>
            <input id="kx-judul" className={isian} value={f.judul} onChange={set('judul')} maxLength={120} placeholder="Training Videowall - PT ABC" /></div>
          <div><label className={label} htmlFor="kx-ket">Keterangan</label>
            <textarea id="kx-ket" className={isian} rows={3} value={f.keterangan} onChange={set('keterangan')} maxLength={1000} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className={label} htmlFor="kx-timer" title="Kosong = tanpa batas waktu">Waktu (mnt)</label>
              <input id="kx-timer" type="number" min={1} max={300} className={isian} value={f.timer_menit} onChange={set('timer_menit')} placeholder="∞" /></div>
            <div><label className={label} htmlFor="kx-lulus">Nilai lulus</label>
              <input id="kx-lulus" type="number" min={0} max={100} className={isian} value={f.passing_grade} onChange={set('passing_grade')} /></div>
            <div><label className={label} htmlFor="kx-maks">Maks peserta</label>
              <input id="kx-maks" type="number" min={1} max={2000} className={isian} value={f.maks_peserta} onChange={set('maks_peserta')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={label} htmlFor="kx-buka">Dibuka</label>
              <input id="kx-buka" type="datetime-local" className={isian} value={f.buka_pada} onChange={set('buka_pada')} /></div>
            <div><label className={label} htmlFor="kx-tutup">Ditutup</label>
              <input id="kx-tutup" type="datetime-local" className={isian} value={f.tutup_pada} onChange={set('tutup_pada')} /></div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            {([['acak_soal', 'Acak urutan soal'], ['satu_kali', 'Hanya sekali kerja'], ['aktif', 'Aktif']] as const).map(([k, t]) => (
              <label key={k} className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={f[k]} onChange={e => setF(x => ({ ...x, [k]: e.target.checked }))} />{t}
              </label>
            ))}
          </div>
          {galat && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[13px] font-semibold text-red-700">{galat}</p>}
        </div>

        <div className="min-w-0 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[11.5px] font-bold uppercase tracking-wider text-slate-500 flex-1">Soal · {pilih.size} dipilih</p>
            <div className="relative w-48">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari soal / materi" aria-label="Cari soal"
                className="w-full rounded-lg border border-slate-300 pl-8 pr-2 py-1.5 text-[12.5px] outline-none focus:border-indigo-500" />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 overflow-y-auto max-h-[52vh] divide-y divide-slate-100">
            {soal === null && <p className="p-6 text-center text-[13px] text-slate-400">Memuat bank soal…</p>}
            {soal && grup.length === 0 && <p className="p-6 text-center text-[13px] text-slate-400">Tidak ada soal pilihan ganda.</p>}
            {grup.map(([nama, daftar]) => {
              const semua = daftar.every(s => pilih.has(s.id));
              return (
                <details key={nama} open={!!cari.trim()} className="group">
                  <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer bg-slate-50 hover:bg-slate-100 list-none">
                    <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={semua} aria-label={`Pilih semua: ${nama}`}
                      onClick={e => e.stopPropagation()} onChange={e => ubahSet(daftar.map(s => s.id), e.target.checked)} />
                    <span className="flex-1 min-w-0 text-[13px] font-semibold text-slate-800 truncate">{nama}</span>
                    <span className="text-[11.5px] font-bold text-slate-500 tabular-nums">{daftar.filter(s => pilih.has(s.id)).length}/{daftar.length}</span>
                  </summary>
                  {daftar.map(s => (
                    <label key={s.id} className="flex items-start gap-2 px-3 py-2 pl-9 cursor-pointer hover:bg-slate-50">
                      <input type="checkbox" className="w-4 h-4 mt-0.5 accent-indigo-600" checked={pilih.has(s.id)} onChange={e => ubahSet([s.id], e.target.checked)} />
                      <span className="text-[12.5px] text-slate-700 line-clamp-2">{s.question}</span>
                    </label>
                  ))}
                </details>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
