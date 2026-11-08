'use client';
import React, { useEffect, useState } from 'react';
import { LABEL_ALASAN, MENU_PRO, type StatusLisensi } from '@/lib/lisensi/inti';
import { muatLisensi } from '@/components/shared/Lisensi';

interface CatatanTerbit {
  id: string; pelanggan: string; edisi: string; domain: string[]; terbit: string; kedaluwarsa: string | null; oleh: string; kunci: string; catatan: string;
}
interface DataLisensi { status: StatusLisensi; manager: boolean; kunciPrivat: boolean; terbit: CatatanTerbit[] }

const NAMA_MENU_PRO: Record<string, string> = { 'tools-team': 'AV Solution Tools', 'learning-center': 'Learning Center', 'incentive-pts': 'Incentive PTS' };
const kelasInput = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200';
const tanggal = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Seumur hidup');

function Baris({ label, isi }: { label: string; isi: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0 text-sm">
      <span className="text-slate-500">{label}</span><span className="font-semibold text-slate-800 text-right">{isi}</span>
    </div>
  );
}

function TombolSalinKunci({ kunci }: { kunci: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" onClick={() => navigator.clipboard.writeText(kunci).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => {})}
      className="px-2.5 py-1 rounded-md text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">{ok ? 'Tersalin' : 'Salin kunci'}</button>
  );
}

