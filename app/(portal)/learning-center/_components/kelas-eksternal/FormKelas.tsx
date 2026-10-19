'use client';

/**
 * Buat / ubah Kelas Eksternal. Soal dipilih dari Bank Soal (hanya pilihan ganda ABCD - dinilai otomatis).
 * Format Kuis Live (ala Kahoot, bawaan untuk yang baru) atau Ujian mandiri (nilai & KKM).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Search, Trash2, Upload } from 'lucide-react';
import { Modal, TombolModal } from '@/components/shared';
import { supabase } from '@/lib/supabase';
import { ISIAN_PESERTA, type IsianPeserta, type JenisKelas, type KelasEksternal } from '@/lib/kelas-eksternal';
import { PALET_TEMA, PILIHAN_DETIK, WARNA_BAWAAN, teksDiAtas } from '@/lib/kuis-live';

interface SoalRingkas { id: string; materi_name: string | null; batch_name: string | null; question: string }

const isian = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const label = 'block text-[11.5px] font-bold uppercase tracking-wider text-slate-500 mb-1';
const keLokal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export function FormKelas({ awal, onTutup, onSimpan }: {
  awal: KelasEksternal | null; onTutup: () => void; onSimpan: (k: Record<string, unknown>) => Promise<string | null>;
}) {
  const [f, setF] = useState(() => ({
    jenis: (awal?.jenis ?? 'live') as JenisKelas, detik_per_soal: awal?.detik_per_soal ?? 20,
    tema_warna: awal?.tema_warna ?? WARNA_BAWAAN, logo_url: awal?.logo_url ?? '', latar_url: awal?.latar_url ?? '',
    judul: awal?.judul ?? '', keterangan: awal?.keterangan ?? '',
    timer_menit: awal?.timer_menit ? String(awal.timer_menit) : '', passing_grade: String(awal?.passing_grade ?? 70),
    maks_peserta: String(awal?.maks_peserta ?? 200), buka_pada: keLokal(awal?.buka_pada ?? null), tutup_pada: keLokal(awal?.tutup_pada ?? null),
    acak_soal: awal?.acak_soal ?? true, satu_kali: awal?.satu_kali ?? true, aktif: awal?.aktif ?? true,
    mode_mulai: awal?.mode_mulai ?? 'auto', batas_pelanggaran: awal?.batas_pelanggaran ? String(awal.batas_pelanggaran) : '',
    isian_peserta: (awal?.isian_peserta ?? 'nama') as IsianPeserta,
  }));
  const [pilih, setPilih] = useState<Set<string>>(() => new Set(awal?.question_ids ?? []));
  const [soal, setSoal] = useState<SoalRingkas[] | null>(null);
  const [cari, setCari] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [mengunggah, setMengunggah] = useState<'logo' | 'latar' | null>(null);
  const live = f.jenis === 'live';

  /** Logo dikirim apa adanya (tetap transparan); gambar latar dikecilkan dulu (foto kamera bisa belasan MB). */
  const unggah = async (berkas: File | undefined, jenis: 'logo' | 'latar') => {
    if (!berkas) return;
    setMengunggah(jenis); setGalat('');
    let siap = berkas;
    if (jenis === 'latar') {
      try { const { compressImage } = await import('@/lib/image-compress'); siap = await compressImage(berkas, { maxDim: 1920, quality: 0.8 }); } catch { /* kirim aslinya */ }
    }
    const fd = new FormData();
    fd.append('berkas', siap); fd.append('jenis', jenis);
    try {
      const r = await fetch('/api/admin/kelas-eksternal/unggah', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setGalat(j.error || 'Unggah gagal.');
      else setF(x => ({ ...x, [jenis === 'logo' ? 'logo_url' : 'latar_url']: j.url as string }));
    } catch { setGalat('Unggah gagal - periksa koneksi.'); }
    setMengunggah(null);
  };

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
    <Modal buka onTutup={onTutup} judul={awal ? (live ? 'Ubah kuis' : 'Ubah kelas') : live ? 'Kuis live baru' : 'Kelas eksternal baru'} ukuran="xl" tutupDiLuar={false}
      footer={<>
        <TombolModal onClick={onTutup}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={() => void simpan()} disabled={sibuk || !!mengunggah || !f.judul.trim() || pilih.size === 0}>
          {sibuk ? 'Menyimpan…' : 'Simpan'}
        </TombolModal>
      </>}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-3">
          <div>
            <p className={label}>Format</p>
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Format">
              {([['live', 'Kuis Live', 'Ala Kahoot · dipandu admin · poin & papan skor'], ['mandiri', 'Ujian mandiri', 'Dikerjakan sendiri · nilai & KKM']] as const).map(([v, t, ket]) => (
                <button key={v} type="button" role="radio" aria-checked={f.jenis === v} onClick={() => setF(x => ({ ...x, jenis: v }))}
                  className={`rounded-xl border-2 px-3 py-2 text-left ${f.jenis === v ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'}`}>
                  <span className={`block text-[13.5px] font-bold ${f.jenis === v ? 'text-indigo-700' : 'text-slate-700'}`}>{t}</span>
                  <span className="block text-[11.5px] text-slate-500 leading-snug">{ket}</span>
                </button>
              ))}
            </div>
          </div>
          <div><label className={label} htmlFor="kx-judul">{live ? 'Judul kuis' : 'Judul kelas'}</label>
            <input id="kx-judul" className={isian} value={f.judul} onChange={set('judul')} maxLength={120} placeholder={live ? 'Kuis Better Together - Philips & WyreStorm' : 'Training Videowall - PT ABC'} /></div>
          <div><label className={label} htmlFor="kx-ket">Keterangan</label>
            <textarea id="kx-ket" className={isian} rows={2} value={f.keterangan} onChange={set('keterangan')} maxLength={1000} /></div>
          {live ? <>
            <div>
              <p className={label}>Waktu per soal</p>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Waktu per soal">
                {PILIHAN_DETIK.map(d => (
                  <button key={d} type="button" role="radio" aria-checked={f.detik_per_soal === d} onClick={() => setF(x => ({ ...x, detik_per_soal: d }))}
                    className={`min-w-[52px] rounded-lg border-2 px-2.5 py-1.5 text-[13px] font-bold tabular-nums ${f.detik_per_soal === d ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>
                    {d < 60 ? `${d} dtk` : `${d / 60} mnt`}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={label} htmlFor="kx-maks">Maks pemain</label>
                <input id="kx-maks" type="number" min={1} max={500} className={isian} value={f.maks_peserta} onChange={set('maks_peserta')} /></div>
              <div className="flex flex-col justify-end gap-2 pb-1">
                {([['acak_soal', 'Acak urutan soal'], ['aktif', 'Aktif']] as const).map(([k, t]) => (
                  <label key={k} className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={f[k]} onChange={e => setF(x => ({ ...x, [k]: e.target.checked }))} />{t}
                  </label>
                ))}
              </div>
            </div>
            <TampilanKuis f={f} setF={setF} mengunggah={mengunggah} unggah={unggah} />
          </> : <>
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
          <div>
            <p className={label}>Mulai</p>
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Mode mulai">
              {([['auto', 'Auto', 'Peserta mulai sendiri'], ['admin', 'Dimulai admin', 'Semua mulai serentak saat admin menekan Mulai']] as const).map(([v, t, ket]) => (
                <button key={v} type="button" role="radio" aria-checked={f.mode_mulai === v} title={ket}
                  onClick={() => setF(x => ({ ...x, mode_mulai: v }))}
                  className={`rounded-lg border-2 px-3 py-2 text-[13px] font-bold ${f.mode_mulai === v ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div><label className={label} htmlFor="kx-langgar" title="Pindah tab, keluar jendela, salin/tempel. Kosong = hanya dicatat.">Kirim otomatis setelah … pelanggaran</label>
            <input id="kx-langgar" type="number" min={1} max={50} className={isian} value={f.batas_pelanggaran} onChange={set('batas_pelanggaran')} placeholder="Hanya dicatat" /></div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
            {([['acak_soal', 'Acak urutan soal'], ['satu_kali', 'Hanya sekali kerja'], ['aktif', 'Aktif']] as const).map(([k, t]) => (
              <label key={k} className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={f[k]} onChange={e => setF(x => ({ ...x, [k]: e.target.checked }))} />{t}
              </label>
            ))}
          </div>
          </>}
          <div>
            <p className={label}>Data peserta</p>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Data peserta">
              {ISIAN_PESERTA.map(o => (
                <button key={o.nilai} type="button" role="radio" aria-checked={f.isian_peserta === o.nilai} title={o.ket}
                  onClick={() => setF(x => ({ ...x, isian_peserta: o.nilai }))}
                  className={`rounded-lg border-2 px-2 py-1.5 text-left ${f.isian_peserta === o.nilai ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'}`}>
                  <span className={`block text-[12.5px] font-bold leading-tight ${f.isian_peserta === o.nilai ? 'text-indigo-700' : 'text-slate-700'}`}>{o.label}</span>
                  <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">{o.ket}</span>
                </button>
              ))}
            </div>
            {f.isian_peserta !== 'nama' && (
              <p className="mt-1 text-[11.5px] text-slate-500">Muncul di daftar hasil &amp; CSV. Untuk acara customer: tahu siapa yang hadir dan siapa yang mau dihubungi Sales.</p>
            )}
          </div>
          {galat && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[13px] font-semibold text-red-700">{galat}</p>}
        </div>

        <div className="min-w-0 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[11.5px] font-bold uppercase tracking-wider text-slate-500 flex-1">Soal · {pilih.size} dipilih</p>
            <div className="relative w-48">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari soal / materi" aria-label="Cari soal"
                className="w-full rounded-lg border border-slate-300 pl-8 pr-2 py-1.5 text-[12.5px] outline-hidden focus:border-indigo-500" />
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

type IsianTampilan = { tema_warna: string; logo_url: string; latar_url: string; judul: string };

/** Warna tema, logo event, gambar latar + pratinjau kecil layar peserta. */
function TampilanKuis<T extends IsianTampilan>({ f, setF, mengunggah, unggah }: {
  f: T; setF: React.Dispatch<React.SetStateAction<T>>; mengunggah: 'logo' | 'latar' | null;
  unggah: (b: File | undefined, jenis: 'logo' | 'latar') => Promise<void>;
}) {
  const inputLogo = useRef<HTMLInputElement>(null);
  const inputLatar = useRef<HTMLInputElement>(null);
  const terang = teksDiAtas(f.tema_warna) !== '#ffffff';
  const tombolGambar = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
  return (
    <div className="rounded-xl border border-slate-200 p-3 space-y-3">
      <p className="text-[11.5px] font-bold uppercase tracking-wider text-slate-500">Tampilan</p>
      <div>
        <p className="text-[12px] font-semibold text-slate-600 mb-1.5">Warna tema</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {PALET_TEMA.map(w => (
            <button key={w} type="button" aria-label={`Warna ${w}`} aria-pressed={f.tema_warna === w} onClick={() => setF(x => ({ ...x, tema_warna: w }))}
              className={`w-8 h-8 rounded-full border-2 ${f.tema_warna === w ? 'border-slate-900 ring-2 ring-offset-1 ring-slate-900' : 'border-white shadow-sm'}`}
              style={{ backgroundColor: w }} />
          ))}
          <label className="relative w-8 h-8 rounded-full border-2 border-dashed border-slate-300 overflow-hidden cursor-pointer" title="Warna lain">
            <input type="color" value={f.tema_warna} onChange={e => setF(x => ({ ...x, tema_warna: e.target.value }))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" aria-label="Pilih warna lain" />
            <span className="flex w-full h-full items-center justify-center text-[15px] text-slate-500">+</span>
          </label>
        </div>
        {terang && <p className="mt-1 text-[11.5px] text-amber-700">Warna terang - layar akan digelapkan sedikit supaya tulisan putih terbaca.</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(['logo', 'latar'] as const).map(jenis => {
          const url = jenis === 'logo' ? f.logo_url : f.latar_url;
          const input = jenis === 'logo' ? inputLogo : inputLatar;
          return (
            <div key={jenis} className="space-y-1.5">
              <p className="text-[12px] font-semibold text-slate-600">{jenis === 'logo' ? 'Logo event' : 'Gambar latar'}</p>
              <div className={`h-16 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden ${jenis === 'logo' ? 'bg-slate-50' : 'bg-slate-100'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {url ? <img src={url} alt="" className={jenis === 'logo' ? 'max-h-12 max-w-full object-contain' : 'w-full h-full object-cover'} />
                  : <ImagePlus size={20} className="text-slate-400" />}
              </div>
              <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={e => { void unggah(e.target.files?.[0], jenis); e.target.value = ''; }} />
              <div className="flex gap-1.5">
                <button type="button" className={tombolGambar} disabled={!!mengunggah} onClick={() => input.current?.click()}>
                  <Upload size={13} />{mengunggah === jenis ? 'Mengunggah…' : url ? 'Ganti' : 'Unggah'}
                </button>
                {url && (
                  <button type="button" className={`${tombolGambar} text-red-600`} aria-label={`Hapus ${jenis}`}
                    onClick={() => setF(x => ({ ...x, [jenis === 'logo' ? 'logo_url' : 'latar_url']: '' }))}><Trash2 size={13} /></button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500">PNG/JPG/WebP. Logo maks 2 MB (PNG transparan paling rapi); latar dikecilkan otomatis.</p>
      <div>
        <p className="text-[12px] font-semibold text-slate-600 mb-1.5">Pratinjau</p>
        <div className="relative h-28 rounded-xl overflow-hidden text-white flex flex-col items-center justify-center gap-1.5 px-3"
          style={{
            backgroundColor: f.tema_warna,
            ...(f.latar_url ? { backgroundImage: `linear-gradient(rgba(0,0,0,.4), rgba(0,0,0,.68)), url("${f.latar_url}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
          }}>
          {!f.latar_url && terang && <div className="absolute inset-0 bg-black/35" />}
          {f.logo_url && (
            <span className="relative rounded-md bg-white/95 px-1.5 py-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.logo_url} alt="" className="h-6 w-auto max-w-[110px] object-contain" />
            </span>
          )}
          <p className="relative text-[13px] font-black text-center line-clamp-1">{f.judul || 'Judul kuis'}</p>
          <div className="relative grid grid-cols-4 gap-1 w-full max-w-[220px]">
            {['#e21b3c', '#1368ce', '#d89e00', '#26890c'].map(w => <span key={w} className="h-3.5 rounded-sm" style={{ backgroundColor: w }} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
