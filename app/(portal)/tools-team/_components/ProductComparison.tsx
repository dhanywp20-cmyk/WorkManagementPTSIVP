'use client';
/**
 * Product Comparison (battle card) - Tools Team. Brosur PDF -> perbandingan (template baku owner) -> PDF.
 *   Orang produk (Admin & Team PTS) mengunduh langsung; Sales / Marketing mengajukan verifikasi ke Admin /
 *   Supervisor Team PTS IVP & MVI dulu (lib/perbandingan.ts). Detail alur data: app/api/tools-team/perbandingan.
 */
import { useState } from 'react';
import { ConfirmDialog, type ConfirmState, ModalTolak, TombolSetujui, TombolTolak } from '@/components/shared';
import { Bot, CheckCheck, ClipboardCopy, Download, Info, Loader2, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import { type Bahasa, jumlahCek, type KartuBanding, loloskanSemua } from '@/lib/perbandingan';
import { UnggahBrosur } from './perbandingan/UnggahBrosur';
import { PratinjauKartu } from './perbandingan/PratinjauKartu';
import { DaftarPengajuan } from './perbandingan/DaftarPengajuan';
import { useBuatPerbandingan } from './perbandingan/useBuatPerbandingan';
import { type RingkasPengajuan, usePengajuan } from './perbandingan/usePengajuan';
import { unduhPdf } from './perbandingan/unduhPdf';

type Mode = { jenis: 'baru' } | { jenis: 'periksa'; r: RingkasPengajuan } | { jenis: 'lihat'; r: RingkasPengajuan };
const tombol = 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-bold disabled:opacity-50';

export function ProductComparison() {
  const b = useBuatPerbandingan();
  const p = usePengajuan();
  const [tab, setTab] = useState<'buat' | 'pengajuan'>('buat');
  const [bahasa, setBahasa] = useState<Bahasa>('en');
  const [cara, setCara] = useState<'otomatis' | 'salin'>('otomatis');
  const [jawaban, setJawaban] = useState('');
  const [kartu, setKartu] = useState<KartuBanding | null>(null);
  const [mode, setMode] = useState<Mode>({ jenis: 'baru' });
  const [catatan, setCatatan] = useState('');
  const [tolakBuka, setTolakBuka] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const [pesan, setPesan] = useState<{ t: string; galat?: boolean } | null>(null);
  const [kerja, setKerja] = useState<string | null>(null);
  const cek = kartu ? jumlahCek(kartu) : 0;
  const jalankan = async (id: string, f: () => Promise<void | string>) => {
    setKerja(id); setPesan(null);
    try { const t = await f(); if (t) setPesan({ t }); } catch (e) { setPesan({ t: (e as Error).message, galat: true }); } finally { setKerja(null); }
  };
  const terima = (h: { data: KartuBanding; dicek: number; terpangkas: string[] }) => {
    setKartu(h.data); setMode({ jenis: 'baru' });
    return [h.dicek ? `${h.dicek} nilai perlu dicek (kuning).` : 'Semua nilai bersumber dari brosur.', h.terpangkas.length ? `Teks ${h.terpangkas.join(', ')} terlalu panjang - sebagian dipangkas.` : ''].filter(Boolean).join(' ');
  };
  const bukaPengajuan = (r: RingkasPengajuan) => jalankan(r.id, async () => {
    setKartu(await p.ambil(r.id)); setCatatan('');
    setMode(p.peran?.verifikator && r.status === 'menunggu' ? { jenis: 'periksa', r } : { jenis: 'lihat', r }); setTab('buat');
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['buat', 'pengajuan'] as const).map(t => (
          <button key={t} type="button" onClick={() => { setTab(t); if (t === 'pengajuan') void p.muat(); }} aria-pressed={tab === t}
            className={`px-4 py-2 rounded-xl text-[13px] font-bold border ${tab === t ? 'bg-blue-700 border-blue-700 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
            {t === 'buat' ? 'Buat Comparison' : `${p.peran?.verifikator ? 'Verifikasi' : 'Pengajuan saya'} (${p.daftar.filter(x => x.status === 'menunggu').length || p.daftar.length})`}
          </button>
        ))}
        {p.peran && !p.peran.langsung && (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600" title="PDF untuk customer harus diverifikasi Team PTS (Admin / Supervisor PTS IVP & MVI) sebelum diunduh">
            <ShieldCheck size={14} className="text-emerald-600" /> Diverifikasi Team PTS
          </span>
        )}
      </div>

      {tab === 'pengajuan' ? (
        p.peran ? <DaftarPengajuan daftar={p.daftar} peran={p.peran} sibuk={kerja} buka={r => void bukaPengajuan(r)}
          unduh={r => void jalankan(r.id, async () => { await unduhPdf(await p.ambil(r.id)); })} />
          : <p className="text-[13px] text-slate-500">{p.galat ?? 'Memuat…'}</p>
      ) : (
        <>
          {mode.jenis === 'baru' && !kartu && (
            <section className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
              <UnggahBrosur daftar={b.brosur} unggulan={b.unggulan} kunci={b.sibuk} tambah={f => { const t = b.tambah(f); if (t) setPesan({ t, galat: true }); }}
                ubah={b.ubahNama} hapus={b.hapus} pilihUnggulan={b.setUnggulan} />
              <div className="flex flex-wrap items-center gap-2">
                <select value={bahasa} onChange={e => setBahasa(e.target.value as Bahasa)} aria-label="Bahasa dokumen" className="rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] font-semibold">
                  <option value="en">English</option><option value="id">Bahasa Indonesia</option>
                </select>
                <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden" role="group" aria-label="Cara menyusun">
                  {([['otomatis', 'Otomatis', Sparkles], ['salin', 'AI chat lain', Bot]] as const).map(([v, l, I]) => (
                    <button key={v} type="button" onClick={() => setCara(v)} aria-pressed={cara === v}
                      title={v === 'otomatis' ? 'Gemini (gratis) milik platform' : 'Salin prompt ke Claude.ai / ChatGPT / Gemini, lalu tempel jawabannya'}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold ${cara === v ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}><I size={14} /> {l}</button>
                  ))}
                </div>
                {cara === 'otomatis' ? (
                  <>
                    <button type="button" disabled={!b.siap || b.sibuk} onClick={() => void jalankan('ai', async () => terima(await b.otomatis(bahasa)))} className={`${tombol} text-white bg-blue-700 hover:bg-blue-800`}>
                      {b.sibuk ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {b.sibuk ? 'Menyusun… (±30 dtk)' : 'Buat Comparison'}
                    </button>
                    {b.sibuk && <button type="button" onClick={b.batalkan} className={`${tombol} text-slate-600 hover:bg-slate-100`}><X size={14} /> Batal</button>}
                    <span title="Teks brosur dikirim ke Google Gemini untuk disusun dan tidak disimpan di platform. Layanan Gemini gratis dapat memakai isi permintaan untuk peningkatan layanannya." className="inline-flex items-center gap-1 text-[12px] text-slate-500"><Info size={13} /> Diproses Google Gemini</span>
                  </>
                ) : (
                  <button type="button" disabled={!b.siap} onClick={() => void jalankan('salin', async () => { await navigator.clipboard.writeText(b.prompt(bahasa)); return 'Prompt tersalin - tempel di AI chat, lalu tempel jawabannya di bawah.'; })}
                    className={`${tombol} border border-slate-200 text-slate-800 hover:bg-slate-50`}><ClipboardCopy size={15} /> Salin prompt</button>
                )}
              </div>
              {cara === 'salin' && (
                <div className="space-y-2">
                  <textarea value={jawaban} onChange={e => setJawaban(e.target.value)} rows={5} placeholder="Tempel jawaban JSON dari AI di sini"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-[12px]" />
                  <button type="button" disabled={!jawaban.trim() || !b.siap} onClick={() => void jalankan('pakai', async () => terima(b.pakaiJawaban(jawaban, bahasa)))}
                    className={`${tombol} text-white bg-blue-700 hover:bg-blue-800`}>Pakai jawaban</button>
                </div>
              )}
            </section>
          )}

          {kartu && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white border border-slate-200 p-3">
                {cek > 0 && <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[12px] font-bold" title="Klik sel kuning untuk memutuskan satu per satu">{cek} nilai perlu dicek</span>}
                {cek > 0 && p.peran?.lolosSemua && (mode.jenis === 'periksa' || (mode.jenis === 'baru' && p.peran.langsung)) && (
                  <button type="button" onClick={() => setKonfirmasi({ message: `Loloskan ${cek} nilai yang ditandai "cek" apa adanya?`, confirmLabel: 'Loloskan semua', onConfirm: () => setKartu(k => (k ? loloskanSemua(k) : k)) })}
                    title="Terima semua nilai bertanda cek sekaligus (berisi teks = disebut brosur, kosong = tidak dipublikasikan)"
                    className={`${tombol} text-amber-900 border border-amber-300 bg-amber-50 hover:bg-amber-100`}><CheckCheck size={15} /> Loloskan semua</button>
                )}
                {mode.jenis === 'baru' && <button type="button" onClick={() => { setKartu(null); setPesan(null); }} className={`${tombol} text-slate-600 hover:bg-slate-100`}>Ulangi</button>}
                {mode.jenis !== 'baru' && <button type="button" onClick={() => { setKartu(null); setMode({ jenis: 'baru' }); setTab('pengajuan'); }} className={`${tombol} text-slate-600 hover:bg-slate-100`}>Kembali</button>}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {mode.jenis === 'baru' && p.peran?.langsung && (
                    <button type="button" disabled={cek > 0 || !!kerja} onClick={() => void jalankan('pdf', () => unduhPdf(kartu))} className={`${tombol} text-white bg-blue-700 hover:bg-blue-800`}>
                      {kerja === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download PDF
                    </button>
                  )}
                  {mode.jenis === 'baru' && p.peran && !p.peran.langsung && (
                    <button type="button" disabled={!!kerja} onClick={() => void jalankan('aju', async () => { await p.ajukan(kartu); setKartu(null); setTab('pengajuan'); return 'Diajukan - Team PTS mendapat notifikasi untuk memverifikasi.'; })}
                      className={`${tombol} text-white bg-blue-700 hover:bg-blue-800`}><Send size={15} /> Ajukan verifikasi</button>
                  )}
                  {mode.jenis === 'periksa' && (
                    <>
                      <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan (opsional)" aria-label="Catatan persetujuan" className="w-56 rounded-lg border border-slate-200 px-2.5 py-2 text-base sm:text-[13px]" />
                      {/*  Pola persetujuan bersama: Tolak membuka ModalTolak (alasan wajib), Setujui tombol utama. */}
                      <TombolTolak disabled={!!kerja} onClick={() => setTolakBuka(true)} />
                      <TombolSetujui disabled={cek > 0 || !!kerja} onClick={() => void jalankan('setuju', async () => { await p.putuskan(mode.r.id, 'setujui', catatan, kartu); setKartu(null); setMode({ jenis: 'baru' }); setTab('pengajuan'); return 'Disetujui - pengaju bisa mengunduh PDF.'; })} />
                      <ModalTolak buka={tolakBuka} onTutup={() => setTolakBuka(false)} judul="Tolak Pengajuan Comparison" sibuk={kerja === 'tolak'}
                        onTolak={alasan => { setTolakBuka(false); void jalankan('tolak', async () => { await p.putuskan(mode.r.id, 'tolak', alasan); setKartu(null); setMode({ jenis: 'baru' }); setTab('pengajuan'); return 'Ditolak - pengaju mendapat notifikasi.'; }); }} />
                    </>
                  )}
                  {mode.jenis === 'lihat' && mode.r.status === 'disetujui' && (
                    <button type="button" disabled={!!kerja} onClick={() => void jalankan('pdf', () => unduhPdf(kartu))} className={`${tombol} text-white bg-blue-700 hover:bg-blue-800`}><Download size={15} /> Download PDF</button>
                  )}
                  {mode.jenis === 'lihat' && mode.r.status === 'ditolak' && (
                    <button type="button" onClick={() => setMode({ jenis: 'baru' })} className={`${tombol} border border-slate-200 text-slate-800 hover:bg-slate-50`}>Perbaiki & ajukan lagi</button>
                  )}
                </div>
              </div>
              <PratinjauKartu k={kartu} ubah={setKartu} bolehEdit={mode.jenis !== 'lihat'} />
            </section>
          )}
        </>
      )}
      {pesan && <p role="status" className={`text-[13px] font-semibold ${pesan.galat ? 'text-rose-700' : 'text-emerald-700'}`}>{pesan.t}</p>}
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </div>
  );
}