function FormTerbit({ onTerbit }: { onTerbit: (c: CatatanTerbit) => void }) {
  const [pelanggan, setPelanggan] = useState('');
  const [edisi, setEdisi] = useState<'lite' | 'pro'>('pro');
  const [domain, setDomain] = useState('');
  const [seumurHidup, setSeumurHidup] = useState(false);
  const [kedaluwarsa, setKedaluwarsa] = useState('');
  const [catatan, setCatatan] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<{ galat: boolean; teks: string } | null>(null);
  const terbitkan = async () => {
    setSibuk(true); setPesan(null);
    try {
      const r = await fetch('/api/admin/lisensi', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pelanggan, edisi, domain: domain.split(/[\s,]+/), kedaluwarsa: seumurHidup ? null : kedaluwarsa, catatan }),
      });
      const j = await r.json();
      if (!j.ok) { setPesan({ galat: true, teks: j.alasan ?? 'Gagal membuat kunci.' }); return; }
      onTerbit(j.catatan); setPesan({ galat: false, teks: `Kunci untuk ${j.catatan.pelanggan} dibuat. Salin dari daftar di bawah.` });
      setPelanggan(''); setDomain(''); setCatatan('');
    } catch {
      setPesan({ galat: true, teks: 'Gagal terhubung ke server.' });
    } finally { setSibuk(false); }
  };
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
      <p className="text-sm font-bold text-indigo-900">Terbitkan lisensi baru</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold text-slate-600">Nama pelanggan
          <input className={`${kelasInput} mt-1`} value={pelanggan} onChange={e => setPelanggan(e.target.value)} placeholder="PT Contoh Sejahtera" /></label>
        <div className="text-xs font-bold text-slate-600">Edisi
          <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {(['lite', 'pro'] as const).map(e => (
              <button key={e} type="button" onClick={() => setEdisi(e)} aria-pressed={edisi === e}
                className={`py-1.5 rounded-md text-sm font-bold ${edisi === e ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}>{e === 'pro' ? 'Pro' : 'Lite'}</button>
            ))}
          </div>
        </div>
        <label className="block text-xs font-bold text-slate-600 sm:col-span-2">Domain server pelanggan (satu per baris, kosong = semua domain)
          <textarea className={`${kelasInput} mt-1 font-mono`} rows={2} value={domain} onChange={e => setDomain(e.target.value)} placeholder={'wm.perusahaan.com\n192.168.1.20'} /></label>
        <div className="text-xs font-bold text-slate-600">Kedaluwarsa
          <div className="mt-1 flex items-center gap-2">
            <input type="date" className={kelasInput} value={kedaluwarsa} disabled={seumurHidup} onChange={e => setKedaluwarsa(e.target.value)} />
            <label className="flex items-center gap-1.5 whitespace-nowrap font-semibold text-slate-700"><input type="checkbox" checked={seumurHidup} onChange={e => setSeumurHidup(e.target.checked)} /> Seumur hidup</label>
          </div>
        </div>
        <label className="block text-xs font-bold text-slate-600">Catatan (opsional)
          <input className={`${kelasInput} mt-1`} value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="No. kontrak / invoice" /></label>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" disabled={sibuk || pelanggan.trim().length < 2 || (!seumurHidup && !kedaluwarsa)} onClick={terbitkan}
          className="px-4 py-2 rounded-lg bg-indigo-700 text-white text-sm font-bold hover:bg-indigo-800 disabled:opacity-50">{sibuk ? 'Membuat...' : 'Terbitkan kunci'}</button>
        {pesan && <span className={`text-sm font-semibold ${pesan.galat ? 'text-rose-700' : 'text-emerald-700'}`}>{pesan.teks}</span>}
      </div>
    </div>
  );
}

export function LisensiInline() {
  const [data, setData] = useState<DataLisensi | null>(null);
  const [galat, setGalat] = useState('');
  useEffect(() => {
    fetch('/api/admin/lisensi', { cache: 'no-store' }).then(r => r.json())
      .then(j => (j.ok ? setData(j) : setGalat(j.alasan ?? 'Status lisensi tidak terbaca.')))
      .catch(() => setGalat('Status lisensi tidak terbaca.'));
    muatLisensi(true);
  }, []);
  if (galat) return <p className="text-sm text-rose-700">{galat}</p>;
  if (!data) return <p className="text-sm text-slate-500">Memuat status lisensi...</p>;
  const s = data.status;
  return (
    <div className="space-y-5 max-w-4xl">
      <div className={`rounded-xl border p-4 ${s.sah ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/60'}`}>
        <p className={`text-base font-extrabold ${s.sah ? 'text-emerald-800' : 'text-rose-800'}`}>
          {s.pengembangan ? 'Mode pengembangan (tanpa kunci)' : s.sah ? `Lisensi aktif · Edisi ${s.edisi === 'pro' ? 'Pro' : 'Lite'}` : 'Lisensi tidak aktif'}
        </p>
        {!s.sah && s.alasan && <p className="text-sm text-rose-700 mt-0.5">{LABEL_ALASAN[s.alasan]}.</p>}
        <div className="mt-3">
          <Baris label="Pelanggan" isi={s.pelanggan ?? '-'} />
          <Baris label="Berlaku sampai" isi={s.kedaluwarsa ? `${tanggal(s.kedaluwarsa)}${s.sisaHari !== null && s.sisaHari >= 0 ? ` (${s.sisaHari} hari lagi)` : ''}` : s.sah ? 'Seumur hidup' : '-'} />
          <Baris label="Domain" isi={s.domain.length ? s.domain.join(', ') : 'Semua domain'} />
          <Baris label="Menu Pro" isi={MENU_PRO.map(k => NAMA_MENU_PRO[k]).join(', ') + (s.edisi === 'pro' ? ' · aktif' : ' · tidak termasuk')} />
          {s.id && <Baris label="ID lisensi" isi={<span className="font-mono text-xs">{s.id}</span>} />}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 space-y-1.5">
        <p className="font-bold text-slate-800">Memasang atau memperbarui kunci</p>
        <p>Isi environment variable <code className="px-1 rounded bg-slate-100">LISENSI_KUNCI</code> dengan kunci dari penyedia platform, lalu deploy ulang (Vercel) atau jalankan ulang server (lokal).
          Panduan lengkap ada di file master: <code className="px-1 rounded bg-slate-100">PANDUAN/03-LISENSI.md</code>.</p>
      </div>
      {data.manager && (
        <div className="space-y-4">
          <div>
            <p className="text-base font-extrabold text-slate-800">License Manager</p>
            <p className="text-sm text-slate-500">Hanya tampil di server pemilik. Kunci ditandatangani dengan kunci privat server ini.</p>
          </div>
          {data.kunciPrivat
            ? <FormTerbit onTerbit={c => setData(d => (d ? { ...d, terbit: [c, ...d.terbit] } : d))} />
            : <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Isi <code>LISENSI_KUNCI_PRIVAT</code> di environment server pemilik lalu deploy ulang untuk menerbitkan kunci.</p>}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600"><tr>
                <th className="text-left font-bold px-3 py-2">Pelanggan</th><th className="text-left font-bold px-3 py-2">Edisi</th>
                <th className="text-left font-bold px-3 py-2">Domain</th><th className="text-left font-bold px-3 py-2">Terbit</th>
                <th className="text-left font-bold px-3 py-2">Berlaku sampai</th><th className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {data.terbit.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-500">Belum ada lisensi yang diterbitkan.</td></tr>}
                {data.terbit.map(c => (
                  <tr key={c.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2"><b className="text-slate-800">{c.pelanggan}</b>{c.catatan && <span className="block text-xs text-slate-500">{c.catatan}</span>}</td>
                    <td className="px-3 py-2">{c.edisi === 'pro' ? 'Pro' : 'Lite'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{c.domain.length ? c.domain.join(', ') : 'Semua'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{tanggal(c.terbit)}<span className="block text-xs text-slate-500">{c.oleh}</span></td>
                    <td className="px-3 py-2 whitespace-nowrap">{tanggal(c.kedaluwarsa)}</td>
                    <td className="px-3 py-2 text-right"><TombolSalinKunci kunci={c.kunci} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
