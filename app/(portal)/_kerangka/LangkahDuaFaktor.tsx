'use client';

/**
 * Langkah kedua login (2FA). Muncul di kartu login sesudah password benar bila server menjawab
 * `tahap`: 'kode_2fa' (akun ber-2FA) atau 'daftar_2fa' (admin wajib 2FA tapi belum mendaftar).
 * Tiket `tantangan` berlaku 5 menit; sesudah itu kembali ke password.
 */
import React, { useState } from 'react';
import { DaftarKodeCadangan, InputKode2FA, PanelDaftar2FA } from '@/components/shared/DuaFaktor';

export interface HasilMasuk { user: Record<string, unknown>; db_token?: string | null; cadangan?: string[]; sisa_cadangan?: number }

async function kirim(body: Record<string, unknown>): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch('/api/auth/login-2fa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  } catch { return { ok: false, data: { error: 'Koneksi gagal. Coba lagi.' } }; }
}

export function LangkahDuaFaktor({ tahap, tantangan, onBerhasil, onBatal }: {
  tahap: 'kode_2fa' | 'daftar_2fa'; tantangan: string;
  onBerhasil: (hasil: HasilMasuk) => void; onBatal: () => void;
}) {
  const [kode, setKode] = useState('');
  const [pakaiCadangan, setPakaiCadangan] = useState(false);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [hasilDaftar, setHasilDaftar] = useState<HasilMasuk | null>(null);

  const kirimKode = async () => {
    const siap = pakaiCadangan ? kode.replace(/[^A-Z0-9]/g, '').length === 8 : kode.length === 6;
    if (!siap || sibuk) return;
    setSibuk(true); setGalat('');
    const r = await kirim({ tantangan, kode });
    setSibuk(false);
    if (!r.ok || !r.data.user) { setGalat(String(r.data.error || 'Kode salah.')); setKode(''); return; }
    onBerhasil(r.data as unknown as HasilMasuk);
  };

  if (tahap === 'daftar_2fa') {
    if (hasilDaftar?.cadangan) {
      return <DaftarKodeCadangan kode={hasilDaftar.cadangan} onSelesai={() => onBerhasil(hasilDaftar)} labelSelesai="Masuk" />;
    }
    return (
      <div className="space-y-3">
        <p className="text-sm font-bold text-slate-700 text-center">Aktifkan 2FA untuk akun admin</p>
        <PanelDaftar2FA
          mintaRahasia={async () => {
            const r = await kirim({ tantangan, aksi: 'mulai' });
            return r.ok ? (r.data as { rahasia: string; url: string }) : { error: String(r.data.error || 'Gagal memulai.') };
          }}
          kirimKode={async k => {
            const r = await kirim({ tantangan, aksi: 'aktifkan', kode: k });
            if (!r.ok || !r.data.user) return String(r.data.error || 'Kode salah.');
            setHasilDaftar(r.data as unknown as HasilMasuk);
            return null;
          }}
          onBatal={onBatal}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm font-bold text-slate-700">{pakaiCadangan ? 'Kode cadangan' : 'Kode authenticator'}</p>
      </div>
      <InputKode2FA key={String(pakaiCadangan)} nilai={kode} ubah={setKode} kirim={kirimKode} cadangan={pakaiCadangan} />
      {galat && <div className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-200">{galat}</div>}
      <button type="button" onClick={kirimKode} disabled={sibuk}
        className="w-full text-white py-3.5 rounded-xl font-bold shadow-lg text-sm bg-slate-800 hover:bg-slate-700 disabled:opacity-60">
        {sibuk ? 'Memverifikasi…' : 'Verifikasi'}
      </button>
      <p className="text-center text-xs text-slate-500">
        <button type="button" onClick={() => { setPakaiCadangan(v => !v); setKode(''); setGalat(''); }} className="font-bold hover:underline">
          {pakaiCadangan ? 'Pakai authenticator' : 'Pakai kode cadangan'}
        </button>
        <span className="mx-2 text-slate-400">|</span>
        <button type="button" onClick={onBatal} className="font-bold hover:underline">Kembali</button>
      </p>
    </div>
  );
}
