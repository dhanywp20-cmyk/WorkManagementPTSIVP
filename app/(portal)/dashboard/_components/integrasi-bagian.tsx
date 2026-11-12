'use client';

import { useEffect, useState } from 'react';

export function PilihModel({ nilai, profil, onGanti, warna }: {
  nilai: string;
  profil?: 'penilai';
  onGanti: (m: string) => void;
  warna: 'sky' | 'violet';
}) {
  const [daftar, setDaftar] = useState<{ id: string; nama: string }[]>([]);
  const [galat, setGalat] = useState('');
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    let batal = false;
    fetch(`/api/ai/model${profil ? `?profil=${profil}` : ''}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error?.message ?? 'Gagal membaca daftar model.');
        return d;
      })
      .then(d => { if (!batal) { setDaftar(d?.model ?? []); setGalat(''); } })
      .catch(e => { if (!batal) setGalat(e instanceof Error ? e.message : 'Gagal membaca daftar model.'); })
      .finally(() => { if (!batal) setMemuat(false); });
    return () => { batal = true; };
  }, [profil]);

  const fokus = warna === 'violet' ? 'focus:border-violet-400' : 'focus:border-sky-400';

  if (memuat) return <p className="text-[11px] text-slate-500 py-2">Memuat daftar model…</p>;

  if (daftar.length === 0) {
    return (
      <>
        <input value={nilai} onChange={e => onGanti(e.target.value)}
          aria-label="Nama model AI"
          className={`w-full text-xs px-2.5 py-2 rounded-lg border border-amber-300 focus:outline-hidden ${fokus}`} />
        <p className="text-[10px] text-amber-700 mt-1 leading-relaxed">
          Daftar model tidak bisa dibaca{galat ? ` (${galat})` : ''} — ketik nama modelnya.
          Periksa tokennya lebih dulu; nama yang salah baru ketahuan saat AI dipakai.
        </p>
      </>
    );
  }

  return (
    <>
      <select value={nilai} onChange={e => onGanti(e.target.value)}
        aria-label="Model AI"
        className={`w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden ${fokus}`}>
        {nilai && !daftar.some(m => m.id === nilai) && (
          <option value={nilai}>{nilai} — tidak ada di daftar</option>
        )}
        {daftar.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
      </select>
      <p className="text-[10px] text-slate-500 mt-1">
        {daftar.length} model tersedia untuk token ini — dibaca langsung dari Google, jadi tidak pernah basi.
      </p>
    </>
  );
}

export function Saklar({ aktif, onKlik, warna }: { aktif: boolean; onKlik: () => void; warna: string }) {
  return (
    <button type="button" onClick={onKlik} role="switch" aria-checked={aktif}
      className="relative w-9 h-5 rounded-full transition-colors shrink-0"
      style={{ background: aktif ? warna : '#cbd5e1' }}>
      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all"
        style={{ left: aktif ? 18 : 2 }} />
    </button>
  );
}

export interface StatusRahasia {
  terisi: boolean; penanda?: string; diperbarui?: string; oleh?: string;
  dariEnv?: boolean;
}

export type StatusKoneksi =
  | { keadaan: 'memuat' }
  | { keadaan: 'terhubung'; info: string }
  | { keadaan: 'putus'; alasan: string };

export type PesanKotak = { tipe: 'ok' | 'gagal'; teks: string };

export function LencanaStatus({ status }: { status: StatusKoneksi }) {
  const gaya = status.keadaan === 'terhubung'
    ? { bg: '#dcfce7', fg: '#15803d', titik: '#22c55e', teks: 'Terhubung' }
    : status.keadaan === 'memuat'
      ? { bg: '#f1f5f9', fg: '#64748b', titik: '#94a3b8', teks: 'Mengecek…' }
      : { bg: '#fef3c7', fg: '#b45309', titik: '#f59e0b', teks: 'Belum Terhubung' };
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0"
      style={{ background: gaya.bg, color: gaya.fg }}
      title={status.keadaan === 'putus' ? status.alasan
             : status.keadaan === 'terhubung' ? status.info : 'Sedang memeriksa koneksi…'}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: gaya.titik }} />
      {gaya.teks}
    </span>
  );
}

export function PesanKotak({ pesan }: { pesan: PesanKotak | null }) {
  if (!pesan) return null;
  const ok = pesan.tipe === 'ok';
  return (
    <div className="mt-2 rounded-lg px-2.5 py-2 flex items-start gap-1.5"
      role="status" aria-live="polite"
      style={{
        background: ok ? '#f0fdf4' : '#fef2f2',
        border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
      }}>
      <span className="text-[11px] leading-none mt-px shrink-0">{ok ? '✅' : '⚠️'}</span>
      <span className={`text-[11px] font-semibold leading-relaxed ${ok ? 'text-green-700' : 'text-red-600'}`}>
        {pesan.teks}
      </span>
    </div>
  );
}

export function Cek({ ya }: { ya?: boolean }) {
  return (
    <span className={`inline-grid place-items-center w-[19px] h-[19px] rounded-full text-[11px] font-black ${
      ya ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
      {ya ? '✓' : '✕'}
    </span>
  );
}
