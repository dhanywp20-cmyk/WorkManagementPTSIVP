'use client';

/**
 * Potongan tampilan verifikasi dua langkah (2FA) - dipakai layar login (admin wajib 2FA) dan
 * Profil -> Keamanan. Semua panggilan server dilakukan pemanggil lewat props; komponen ini hanya
 * menampilkan QR, kotak kode, dan kode cadangan.
 */
import React, { useEffect, useState } from 'react';

const kelasInput = 'w-full border border-slate-200 rounded-xl px-4 py-3 bg-white text-slate-800 font-mono text-lg tracking-[0.3em] text-center outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100';
const kelasTombol = 'w-full py-3 rounded-xl font-bold text-sm text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2';

/** Kotak kode 6 digit (atau kode cadangan bila `cadangan`). */
export function InputKode2FA({ nilai, ubah, kirim, cadangan = false, autoFocus = true }: {
  nilai: string; ubah: (v: string) => void; kirim: () => void; cadangan?: boolean; autoFocus?: boolean;
}) {
  return (
    <input
      value={nilai}
      onChange={e => ubah(cadangan ? e.target.value.toUpperCase().slice(0, 9) : e.target.value.replace(/\D/g, '').slice(0, 6))}
      onKeyDown={e => { if (e.key === 'Enter') kirim(); }}
      inputMode={cadangan ? 'text' : 'numeric'}
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      placeholder={cadangan ? 'XXXX-XXXX' : '000000'}
      aria-label={cadangan ? 'Kode cadangan' : 'Kode 6 digit'}
      className={kelasInput}
    />
  );
}

/**
 * Pendaftaran: minta rahasia baru -> tampilkan QR -> kode pertama dari aplikasi authenticator.
 * `kirimKode` mengembalikan pesan galat, atau null bila berhasil.
 */
export function PanelDaftar2FA({ mintaRahasia, kirimKode, onBatal }: {
  mintaRahasia: () => Promise<{ rahasia: string; url: string } | { error: string }>;
  kirimKode: (kode: string) => Promise<string | null>;
  onBatal?: () => void;
}) {
  const [data, setData] = useState<{ rahasia: string; url: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [kode, setKode] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [lihatRahasia, setLihatRahasia] = useState(false);

  useEffect(() => {
    let batal = false;
    (async () => {
      const r = await mintaRahasia();
      if (batal) return;
      if ('error' in r) { setGalat(r.error); return; }
      setData(r);
      try {
        const QRCode = (await import('qrcode')).default;
        const gambar = await QRCode.toDataURL(r.url, { width: 200, margin: 1 });
        if (!batal) setQr(gambar);
      } catch { if (!batal) setLihatRahasia(true); }
    })();
    return () => { batal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kirim = async () => {
    if (kode.length !== 6 || sibuk) return;
    setSibuk(true); setGalat('');
    const g = await kirimKode(kode);
    setSibuk(false);
    if (g) { setGalat(g); setKode(''); }
  };

  return (
    <div className="space-y-3">
      <ol className="text-xs text-slate-600 space-y-1 list-decimal pl-4">
        <li>Pindai dengan Google / Microsoft Authenticator</li>
        <li>Masukkan 6 digit yang muncul</li>
      </ol>
      <div className="flex justify-center">
        {qr
          ? <img src={qr} alt="QR 2FA" width={200} height={200} className="rounded-xl border border-slate-200" />
          : <div className="w-[200px] h-[200px] rounded-xl bg-slate-100 animate-pulse" />}
      </div>
      {data && (
        <button type="button" onClick={() => setLihatRahasia(v => !v)} className="block mx-auto text-[11px] font-bold text-slate-500 hover:underline">
          {lihatRahasia ? data.rahasia.replace(/(.{4})/g, '$1 ').trim() : 'Tidak bisa pindai?'}
        </button>
      )}
      <InputKode2FA nilai={kode} ubah={setKode} kirim={kirim} autoFocus={false} />
      {galat && <p className="px-3 py-2 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-200">{galat}</p>}
      <button type="button" onClick={kirim} disabled={kode.length !== 6 || sibuk || !data} className={kelasTombol}>
        {sibuk ? 'Memeriksa…' : 'Aktifkan'}
      </button>
      {onBatal && (
        <button type="button" onClick={onBatal} className="w-full text-xs font-bold text-slate-500 hover:underline">Batal</button>
      )}
    </div>
  );
}

/** 8 kode cadangan - teksnya hanya ada saat ini, jadi wajib disalin/diunduh sebelum lanjut. */
export function DaftarKodeCadangan({ kode, onSelesai, labelSelesai = 'Sudah saya simpan' }: {
  kode: string[]; onSelesai: () => void; labelSelesai?: string;
}) {
  const [disalin, setDisalin] = useState(false);
  const teks = kode.join('\n');
  const salin = async () => {
    try { await navigator.clipboard.writeText(teks); setDisalin(true); } catch { /* salin manual */ }
  };
  const unduh = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`Kode cadangan 2FA (sekali pakai)\n\n${teks}\n`], { type: 'text/plain' }));
    a.download = 'kode-cadangan-2fa.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    setDisalin(true);
  };
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
        Kode cadangan · sekali pakai · tampil sekali
      </p>
      <div className="grid grid-cols-2 gap-2 font-mono text-sm text-slate-800">
        {kode.map(k => <span key={k} className="text-center py-1.5 rounded-lg bg-slate-50 border border-slate-200">{k}</span>)}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={salin} className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">
          {disalin ? 'Tersalin ✓' : 'Salin'}
        </button>
        <button type="button" onClick={unduh} className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">
          Unduh .txt
        </button>
      </div>
      <button type="button" onClick={onSelesai} disabled={!disalin} className={kelasTombol} title={disalin ? undefined : 'Salin atau unduh dulu'}>
        {labelSelesai}
      </button>
    </div>
  );
}
