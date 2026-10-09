'use client';
/**
 * Admin Panel › Kelompok & Notifikasi › Suara notifikasi: dengarkan, ganti (unggah MP3/WAV/OGG/M4A
 * ≤ 1 MB & ≤ 6 detik), atur volume, kembalikan bawaan. Berlaku untuk alarm di halaman (web &
 * aplikasi Android saat terbuka) di semua akun. Penyimpanan & batas: lib/suara-notif.ts.
 */
import React, { useEffect, useRef, useState } from 'react';
import { MAKS_DETIK_SUARA, simpanSuaraNotif, SUARA_BAWAAN, type SuaraNotif, sumberSuara, unggahSuaraNotif, useSuaraNotif } from '@/lib/suara-notif';

export function KartuSuaraNotif() {
  const tersimpan = useSuaraNotif();
  const [draf, setDraf] = useState<SuaraNotif>(tersimpan);
  const [sibuk, setSibuk] = useState<'' | 'unggah' | 'simpan'>('');
  const [kabar, setKabar] = useState<{ jenis: 'ok' | 'gagal'; teks: string } | null>(null);
  const masukan = useRef<HTMLInputElement>(null);
  const pemutar = useRef<HTMLAudioElement | null>(null);

  //  Pengaturan termuat / disimpan di tempat lain -> draf mengikuti (bila belum diubah di sini).
  const [acuan, setAcuan] = useState(tersimpan);
  if (acuan !== tersimpan) { setAcuan(tersimpan); setDraf(tersimpan); }
  useEffect(() => () => { pemutar.current?.pause(); }, []);

  const berubah = draf.url !== tersimpan.url || draf.volume !== tersimpan.volume;
  const beritahu = (jenis: 'ok' | 'gagal', teks: string) => { setKabar({ jenis, teks }); setTimeout(() => setKabar(null), 5000); };

  /** Pratinjau berkas yang baru dipilih diputar dari laptop (object URL) - tidak menunggu unduhan. */
  const lokal = useRef<{ url: string; src: string } | null>(null);
  useEffect(() => () => { if (lokal.current) URL.revokeObjectURL(lokal.current.src); }, []);
  const putar = (s: SuaraNotif) => {
    pemutar.current?.pause();
    const a = new Audio(lokal.current && lokal.current.url === s.url ? lokal.current.src : sumberSuara(s));
    a.volume = s.volume;
    pemutar.current = a;
    a.play().catch(() => beritahu('gagal', 'Suara tidak bisa diputar - berkasnya mungkin rusak.'));
  };

  const pilihBerkas = async (f: File | undefined) => {
    if (!f) return;
    setSibuk('unggah');
    const { url, error } = await unggahSuaraNotif(f);
    setSibuk('');
    if (masukan.current) masukan.current.value = '';
    if (error || !url) { beritahu('gagal', error ?? 'Gagal mengunggah.'); return; }
    if (lokal.current) URL.revokeObjectURL(lokal.current.src);
    lokal.current = { url, src: URL.createObjectURL(f) };
    const baru = { ...draf, url, nama: f.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'Suara unggahan' };
    setDraf(baru);
    putar(baru);
    beritahu('ok', 'Berkas terunggah - dengarkan, lalu klik Simpan agar dipakai semua akun.');
  };

  const simpan = async () => {
    setSibuk('simpan');
    const { error } = await simpanSuaraNotif(draf);
    setSibuk('');
    if (error) beritahu('gagal', 'Gagal menyimpan: ' + error);
    else beritahu('ok', 'Suara notifikasi tersimpan - langsung dipakai di semua akun.');
  };

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white mb-4">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="font-bold text-slate-800 text-sm">🔔 Suara notifikasi</h3>
        <p className="text-slate-500 text-xs mt-0.5">Alarm saat ada ticket / jadwal / notifikasi baru di halaman (web & aplikasi Android yang sedang dibuka), untuk semua akun.</p>
      </div>
      <div className="p-4 space-y-3">
        {kabar && (
          <div role="status" className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold border ${kabar.jenis === 'ok' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>{kabar.teks}</div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Suara {berubah ? 'baru (belum disimpan)' : 'saat ini'}</p>
            <p className="text-sm font-bold text-slate-800 truncate">{draf.nama}</p>
          </div>
          <button type="button" onClick={() => putar(draf)}
            className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">▶ Dengarkan</button>
          <button type="button" onClick={() => masukan.current?.click()} disabled={sibuk !== ''}
            className="px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60 hover:opacity-90" style={{ background: 'linear-gradient(135deg,#4f46e5,#4338ca)' }}>
            {sibuk === 'unggah' ? 'Mengunggah…' : 'Ganti suara…'}
          </button>
          <input ref={masukan} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/mp4,audio/x-m4a,audio/aac,.mp3,.wav,.ogg,.m4a,.aac,.webm"
            className="hidden" aria-label="Pilih berkas suara notifikasi" onChange={e => void pilihBerkas(e.target.files?.[0])} />
        </div>
        <label className="block">
          <span className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500"><span>Volume</span><span className="tabular-nums text-slate-700">{Math.round(draf.volume * 100)}%</span></span>
          <input type="range" min={10} max={100} step={5} value={Math.round(draf.volume * 100)} aria-label="Volume suara notifikasi"
            onChange={e => setDraf(d => ({ ...d, volume: Number(e.target.value) / 100 }))} className="w-full accent-indigo-700" />
        </label>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          MP3, WAV, OGG, M4A/AAC atau WebM · maks 1 MB · maks {MAKS_DETIK_SUARA} detik - suara singkat lebih nyaman didengar berulang kali.
          Notifikasi push di HP (aplikasi tertutup) tetap memakai suara bawaan HP / aplikasi Android.
        </p>
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {draf.url && (
            <button type="button" onClick={() => setDraf({ ...SUARA_BAWAAN, volume: draf.volume })}
              className="mr-auto px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50">Kembalikan suara bawaan</button>
          )}
          {berubah && <button type="button" onClick={() => setDraf(tersimpan)} className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50">Batal</button>}
          <button type="button" onClick={simpan} disabled={!berubah || sibuk !== ''}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 hover:opacity-90" style={{ background: 'linear-gradient(135deg,#0f766e,#115e59)' }}>
            {sibuk === 'simpan' ? 'Menyimpan…' : 'Simpan Suara'}
          </button>
        </div>
      </div>
    </div>
  );
}
