'use client';

/**
 * Profil -> Keamanan & Sandi -> Verifikasi 2 langkah (2FA). Status & perubahan lewat /api/auth/2fa
 * (sesi cookie); rahasia & kode cadangan tidak pernah bisa dibaca ulang dari peramban.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { DaftarKodeCadangan, InputKode2FA, PanelDaftar2FA } from '@/components/shared/DuaFaktor';

interface Status { aktif: boolean; sisaCadangan: number; wajib: boolean; siap: boolean }

async function panggil(body?: Record<string, unknown>) {
  try {
    const res = await fetch('/api/auth/2fa', body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { cache: 'no-store' });
    return { ok: res.ok, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  } catch { return { ok: false, data: { error: 'Koneksi gagal.' } as Record<string, unknown> }; }
}

export function Profil2FA() {
  const [status, setStatus] = useState<Status | null>(null);
  const [mode, setMode] = useState<'diam' | 'daftar' | 'matikan' | 'cadangan'>('diam');
  const [cadanganBaru, setCadanganBaru] = useState<string[] | null>(null);
  const [kode, setKode] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    const r = await panggil();
    if (r.ok) setStatus(r.data as unknown as Status);
  }, []);
  useEffect(() => {
    let batal = false;
    panggil().then(r => { if (!batal && r.ok) setStatus(r.data as unknown as Status); });
    return () => { batal = true; };
  }, []);

  if (!status?.siap) return null;

  const tutup = () => { setMode('diam'); setKode(''); setGalat(''); };

  const kirimKode = async () => {
    if (kode.length !== 6 || sibuk) return;
    setSibuk(true); setGalat('');
    const r = await panggil({ aksi: mode, kode });
    setSibuk(false);
    if (!r.ok) { setGalat(String(r.data.error || 'Gagal.')); setKode(''); return; }
    if (Array.isArray(r.data.cadangan)) setCadanganBaru(r.data.cadangan as string[]);
    tutup(); muat();
  };

  return (
    <div className="pt-3 border-t border-slate-100 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500" title="Kode dari aplikasi authenticator di HP setiap login">
          Verifikasi 2 Langkah
        </span>
        {status.aktif
          ? <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-sm"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Aktif</span>
          : <span className="text-slate-400 font-bold text-sm">Mati</span>}
      </div>

      {cadanganBaru ? (
        <DaftarKodeCadangan kode={cadanganBaru} onSelesai={() => setCadanganBaru(null)} labelSelesai="Selesai" />
      ) : mode === 'daftar' ? (
        <PanelDaftar2FA
          mintaRahasia={async () => {
            const r = await panggil({ aksi: 'mulai' });
            return r.ok ? (r.data as { rahasia: string; url: string }) : { error: String(r.data.error || 'Gagal memulai.') };
          }}
          kirimKode={async k => {
            const r = await panggil({ aksi: 'aktifkan', kode: k });
            if (!r.ok) return String(r.data.error || 'Kode salah.');
            setCadanganBaru(r.data.cadangan as string[]);
            tutup(); muat();
            return null;
          }}
          onBatal={tutup}
        />
      ) : mode !== 'diam' ? (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-600 text-center">
            {mode === 'matikan' ? 'Kode authenticator untuk mematikan' : 'Kode authenticator untuk kode cadangan baru'}
          </p>
          <InputKode2FA nilai={kode} ubah={setKode} kirim={kirimKode} />
          {galat && <p className="px-3 py-2 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-200">{galat}</p>}
          <div className="flex gap-2">
            <button onClick={kirimKode} disabled={kode.length !== 6 || sibuk}
              className={`flex-1 py-2 text-white text-xs font-bold rounded-lg disabled:opacity-40 ${mode === 'matikan' ? 'bg-red-600' : 'bg-slate-800'}`}>
              {mode === 'matikan' ? 'Matikan' : 'Buat ulang'}
            </button>
            <button onClick={tutup} className="px-3 py-2 bg-slate-100 text-slate-500 text-xs font-bold rounded-lg">Batal</button>
          </div>
        </div>
      ) : status.aktif ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-semibold ${status.sisaCadangan <= 2 ? 'text-amber-700' : 'text-slate-500'}`}>
            {status.sisaCadangan} kode cadangan tersisa
          </span>
          <span className="flex-1" />
          <button onClick={() => setMode('cadangan')} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">
            Kode cadangan baru
          </button>
          {!status.wajib && (
            <button onClick={() => setMode('matikan')} className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-bold text-red-600 hover:bg-red-50">
              Matikan
            </button>
          )}
        </div>
      ) : (
        <button onClick={() => setMode('daftar')}
          className="w-full py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
          Aktifkan 2FA
        </button>
      )}
    </div>
  );
}
