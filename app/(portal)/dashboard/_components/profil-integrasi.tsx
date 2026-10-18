'use client';

/**
 * Profil -> Keamanan & Sandi -> Integrasi DIWAYPI. Token pribadi untuk asisten desktop DIWAYPI:
 * dibuat & dicabut lewat /api/integrasi/token (sesi cookie). Nilai token hanya tampil SEKALI
 * saat dibuat - setelah itu yang terlihat cuma 4 huruf terakhirnya.
 */
import React, { useCallback, useEffect, useState } from 'react';

interface Token { id: string; nama: string; akhiran: string; cakupan: string[]; dibuat: string; terakhir_dipakai: string | null; dicabut: string | null }

const tgl = (s: string | null) => s ? new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'belum pernah';

export function ProfilIntegrasi() {
  const [daftar, setDaftar] = useState<Token[] | null>(null);
  const [buka, setBuka] = useState(false);
  const [tulis, setTulis] = useState(true);
  const [baru, setBaru] = useState<string | null>(null);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [tersalin, setTersalin] = useState(false);

  const muat = useCallback(async () => {
    try {
      const r = await fetch('/api/integrasi/token', { cache: 'no-store' });
      if (r.ok) setDaftar(((await r.json()) as { token: Token[] }).token);
    } catch { /* kartu tetap tampil tanpa daftar */ }
  }, []);
  useEffect(() => {
    let batal = false;
    fetch('/api/integrasi/token', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (!batal && j) setDaftar((j as { token: Token[] }).token); })
      .catch(() => {});
    return () => { batal = true; };
  }, []);

  const buat = async () => {
    if (sibuk) return;
    setSibuk(true); setGalat('');
    try {
      const r = await fetch('/api/integrasi/token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama: 'DIWAYPI', tulis }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setGalat(String((j as { error?: string }).error || 'Gagal membuat token.'));
      else { setBaru(String((j as { token: string }).token)); setBuka(false); muat(); }
    } catch { setGalat('Koneksi gagal.'); }
    setSibuk(false);
  };

  const cabut = async (id: string) => {
    if (!window.confirm('Cabut token ini? DIWAYPI yang memakainya langsung kehilangan akses.')) return;
    await fetch(`/api/integrasi/token?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    muat();
  };

  const salin = async () => {
    if (!baru) return;
    try { await navigator.clipboard.writeText(baru); setTersalin(true); setTimeout(() => setTersalin(false), 2000); } catch { /* pilih manual */ }
  };

  const aktif = (daftar ?? []).filter(t => !t.dicabut);

  return (
    <div className="pt-3 border-t border-slate-100 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500"
          title="Asisten desktop DIWAYPI bertindak sebagai akun Anda, dengan hak yang sama persis">
          Integrasi DIWAYPI
        </span>
        {aktif.length
          ? <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-sm"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{aktif.length} token aktif</span>
          : <span className="text-slate-500 text-sm">Belum terhubung</span>}
      </div>

      {baru && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
          <p className="text-sm font-semibold text-amber-900">Salin token ini sekarang - tidak akan ditampilkan lagi.</p>
          <code className="block break-all rounded-lg bg-white border border-amber-200 px-2 py-1.5 text-xs text-slate-800 select-all">{baru}</code>
          <div className="flex gap-2">
            <button type="button" onClick={salin} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-semibold">{tersalin ? 'Tersalin' : 'Salin'}</button>
            <button type="button" onClick={() => setBaru(null)} className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-900 text-sm">Sudah saya simpan</button>
          </div>
          <p className="text-xs text-amber-800">Tempel di DIWAYPI: Sentinel &gt; Work Management &gt; Token integrasi.</p>
        </div>
      )}

      {aktif.length > 0 && (
        <ul className="space-y-1.5">
          {aktif.map(t => (
            <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="min-w-0">
                <b className="text-slate-800">{t.nama}</b> <span className="text-slate-500">…{t.akhiran}</span>
                <span className="block text-xs text-slate-500">
                  {t.cakupan.includes('tulis') ? 'Baca & ubah data' : 'Hanya baca'} · dipakai {tgl(t.terakhir_dipakai)}
                </span>
              </span>
              <button type="button" onClick={() => cabut(t.id)} className="shrink-0 px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-50">Cabut</button>
            </li>
          ))}
        </ul>
      )}

      {buka ? (
        <div className="rounded-xl border border-slate-200 p-3 space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={tulis} onChange={e => setTulis(e.target.checked)} className="mt-1" />
            <span>Izinkan mengubah data: catatan & status tiket, daily report, centang checklist project.
              <span className="block text-xs text-slate-500">Tanpa ini DIWAYPI hanya bisa membaca. Semua aksi tercatat di audit trail.</span></span>
          </label>
          {galat && <p className="text-rose-600 text-xs">{galat}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={sibuk} onClick={buat} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold disabled:opacity-60">{sibuk ? 'Membuat…' : 'Buat token'}</button>
            <button type="button" onClick={() => { setBuka(false); setGalat(''); }} className="px-3 py-1.5 rounded-lg border border-slate-200">Batal</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setBuka(true)}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          + Hubungkan DIWAYPI
        </button>
      )}
    </div>
  );
}
