'use client';
/** Admin Panel → Product Comparison: siapa unduh langsung, siapa verifikator, Loloskan semua, lama simpan. */
import { useEffect, useState } from 'react';
import { muatKelompok, semuaKelompok } from '@/lib/kelompok';
import { ATURAN_BAWAAN, type AturanPerbandingan, JABATAN_PILIHAN, ROLE_PILIHAN } from '@/lib/perbandingan-aturan';

const LABEL_ROLE: Record<string, string> = { admin: 'Admin', superadmin: 'Superadmin', team: 'Team', team_pts: 'Team PTS', guest: 'Sales / Marketing (guest)' };
const API = '/api/tools-team/perbandingan/aturan';

function Centang({ daftar, pilihan, label, ubah, kunci = [] }: { daftar: string[]; pilihan: string[]; label: (v: string) => string; ubah: (v: string[]) => void; kunci?: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {daftar.map(v => {
        const on = pilihan.includes(v) || kunci.includes(v);
        return (
          <label key={v} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12.5px] font-semibold ${on ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white border-slate-200 text-slate-600'} ${kunci.includes(v) ? 'opacity-70' : 'cursor-pointer'}`}>
            <input type="checkbox" className="w-3.5 h-3.5" checked={on} disabled={kunci.includes(v)} onChange={e => ubah(e.target.checked ? [...pilihan, v] : pilihan.filter(x => x !== v))} />
            {label(v)}
          </label>
        );
      })}
    </div>
  );
}

export function AturanPerbandinganInline() {
  const [a, setA] = useState<AturanPerbandingan | null>(null);
  const [tim, setTim] = useState<string[]>([]);
  const [pesan, setPesan] = useState<{ t: string; galat?: boolean } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  useEffect(() => {
    void (async () => {
      try {
        await muatKelompok();
        setTim(semuaKelompok().map(k => k.nama).filter(Boolean));
        const r = await fetch(API, { credentials: 'include', cache: 'no-store' });
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j?.alasan ?? 'Gagal memuat.');
        setA(j.aturan);
      } catch (e) { setPesan({ t: (e as Error).message, galat: true }); setA(ATURAN_BAWAAN); }
    })();
  }, []);
  if (!a) return <p className="p-4 text-sm text-slate-500">Memuat…</p>;
  const set = (x: Partial<AturanPerbandingan>) => setA({ ...a, ...x });
  const simpan = async () => {
    setSibuk(true); setPesan(null);
    try {
      const r = await fetch(API, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j?.alasan ?? 'Gagal menyimpan.');
      setA(j.aturan); setPesan({ t: 'Tersimpan - berlaku seketika.' });
    } catch (e) { setPesan({ t: (e as Error).message, galat: true }); } finally { setSibuk(false); }
  };
  const judul = 'text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5';
  return (
    <div className="p-4 space-y-5 max-w-3xl">
      <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <span><span className="block text-[14px] font-bold text-slate-900">Wajib verifikasi</span>
          <span className="block text-[12px] text-slate-500">PDF dari akun di luar daftar "Unduh langsung" harus disetujui verifikator dulu</span></span>
        <input type="checkbox" className="w-5 h-5" checked={a.wajibVerifikasi} onChange={e => set({ wajibVerifikasi: e.target.checked })} />
      </label>
      <div>
        <p className={judul}>Unduh langsung (orang produk)</p>
        <Centang daftar={ROLE_PILIHAN} pilihan={a.langsungRole} label={v => LABEL_ROLE[v] ?? v} ubah={v => set({ langsungRole: v })} />
      </div>
      <div className="space-y-2.5">
        <p className={judul}>Verifikator</p>
        <Centang daftar={ROLE_PILIHAN.filter(r => r !== 'guest')} pilihan={a.verifikatorRole} kunci={['admin']} label={v => `Semua ${LABEL_ROLE[v] ?? v}`} ubah={v => set({ verifikatorRole: v })} />
        <p className="text-[12px] font-semibold text-slate-600">atau anggota kelompok…</p>
        <Centang daftar={[...new Set([...tim, ...a.verifikatorTim])]} pilihan={a.verifikatorTim} label={v => v} ubah={v => set({ verifikatorTim: v })} />
        <p className="text-[12px] font-semibold text-slate-600">…dengan jabatan</p>
        <Centang daftar={JABATAN_PILIHAN} pilihan={a.verifikatorJabatan} label={v => v} ubah={v => set({ verifikatorJabatan: v })} />
      </div>
      <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <span><span className="block text-[14px] font-bold text-slate-900">Izinkan &quot;Loloskan semua&quot;</span>
          <span className="block text-[12px] text-slate-500">Verifikator & pengunduh langsung bisa menyelesaikan semua nilai &quot;cek&quot; sekaligus</span></span>
        <input type="checkbox" className="w-5 h-5" checked={a.lolosSemua} onChange={e => set({ lolosSemua: e.target.checked })} />
      </label>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <label className="text-[12.5px] font-semibold text-slate-700">Simpan pengajuan (hari)
          <input type="number" min={1} max={365} value={a.simpanHari} onChange={e => set({ simpanHari: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-base sm:text-sm" /></label>
        <label className="text-[12.5px] font-semibold text-slate-700">Maks menunggu / orang
          <input type="number" min={1} max={100} value={a.maksMenunggu} onChange={e => set({ maksMenunggu: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-base sm:text-sm" /></label>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => void simpan()} disabled={sibuk} className="px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60">{sibuk ? 'Menyimpan…' : 'Simpan'}</button>
        <button type="button" onClick={() => setA(ATURAN_BAWAAN)} className="px-3 py-2 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-100">Bawaan</button>
        {pesan && <span className={`text-[13px] font-semibold ${pesan.galat ? 'text-rose-700' : 'text-emerald-700'}`}>{pesan.t}</span>}
      </div>
    </div>
  );
}
