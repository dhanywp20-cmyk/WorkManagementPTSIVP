'use client';

/**
 * Learning Center -> Kelas Eksternal: quiz untuk customer tanpa akun. Admin membuat kelas (soal dari
 * Bank Soal), membagikan link/QR, lalu melihat nilai. Halaman customer: /kelas/<token>.
 * Dua format: Kuis Live (ala Kahoot, dipandu dari LayarHost) dan Ujian mandiri (nilai & KKM).
 */
import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Copy, ExternalLink, MonitorPlay, Pencil, Play, Plus, QrCode, RotateCcw, Square, Trash2, Users } from 'lucide-react';
import { ConfirmDialog, Modal, TombolModal, type ConfirmState } from '@/components/shared';
import { appBaseUrl } from '@/lib/app-url';
import { statusKelas, type KelasEksternal, type StatusKelas } from '@/lib/kelas-eksternal';
import { WARNA_BAWAAN, jadwalLive, labelTahap, statusLive, type StatusLive } from '@/lib/kuis-live';
import { FormKelas } from './FormKelas';
import { HasilKelas } from './HasilKelas';
import { LayarHost, masukLayarPenuh } from './LayarHost';

type Baris = KelasEksternal & StatusLive & { jumlahPeserta: number; jumlahSelesai: number; rataRata: number | null };

