'use client';

/**
 * Analytics -> tab Pemakaian: siapa membuka menu apa (GET /api/pemakaian, admin & Full Access).
 * Satu ukuran per bar (pengguna unik, satu warna merek) - rincian per kelompok ditulis sebagai
 * angka, bukan warna, jadi identitas tidak pernah bergantung pada warna. Tabelnya sendiri adalah
 * tampilan data (tidak ada grafik tanpa angka).
 */
import { useEffect, useState } from 'react';
import { StatCard } from '@/components/shared';
import { DAFTAR_MENU } from '@/app/(portal)/_kerangka/daftar-menu';
import { LABEL_KELOMPOK, URUTAN_KELOMPOK, type RingkasPemakaian } from '@/lib/pemakaian';

type Data = RingkasPemakaian & { hari: number; mulaiDicatat: string | null };

const NAMA_MODUL: Record<string, string> = Object.fromEntries([
  ['dashboard', 'Dashboard'],
  ...DAFTAR_MENU.flatMap(m => m.items.filter(i => i.internal).map(i => [i.url.replace(/^\//, ''), i.name])),
]);
const NAMA_ALAT: Record<string, string> = {
  '3d': 'Desain 3D Ruang', led: 'LED Videotron', av: 'Kalkulator AV', banding: 'Product Comparison', pustaka: 'Pustaka',
};
const tgl = (s: string | null) => s ? new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const KARTU = 'rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden';
const JUDUL = 'text-xs font-bold text-slate-500 uppercase tracking-widest';

/** Bar tipis satu warna, ujung data membulat; lebar relatif terhadap nilai terbesar. */
function Bar({ nilai, maks, ket }: { nilai: number; maks: number; ket: string }) {
  const lebar = maks > 0 ? Math.max(nilai > 0 ? 2 : 0, (nilai / maks) * 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-slate-100" title={ket}>
      <div className="h-2 rounded-full" style={{ width: `${lebar}%`, background: 'var(--merek-utama, #b91c1c)' }} />
    </div>
  );
}

export function PanelPemakaian() {
  const [hari, setHari] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState('');
  const [muat, setMuat] = useState(true);

  useEffect(() => {
    let batal = false;
    fetch(`/api/pemakaian?hari=${hari}`, { cache: 'no-store' })
      .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j as { error?: string }).error || 'Gagal memuat.'); return j as Data; })
      .then(j => { if (!batal) setData(j); })
      .catch(e => { if (!batal) setGalat(e instanceof Error ? e.message : 'Gagal memuat.'); })
      .finally(() => { if (!batal) setMuat(false); });
    return () => { batal = true; };
  }, [hari]);
  const gantiHari = (h: number) => { if (h === hari) return; setHari(h); setMuat(true); setGalat(''); };

  const maksModul = Math.max(0, ...(data?.modul ?? []).map(m => m.pengguna));
  const maksAlat = Math.max(0, ...(data?.alat ?? []).map(a => a.pengguna));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={JUDUL}>Rentang</span>
        {[7, 30, 90].map(h => (
          <button key={h} type="button" onClick={() => gantiHari(h)} aria-pressed={hari === h}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${hari === h ? 'tombol-utama border-transparent' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {h} hari
          </button>
        ))}
        {data?.mulaiDicatat && <span className="text-xs text-slate-500 ml-auto">Dicatat sejak {tgl(data.mulaiDicatat)}</span>}
      </div>

      {galat && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{galat}</div>}
      {muat && !data && <div className="flex justify-center py-16"><div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-slate-500 animate-spin" /></div>}

      {data && (
        <>
          {!data.mulaiDicatat && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Belum ada catatan. Pemakaian mulai tercatat sejak fitur ini aktif - angka di bawah terisi seiring tim, marketing & sales membuka menu.
            </div>
          )}

          {/* Jangkauan: berapa akun tiap kelompok yang membuka platform dalam rentang ini. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {URUTAN_KELOMPOK.map(k => (
              <StatCard key={k} label={LABEL_KELOMPOK[k]} value={`${data.jangkauan[k].aktif} / ${data.jangkauan[k].total}`}
                sub="akun membuka platform" accent="var(--merek-utama, #b91c1c)" />
            ))}
          </div>

          <div className={KARTU}>
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <span className={JUDUL}>Menu · pengguna unik</span>
              <span className="text-xs text-slate-500">{data.hari} hari terakhir</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    <th className="text-left font-bold px-5 py-2">Menu</th>
                    <th className="text-left font-bold px-2 py-2 w-[28%] min-w-[120px]">Pengguna</th>
                    {URUTAN_KELOMPOK.map(k => <th key={k} className="text-right font-bold px-2 py-2 whitespace-nowrap">{LABEL_KELOMPOK[k]}</th>)}
                    <th className="text-right font-bold px-2 py-2">Dibuka</th>
                    <th className="text-right font-bold px-5 py-2 whitespace-nowrap">Terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {data.modul.map(m => (
                    <tr key={m.modul} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-2 font-semibold text-slate-800 whitespace-nowrap">{NAMA_MODUL[m.modul] ?? m.modul}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-bold text-slate-800 w-7 text-right">{m.pengguna}</span>
                          <Bar nilai={m.pengguna} maks={maksModul} ket={`${NAMA_MODUL[m.modul] ?? m.modul}: ${m.pengguna} pengguna, dibuka ${m.kunjungan}×`} />
                        </div>
                      </td>
                      {URUTAN_KELOMPOK.map(k => <td key={k} className="px-2 py-2 text-right tabular-nums text-slate-600">{m.perKelompok[k] || '—'}</td>)}
                      <td className="px-2 py-2 text-right tabular-nums text-slate-600">{m.kunjungan}</td>
                      <td className="px-5 py-2 text-right text-slate-500 whitespace-nowrap">{tgl(m.terakhir)}</td>
                    </tr>
                  ))}
                  {data.tidakDibuka.map(k => (
                    <tr key={k} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-2 font-semibold text-slate-400 whitespace-nowrap">{NAMA_MODUL[k] ?? k}</td>
                      <td className="px-2 py-2 text-slate-400 text-xs" colSpan={URUTAN_KELOMPOK.length + 3}>Tidak dibuka dalam rentang ini</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={KARTU}>
              <div className="px-5 py-3 border-b border-slate-100"><span className={JUDUL}>AV Solution Tools · per alat</span></div>
              <ul className="px-5 py-3 space-y-2.5">
                {data.alat.map(a => (
                  <li key={a.sub} className="grid grid-cols-[minmax(0,10rem)_2rem_1fr_auto] items-center gap-2 text-sm">
                    <span className="font-semibold text-slate-800 truncate">{NAMA_ALAT[a.sub] ?? a.sub}</span>
                    <span className="tabular-nums font-bold text-slate-800 text-right">{a.pengguna}</span>
                    <Bar nilai={a.pengguna} maks={maksAlat} ket={`${NAMA_ALAT[a.sub] ?? a.sub}: ${a.pengguna} pengguna, dibuka ${a.kunjungan}×`} />
                    <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">{a.kunjungan}× dibuka</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={KARTU}>
              <div className="px-5 py-3 border-b border-slate-100"><span className={JUDUL}>Akun paling aktif</span></div>
              {data.teraktif.length === 0
                ? <p className="px-5 py-4 text-sm text-slate-500">Belum ada.</p>
                : (
                  <ol className="px-5 py-3 space-y-2">
                    {data.teraktif.map((u, i) => (
                      <li key={`${u.nama}-${i}`} className="flex items-center gap-3 text-sm">
                        <span className="w-5 text-right tabular-nums text-slate-400">{i + 1}</span>
                        <span className="flex-1 min-w-0 truncate font-semibold text-slate-800">{u.nama}</span>
                        <span className="text-[11px] text-slate-500 whitespace-nowrap">{LABEL_KELOMPOK[u.kelompok]}</span>
                        <span className="tabular-nums text-slate-600 whitespace-nowrap">{u.kunjungan}× · {u.modul} menu</span>
                      </li>
                    ))}
                  </ol>
                )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
