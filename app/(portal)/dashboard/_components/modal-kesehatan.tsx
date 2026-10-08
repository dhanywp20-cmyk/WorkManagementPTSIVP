'use client';
import { useCallback, useEffect, useState } from 'react';
import { BATAS_DB, BATAS_STORAGE, CRON_VERCEL, type DataKesehatan, type Peringatan } from '@/lib/kesehatan';

/**
 * Admin Panel -> Sistem -> Kesehatan Sistem. Satu layar untuk hal yang dulu hanya
 * kelihatan lewat SQL Editor / dashboard Vercel: apakah cron jalan, sisa kuota paket
 * Free, trigger/fungsi DB yang berisiko, pemakaian AI & WA. Hanya baca; data dari
 * /api/admin/kesehatan (admin saja).
 */

const mb = (b: number) => `${(b / 1024 / 1024).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;
const waktu = (iso: string | null | undefined) => (iso
  ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—');

function Bilah({ pakai, batas }: { pakai: number; batas: number }) {
  const p = Math.min(100, (pakai / batas) * 100);
  const warna = p > 95 ? 'bg-rose-600' : p > 80 ? 'bg-amber-500' : 'bg-emerald-600';
  return (
    <div className="mt-1.5">
      <div className="h-2 rounded-full bg-slate-200 overflow-hidden"><div className={`h-full ${warna}`} style={{ width: `${Math.max(1, p)}%` }} /></div>
      <p className="text-[11px] text-slate-500 mt-1">{mb(pakai)} dari {mb(batas)} ({p.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%)</p>
    </div>
  );
}

function Kartu({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">{judul}</h3>
      {children}
    </section>
  );
}

export function KesehatanInline() {
  const [data, setData] = useState<DataKesehatan | null>(null);
  const [peringatan, setPeringatan] = useState<Peringatan[]>([]);
  const [galat, setGalat] = useState('');
  const [memuat, setMemuat] = useState(true);

  const muat = useCallback(async () => {
    setMemuat(true); setGalat('');
    try {
      const r = await fetch('/api/admin/kesehatan', { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.alasan ?? `Gagal memuat (${r.status})`);
      setData(j.data); setPeringatan(j.peringatan ?? []);
    } catch (e) { setGalat((e as Error).message); }
    setMemuat(false);
  }, []);
  useEffect(() => { void muat(); }, [muat]);

  const s = data?.sistem;
  const totalStorage = s ? s.bucket.reduce((a, b) => a + b.bytes, 0) : 0;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[12.5px] text-slate-600">Pemeriksaan otomatis: cron, kuota paket Free, keamanan basis data, pemakaian AI & WA.</p>
        <button type="button" onClick={() => void muat()} disabled={memuat}
          className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {memuat ? 'Memeriksa...' : 'Periksa ulang'}
        </button>
      </div>

      {galat && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-800">{galat}</p>}

      {data && (
        peringatan.length === 0 ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] font-semibold text-emerald-800">Semua pemeriksaan normal.</p>
        ) : (
          <ul className="space-y-1.5">
            {peringatan.map((p, i) => (
              <li key={i} className={`rounded-xl border px-3 py-2 text-[12.5px] ${p.tingkat === 'merah' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                <b>{p.tingkat === 'merah' ? 'Perlu tindakan' : 'Perhatian'}:</b> {p.teks}
              </li>
            ))}
          </ul>
        )
      )}

      {data && (
        <div className="grid gap-3 md:grid-cols-2">
          <Kartu judul="Cron harian (Vercel)">
            <ul className="space-y-2">
              {CRON_VERCEL.map(c => {
                const j = data.cronVercel[c.nama];
                return (
                  <li key={c.nama} className="text-[12.5px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">{c.label}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${!j ? 'bg-slate-100 text-slate-600' : j.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {!j ? 'belum tercatat' : j.ok ? 'jalan' : 'gagal'}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-500">Jadwal {c.jadwal} · terakhir {waktu(j?.waktu)}{j?.ringkas ? ` · ${j.ringkas}` : ''}</p>
                  </li>
                );
              })}
            </ul>
          </Kartu>

          <Kartu judul="Kanal notifikasi & pemakaian">
            <ul className="text-[12.5px] space-y-1 text-slate-700">
              {data.kanal && Object.entries(data.kanal).map(([k, v]) => (
                <li key={k} className="flex justify-between"><span className="capitalize">{k.replace('_', '-')}</span><b className={v ? 'text-emerald-700' : 'text-slate-500'}>{v ? 'aktif' : 'mati'}</b></li>
              ))}
              <li className="flex justify-between border-t border-slate-100 pt-1 mt-1"><span>WA dikirim lewat tombol (24 jam)</span><b>{data.waJam24}</b></li>
              <li className="flex justify-between"><span>Pemakaian AI (24 jam / 7 hari)</span><b>{data.ai.jam24} / {data.ai.hari7}</b></li>
              <li className="flex justify-between"><span>APK Android terakhir</span><b>{data.apkTerakhir ? `${data.apkTerakhir.versi} · ${waktu(data.apkTerakhir.diunggah_pada)}` : 'belum ada'}</b></li>
            </ul>
          </Kartu>

          {s && (
            <Kartu judul="Basis data (paket Free 500 MB)">
              <Bilah pakai={s.db_bytes} batas={BATAS_DB} />
              <ul className="mt-2 text-[11.5px] text-slate-600 space-y-0.5">
                {s.tabel.slice(0, 5).map(t => <li key={t.nama} className="flex justify-between"><span>{t.nama}</span><span>{mb(t.bytes)} · {t.baris.toLocaleString('id-ID')} baris</span></li>)}
              </ul>
            </Kartu>
          )}
          {s && (
            <Kartu judul="Storage file (paket Free 1 GB)">
              <Bilah pakai={totalStorage} batas={BATAS_STORAGE} />
              <ul className="mt-2 text-[11.5px] text-slate-600 space-y-0.5">
                {s.bucket.map(b => <li key={b.bucket} className="flex justify-between"><span>{b.bucket}</span><span>{mb(b.bytes)} · {b.jumlah} berkas</span></li>)}
              </ul>
            </Kartu>
          )}
          {s && (
            <Kartu judul="Keamanan basis data">
              <ul className="text-[12.5px] space-y-1 text-slate-700">
                <li className="flex justify-between"><span>Fungsi berisi token/kunci tertulis</span><b className={s.fungsi_berahasia.length ? 'text-rose-700' : 'text-emerald-700'}>{s.fungsi_berahasia.length || 'tidak ada'}</b></li>
                <li className="flex justify-between"><span>Trigger yang memanggil HTTP keluar</span><b className={s.pemicu_http.length ? 'text-rose-700' : 'text-emerald-700'}>{s.pemicu_http.length || 'tidak ada'}</b></li>
                <li className="flex justify-between"><span>Kunci server (service role) di Vercel</span><b className={data.env.serviceRole ? 'text-emerald-700' : 'text-rose-700'}>{data.env.serviceRole ? 'terpasang' : 'belum'}</b></li>
              </ul>
            </Kartu>
          )}
          {s && (
            <Kartu judul="Jadwal pg_cron (basis data)">
              {s.cron.length === 0
                ? <p className="text-[12.5px] text-slate-600">Tidak ada jadwal. Pengingat WA lama di Ticketing tidak aktif - briefing pagi berjalan lewat cron Vercel di atas.</p>
                : <ul className="text-[12px] space-y-1">{s.cron.map(c => <li key={c.nama} className="flex justify-between gap-2"><span>{c.nama} <span className="text-slate-500">({c.jadwal})</span></span><b>{c.aktif ? (c.status ?? 'belum jalan') : 'nonaktif'}</b></li>)}</ul>}
            </Kartu>
          )}
        </div>
      )}
    </div>
  );
}