const LABEL_STATUS: Record<StatusKelas, { teks: string; kelas: string }> = {
  buka: { teks: 'Dibuka', kelas: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  nonaktif: { teks: 'Nonaktif', kelas: 'bg-slate-100 text-slate-600 border-slate-200' },
  belum: { teks: 'Belum dibuka', kelas: 'bg-sky-50 text-sky-700 border-sky-200' },
  selesai: { teks: 'Ditutup', kelas: 'bg-slate-100 text-slate-600 border-slate-200' },
  penuh: { teks: 'Penuh', kelas: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const tombol = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 hover:bg-slate-50';

export function KelasEksternalPage() {
  const [daftar, setDaftar] = useState<Baris[] | null>(null);
  const [ubah, setUbah] = useState(false);
  const [galat, setGalat] = useState('');
  const [form, setForm] = useState<KelasEksternal | 'baru' | null>(null);
  const [hasil, setHasil] = useState<Baris | null>(null);
  const [host, setHost] = useState<Baris | null>(null);
  const [qr, setQr] = useState<{ judul: string; url: string; gambar: string } | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const [kabar, setKabar] = useState('');
  const [sibukId, setSibukId] = useState<string | null>(null);

  const muat = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/kelas-eksternal', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) { setGalat(j.error || 'Gagal memuat.'); return; }
      setDaftar(j.kelas); setUbah(j.ubah === true); setGalat('');
    } catch { setGalat('Gagal memuat.'); }
  }, []);
  useEffect(() => { void muat(); }, [muat]);

  const kabarkan = (t: string) => { setKabar(t); window.setTimeout(() => setKabar(''), 2500); };
  const linkKelas = (k: KelasEksternal) => `${appBaseUrl()}/kelas/${k.token}`;

  const panggil = async (body: Record<string, unknown>): Promise<string | null> => {
    const r = await fetch('/api/admin/kelas-eksternal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.error || 'Gagal menyimpan.';
    await muat();
    return null;
  };

  const aksiKelas = async (aksi: 'mulai' | 'akhiri' | 'buka_lagi', k: KelasEksternal) => {
    setSibukId(k.id);
    const g = await panggil({ aksi, id: k.id });
    setSibukId(null);
    if (g) setGalat(g);
    else kabarkan(aksi === 'mulai' ? 'Quiz dimulai - peserta di ruang tunggu langsung masuk.' : aksi === 'akhiri' ? 'Kelas diakhiri.' : 'Kelas dibuka lagi.');
  };

  //  Ruang tunggu: jumlah peserta hadir disegarkan tiap 10 dtk selama ada kelas mode admin yang menunggu.
  const adaMenunggu = (daftar ?? []).some(k => k.mode_mulai === 'admin' && !k.dimulai_pada && k.aktif);
  useEffect(() => {
    if (!adaMenunggu) return;
    const t = window.setInterval(() => { void muat(); }, 10_000);
    return () => window.clearInterval(t);
  }, [adaMenunggu, muat]);

  const salin = async (k: KelasEksternal) => {
    try { await navigator.clipboard.writeText(linkKelas(k)); kabarkan('Link disalin.'); } catch { kabarkan(linkKelas(k)); }
  };
  const bukaQr = async (k: KelasEksternal) => {
    const QRCode = (await import('qrcode')).default;
    const url = linkKelas(k);
    setQr({ judul: k.judul, url, gambar: await QRCode.toDataURL(url, { width: 320, margin: 1 }) });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold text-slate-900">Kelas Eksternal</h2>
          <p className="text-[12px] text-slate-500">Kuis live ala Kahoot & ujian untuk customer · cukup isi nama · tanpa akun</p>
        </div>
        {ubah && (
          <button type="button" onClick={() => setForm('baru')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-[13px] font-bold"><Plus size={15} />Buat baru</button>
        )}
      </div>

      {kabar && <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-[13px] font-semibold text-emerald-700 break-all">{kabar}</p>}
      {galat && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[13px] font-semibold text-red-700">{galat}</p>}
      {!daftar && !galat && <p className="py-12 text-center text-[13px] text-slate-400">Memuat…</p>}
      {daftar && daftar.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-[14px] font-bold text-slate-800">Belum ada kelas eksternal</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(daftar ?? []).map(k => {
          if (k.jenis === 'live') return (
            <KartuLive key={k.id} k={k} ubah={ubah} onHost={() => { masukLayarPenuh(); setHost(k); }} onHasil={() => setHasil(k)} onUbah={() => setForm(k)}
              onSalin={() => void salin(k)} onQr={() => void bukaQr(k)}
              onHapus={() => setKonfirmasi({
                message: `Hapus "${k.judul}"?`, description: `${k.jumlahPeserta} pemain beserta skornya ikut terhapus permanen.`,
                confirmLabel: 'Hapus', danger: true,
                onConfirm: async () => { setKonfirmasi(null); const g = await panggil({ aksi: 'hapus', id: k.id }); if (g) setGalat(g); },
              })} />
          );
          const st = LABEL_STATUS[statusKelas(k, k.jumlahPeserta)];
          return (
            <section key={k.id} className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3 shadow-sm">
              <div className="flex items-start gap-2">
                <h3 className="flex-1 min-w-0 text-[14.5px] font-bold text-slate-900 leading-snug">{k.judul}</h3>
                <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${st.kelas}`}>{st.teks}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 py-2"><p className="text-[17px] font-extrabold tabular-nums text-slate-900">{k.jumlahPeserta}</p><p className="text-[10.5px] font-bold uppercase text-slate-500">Peserta</p></div>
                <div className="rounded-lg bg-slate-50 py-2"><p className="text-[17px] font-extrabold tabular-nums text-slate-900">{k.jumlahSelesai}</p><p className="text-[10.5px] font-bold uppercase text-slate-500">Selesai</p></div>
                <div className="rounded-lg bg-slate-50 py-2"><p className="text-[17px] font-extrabold tabular-nums text-slate-900">{k.rataRata ?? '-'}</p><p className="text-[10.5px] font-bold uppercase text-slate-500">Rata-rata</p></div>
              </div>
              {k.mode_mulai === 'admin' && (() => {
                const ditutup = !!k.tutup_pada && new Date(k.tutup_pada).getTime() <= Date.now();
                const jam = (iso: string) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2">
                    <span className="flex-1 min-w-0 text-[12.5px] font-semibold text-indigo-900">
                      {ditutup ? 'Diakhiri' : k.dimulai_pada ? `Berjalan sejak ${jam(k.dimulai_pada)}` : `Ruang tunggu · ${k.jumlahPeserta} hadir`}
                    </span>
                    {ubah && !k.dimulai_pada && !ditutup && (
                      <button type="button" onClick={() => void aksiKelas('mulai', k)} disabled={!!sibukId}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[12.5px] font-bold disabled:opacity-50"><Play size={13} />Mulai sekarang</button>
                    )}
                    {ubah && k.dimulai_pada && !ditutup && (
                      <button type="button" onClick={() => setKonfirmasi({
                        message: `Akhiri "${k.judul}" sekarang?`, description: 'Peserta yang masih mengerjakan akan mengirim jawabannya otomatis.',
                        confirmLabel: 'Akhiri', danger: true, onConfirm: async () => { setKonfirmasi(null); await aksiKelas('akhiri', k); },
                      })} disabled={!!sibukId}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-[12.5px] font-bold disabled:opacity-50"><Square size={12} />Akhiri</button>
                    )}
                    {ubah && ditutup && (
                      <button type="button" onClick={() => void aksiKelas('buka_lagi', k)} disabled={!!sibukId}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-indigo-200 bg-white text-indigo-700 text-[12.5px] font-bold disabled:opacity-50"><RotateCcw size={13} />Buka lagi</button>
                    )}
                  </div>
                );
              })()}
              <p className="text-[12px] text-slate-500">
                {k.mode_mulai === 'admin' ? 'Dimulai admin · ' : ''}{k.question_ids.length} soal · {k.timer_menit ? `${k.timer_menit} mnt` : 'tanpa batas waktu'} · lulus ≥ {k.passing_grade} · maks {k.maks_peserta}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={tombol} onClick={() => void salin(k)} title="Salin link untuk customer"><Copy size={13} />Link</button>
                <button type="button" className={tombol} onClick={() => void bukaQr(k)} title="QR untuk dipindai customer"><QrCode size={13} />QR</button>
                <a className={tombol} href={`/kelas/${k.token}`} target="_blank" rel="noopener noreferrer" title="Buka halaman customer di domain ini"><ExternalLink size={13} />Uji</a>
                <button type="button" className={tombol} onClick={() => setHasil(k)}><BarChart3 size={13} />Hasil</button>
                {ubah && <button type="button" className={tombol} onClick={() => setForm(k)}><Pencil size={13} />Ubah</button>}
                {ubah && (
                  <button type="button" className={`${tombol} text-red-600`} aria-label={`Hapus ${k.judul}`} title="Hapus kelas"
                    onClick={() => setKonfirmasi({
                      message: `Hapus "${k.judul}"?`, description: `${k.jumlahPeserta} peserta beserta nilainya ikut terhapus permanen.`,
                      confirmLabel: 'Hapus', danger: true,
                      onConfirm: async () => { setKonfirmasi(null); const g = await panggil({ aksi: 'hapus', id: k.id }); if (g) setGalat(g); },
                    })}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              {k.jumlahPeserta > 0 && <p className="text-[11px] text-slate-400 flex items-center gap-1"><Users size={11} />dibuat {k.dibuat_nama ?? 'admin'}</p>}
            </section>
          );
        })}
      </div>

      {form && (
        <FormKelas awal={form === 'baru' ? null : form} onTutup={() => setForm(null)}
          onSimpan={async isian => {
            const g = await panggil({ aksi: 'simpan', ...(form !== 'baru' ? { id: form.id } : {}), ...isian });
            if (!g) { setForm(null); kabarkan(form === 'baru' ? 'Kelas dibuat. Salin link atau tampilkan QR untuk customer.' : 'Kelas disimpan.'); }
            return g;
          }} />
      )}
      {host && <LayarHost kelas={host} onTutup={() => { setHost(null); void muat(); }} onHasil={() => setHasil(host)} />}
      {hasil && <HasilKelas id={hasil.id} judul={hasil.judul} onTutup={() => setHasil(null)} />}
      {qr && (
        <Modal buka onTutup={() => setQr(null)} judul={qr.judul} ukuran="sm"
          footer={<TombolModal onClick={() => setQr(null)}>Tutup</TombolModal>}>
          <div className="text-center space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.gambar} alt={`QR ${qr.judul}`} width={260} height={260} className="mx-auto rounded-lg border border-slate-200" />
          </div>
        </Modal>
      )}
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </div>
  );
}

const LABEL_LIVE: Record<ReturnType<typeof statusLive>, string> = { buka: 'Dibuka', nonaktif: 'Nonaktif', selesai: 'Selesai', penuh: 'Penuh' };

/** Kartu Kuis Live: tombol utama membuka layar host (proyektor). */
function KartuLive({ k, ubah, onHost, onHasil, onUbah, onSalin, onQr, onHapus }: {
  k: Baris; ubah: boolean; onHost: () => void; onHasil: () => void; onUbah: () => void; onSalin: () => void; onQr: () => void; onHapus: () => void;
}) {
  const j = jadwalLive(k);
  const t = j.tahap;
  const st = statusLive(k, k.jumlahPeserta);
  const warna = k.tema_warna ?? WARNA_BAWAAN;
  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="relative h-20 px-4 py-3 flex items-start gap-2 text-white"
        style={{
          backgroundColor: warna,
          ...(k.latar_url ? { backgroundImage: `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.6)), url("${k.latar_url}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
        }}>
        {k.logo_url && (
          <span className="flex-shrink-0 rounded-lg bg-white/95 px-1.5 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={k.logo_url} alt="" className="h-7 w-auto max-w-[90px] object-contain" />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[10.5px] font-black uppercase tracking-[0.18em] text-white/80">Kuis Live</p>
          <h3 className="text-[14.5px] font-black leading-snug line-clamp-2">{k.judul}</h3>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-black/30 text-[11px] font-bold whitespace-nowrap">{LABEL_LIVE[st]}</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-50 py-2"><p className="text-[17px] font-extrabold tabular-nums text-slate-900">{k.jumlahPeserta}</p><p className="text-[10.5px] font-bold uppercase text-slate-500">Pemain</p></div>
          <div className="rounded-lg bg-slate-50 py-2"><p className="text-[17px] font-extrabold tabular-nums text-slate-900">{k.question_ids.length}</p><p className="text-[10.5px] font-bold uppercase text-slate-500">Soal</p></div>
          <div className="rounded-lg bg-slate-50 py-2"><p className="text-[17px] font-extrabold tabular-nums text-slate-900">{k.detik_per_soal}<span className="text-[11px]">dtk</span></p><p className="text-[10.5px] font-bold uppercase text-slate-500">Per soal</p></div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-2">
          <span className="flex-1 min-w-0 text-[12.5px] font-semibold text-violet-900 truncate">
            {labelTahap(t, j.indeks, t === 'lobi' ? k.question_ids.length : k.live_urutan.length)}{k.live_sesi > 0 ? ` · sesi ${k.live_sesi}` : ''}
          </span>
          {ubah && (
            <button type="button" onClick={onHost}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-[12.5px] font-bold" style={{ backgroundColor: warna }}>
              <MonitorPlay size={14} />{t === 'lobi' ? 'Buka layar host' : 'Lanjutkan host'}
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={tombol} onClick={onSalin} title="Salin link untuk peserta"><Copy size={13} />Link</button>
          <button type="button" className={tombol} onClick={onQr} title="QR untuk dipindai peserta"><QrCode size={13} />QR</button>
          <a className={tombol} href={`/kelas/${k.token}`} target="_blank" rel="noopener noreferrer" title="Buka halaman peserta"><ExternalLink size={13} />Uji</a>
          <button type="button" className={tombol} onClick={onHasil}><BarChart3 size={13} />Hasil</button>
          {ubah && <button type="button" className={tombol} onClick={onUbah}><Pencil size={13} />Ubah</button>}
          {ubah && <button type="button" className={`${tombol} text-red-600`} aria-label={`Hapus ${k.judul}`} title="Hapus" onClick={onHapus}><Trash2 size={13} /></button>}
        </div>
      </div>
    </section>
  );
}
