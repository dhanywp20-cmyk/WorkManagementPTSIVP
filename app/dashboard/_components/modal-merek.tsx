'use client';
import React, { useEffect, useRef, useState } from 'react';
import {
  Merek, MEREK_BAWAAN, merek as merekSekarang, muatMerek, simpanMerek,
  unggahBerkasMerek, angkaTembus, gradasiPanelLogin,
} from '@/lib/merek';

/**
 * Bagian "Dashboard Setting" pada Admin Panel - identitas tampilan platform.
 *
 * Dua kelompok yang sengaja dipisah karena dilihat orang yang berbeda:
 * header di DALAM platform (dilihat tim yang sudah masuk) dan HALAMAN LOGIN
 * (dilihat semua orang, termasuk yang belum punya akun). Keduanya punya warna
 * sendiri - warna yang enak di atas foto latar belum tentu enak jadi warna
 * tombol, dan sebaliknya.
 *
 * Daftar divisi sales TIDAK di sini: tempatnya di User Management, karena yang
 * mengurusnya orang yang sama dengan yang mengurus akun.
 */
export function MerekSettingInline() {
  const [form, setForm] = useState<Merek>(MEREK_BAWAAN);
  const [menyimpan, setMenyimpan] = useState(false);
  const [mengunggah, setMengunggah] = useState<'logo' | 'latar' | null>(null);
  const [kabar, setKabar] = useState<{ jenis: 'ok' | 'gagal'; teks: string } | null>(null);
  const [siap, setSiap] = useState(false);

  const beritahu = (jenis: 'ok' | 'gagal', teks: string) => {
    setKabar({ jenis, teks });
    setTimeout(() => setKabar(null), 5000);
  };

  useEffect(() => {
    void muatMerek().then(() => { setForm(merekSekarang()); setSiap(true); });
  }, []);

  const ubah = (kunci: keyof Merek, nilai: string) => setForm(f => ({ ...f, [kunci]: nilai }));

  const simpan = async () => {
    setMenyimpan(true);
    const { error } = await simpanMerek(form);
    setMenyimpan(false);
    if (error) beritahu('gagal', 'Gagal menyimpan: ' + error);
    else beritahu('ok', 'Tersimpan. Header & halaman login langsung ikut berubah.');
  };

  const terimaBerkas = async (berkas: File, jenis: 'logo' | 'latar') => {
    setMengunggah(jenis);
    const { url, error } = await unggahBerkasMerek(berkas, jenis);
    setMengunggah(null);
    if (error || !url) { beritahu('gagal', error ?? 'Unggahan gagal.'); return; }
    // Hanya mengisi kolomnya - belum tersimpan. Supaya bisa dilihat dulu di
    // pratinjau dan dibatalkan kalau ternyata tidak cocok.
    ubah(jenis === 'logo' ? 'logoUrl' : 'gambarLatar', url);
    beritahu('ok', 'Berhasil diunggah. Lihat pratinjaunya, lalu tekan Simpan.');
  };

  if (!siap) return <div className="p-6 text-sm text-slate-400">Memuat pengaturan…</div>;

  const tombolSimpan = (
    <button type="button" onClick={simpan} disabled={menyimpan || mengunggah !== null}
      className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50 hover:opacity-90"
      style={{ background: `linear-gradient(135deg, ${form.warnaUtama}, ${form.warnaUtama2})` }}>
      {menyimpan ? 'Menyimpan…' : 'Simpan'}
    </button>
  );

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-6">
      {kabar && (
        <div className="rounded-xl px-4 py-3 text-sm font-semibold"
          style={kabar.jenis === 'ok'
            ? { background: 'rgba(16,185,129,0.1)', color: '#047857', border: '1px solid rgba(16,185,129,0.35)' }
            : { background: 'rgba(239,68,68,0.1)', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.35)' }}>
          {kabar.teks}
        </div>
      )}

      {/* ══ DASHBOARD ══ */}
      <section className="rounded-2xl border border-slate-200 overflow-hidden">
        <Kepala judul="Dashboard" catatan="Header yang dilihat tim setelah masuk." />

        {/* Pratinjau header */}
        <div className="px-4 pt-4">
          <Label>Pratinjau</Label>
          <div className="mt-1.5 rounded-xl border border-slate-200 p-3.5 flex items-center gap-3 bg-white">
            <KotakLogo url={form.logoUrl} a={form.warnaUtama} b={form.warnaUtama2} sisi={48} />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-tight truncate">{form.namaPlatform || MEREK_BAWAAN.namaPlatform}</h1>
                <span className="text-slate-300 font-light">|</span>
                <span className="text-sm font-bold tracking-wide whitespace-nowrap" style={{ color: form.warnaAksen }}>{form.namaPortal}</span>
              </div>
              <p className="text-slate-500 text-xs font-medium mt-0.5 truncate">{form.namaPerusahaan}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <Unggah label="Logo" jenis="logo" nilai={form.logoUrl} sedang={mengunggah === 'logo'}
            keterangan="PNG atau SVG dengan latar transparan, maks 2MB. Sengaja tidak dikompres supaya bagian transparannya tidak berubah jadi kotak putih."
            onBerkas={f => terimaBerkas(f, 'logo')} onHapus={() => ubah('logoUrl', '')} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Isian label="Nama Platform" nilai={form.namaPlatform} bawaan={MEREK_BAWAAN.namaPlatform} onChange={v => ubah('namaPlatform', v)} />
            <Isian label="Nama Platform (layar sempit)" nilai={form.namaPlatformSingkat} bawaan={MEREK_BAWAAN.namaPlatformSingkat} onChange={v => ubah('namaPlatformSingkat', v)} />
            <Isian label="Nama Portal" nilai={form.namaPortal} bawaan={MEREK_BAWAAN.namaPortal} onChange={v => ubah('namaPortal', v)} />
            <Isian label="Nama Perusahaan" nilai={form.namaPerusahaan} bawaan={MEREK_BAWAAN.namaPerusahaan} onChange={v => ubah('namaPerusahaan', v)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Warna label="Warna Utama" nilai={form.warnaUtama} onChange={v => ubah('warnaUtama', v)} />
            <Warna label="Warna Utama 2" nilai={form.warnaUtama2} onChange={v => ubah('warnaUtama2', v)} />
            <Warna label="Warna Aksen (nama portal)" nilai={form.warnaAksen} onChange={v => ubah('warnaAksen', v)} />
          </div>
        </div>
      </section>

      {/* ══ HALAMAN LOGIN ══ */}
      <section className="rounded-2xl border border-slate-200 overflow-hidden">
        <Kepala judul="Halaman Login" catatan="Dilihat semua orang, termasuk yang belum punya akun." />

        {/* Pratinjau login */}
        <div className="px-4 pt-4">
          <Label>Pratinjau</Label>
          <div className="mt-1.5 rounded-xl overflow-hidden border border-slate-200 flex h-44 bg-cover bg-center"
            style={{ backgroundImage: `url(${form.gambarLatar})` }}>
            <div className="w-1/2 p-4 flex flex-col justify-between text-white" style={{ background: gradasiPanelLogin(form) }}>
              <div className="flex items-center gap-2">
                <KotakLogo url={form.logoUrl} tembus sisi={28} />
                <span className="text-[11px] font-bold truncate">{form.namaPlatform} <span className="font-normal text-white/70">· {form.namaPortal}</span></span>
              </div>
              <div>
                <p className="text-base font-black leading-tight line-clamp-2">{form.judulLogin}</p>
                <p className="text-white/80 text-[10px] mt-1 line-clamp-2">{form.subjudulLogin}</p>
              </div>
              <p className="text-white/50 text-[9px]">© 2026 {form.namaPerusahaan}</p>
            </div>
            <div className="w-1/2 flex items-center justify-center p-4"
              style={{ background: `rgba(255,255,255,${angkaTembus(form.tembusKanan, 0.55)})` }}>
              <div className="w-full bg-white/95 rounded-xl shadow-lg p-3">
                <p className="text-sm font-bold text-slate-800">Selamat Datang</p>
                <div className="h-5 rounded-md bg-slate-100 mt-2" />
                <div className="h-5 rounded-md bg-slate-100 mt-1.5" />
                <div className="h-7 rounded-lg mt-2 flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ background: `linear-gradient(to right, ${form.warnaUtama}, ${form.warnaUtama2})` }}>
                  Sign In to Portal
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <Unggah label="Gambar Latar" jenis="latar" nilai={form.gambarLatar} sedang={mengunggah === 'latar'}
            keterangan="Foto lanskap, maks 8MB. Dikecilkan otomatis ke 2400px sebelum diunggah supaya halaman login tetap ringan dibuka dari HP."
            onBerkas={f => terimaBerkas(f, 'latar')} onHapus={() => ubah('gambarLatar', MEREK_BAWAAN.gambarLatar)} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Warna label="Warna Panel Kiri" nilai={form.warnaLogin} onChange={v => ubah('warnaLogin', v)} />
            <Warna label="Warna Panel Kiri 2" nilai={form.warnaLogin2} onChange={v => ubah('warnaLogin2', v)} />
            <Geser label="Kepekatan Panel Kiri" nilai={form.tembusLogin} bawaan={0.84}
              catatan="Makin kecil, foto latarnya makin terlihat menembus warna."
              onChange={v => ubah('tembusLogin', v)} />
            <Geser label="Kabut Putih Sisi Kanan" nilai={form.tembusKanan} bawaan={0.55}
              catatan="Makin besar, sisi kartu login makin putih dan tulisannya makin terbaca."
              onChange={v => ubah('tembusKanan', v)} />
          </div>

          <Isian label="Judul Panel Login" nilai={form.judulLogin} bawaan={MEREK_BAWAAN.judulLogin} onChange={v => ubah('judulLogin', v)} />
          <Isian label="Subjudul Panel Login" nilai={form.subjudulLogin} bawaan={MEREK_BAWAAN.subjudulLogin} onChange={v => ubah('subjudulLogin', v)} />
        </div>
      </section>

      <div className="flex flex-wrap gap-2 justify-end items-center">
        <p className="text-[11px] text-slate-400 mr-auto">Dikosongkan = kembali ke nilai bawaan.</p>
        <button type="button" onClick={() => setForm(MEREK_BAWAAN)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all">
          Kembalikan semua ke bawaan
        </button>
        {tombolSimpan}
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        Tersimpan di database, bukan di kode - berlaku untuk semua orang tanpa deploy ulang.
        Halaman yang sedang terbuka di perangkat lain ikut berubah setelah dimuat ulang.
      </p>
    </div>
  );
}

// Bagian kecil

function Kepala({ judul, catatan }: { judul: string; catatan: string }) {
  return (
    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
      <h3 className="font-bold text-slate-800 text-sm">{judul}</h3>
      <p className="text-slate-500 text-xs mt-0.5">{catatan}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="block text-[10px] font-bold tracking-widest uppercase text-slate-400">{children}</span>;
}

function KotakLogo({ url, a, b, tembus, sisi }: { url: string; a?: string; b?: string; tembus?: boolean; sisi: number }) {
  return (
    <div className="rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{ width: sisi, height: sisi, background: tembus ? 'rgba(255,255,255,0.15)' : `linear-gradient(135deg, ${a}, ${b})` }}>
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt="" className="w-full h-full object-contain" />
        : <svg aria-hidden="true" className="text-white" style={{ width: sisi * 0.52, height: sisi * 0.52 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
    </div>
  );
}

function Unggah({ label, jenis, nilai, sedang, keterangan, onBerkas, onHapus }: {
  label: string; jenis: 'logo' | 'latar'; nilai: string; sedang: boolean;
  keterangan: string; onBerkas: (f: File) => void; onHapus: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const bawaan = jenis === 'latar' && nilai === MEREK_BAWAAN.gambarLatar;
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 flex items-center gap-3">
        <div className={`rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0 ${jenis === 'logo' ? 'w-14 h-14' : 'w-24 h-14'}`}>
          {nilai
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={nilai} alt="" className="w-full h-full object-contain" />
            : <span className="text-[10px] text-slate-300 font-bold">kosong</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/*" className="hidden" aria-label={`Unggah ${label}`}
            onChange={e => { const f = e.target.files?.[0]; if (f) onBerkas(f); e.target.value = ''; }} />
          <button type="button" onClick={() => input.current?.click()} disabled={sedang}
            className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50">
            {sedang ? 'Mengunggah…' : nilai && !bawaan ? 'Ganti berkas' : 'Pilih berkas'}
          </button>
          {nilai && !bawaan && (
            <button type="button" onClick={onHapus} disabled={sedang}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-600 transition-all disabled:opacity-50">
              Kembalikan ke bawaan
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{keterangan}</p>
    </div>
  );
}

function Isian({ label, nilai, bawaan, onChange }: {
  label: string; nilai: string; bawaan: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input value={nilai} onChange={e => onChange(e.target.value)} placeholder={bawaan}
        className="mt-1.5 w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-slate-400 bg-white" />
    </div>
  );
}

function Warna({ label, nilai, onChange }: { label: string; nilai: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 flex gap-2">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(nilai) ? nilai : '#000000'}
          onChange={e => onChange(e.target.value)} aria-label={label}
          className="w-11 h-10 rounded-xl border border-slate-200 bg-white p-1 cursor-pointer flex-shrink-0" />
        <input value={nilai} onChange={e => onChange(e.target.value)} placeholder="#e11d48"
          className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-slate-400 bg-white" />
      </div>
    </div>
  );
}

function Geser({ label, nilai, bawaan, catatan, onChange }: {
  label: string; nilai: string; bawaan: number; catatan: string; onChange: (v: string) => void;
}) {
  const angka = angkaTembus(nilai, bawaan);
  return (
    <div>
      <Label>{label} <span className="text-slate-500 font-mono">{angka.toFixed(2)}</span></Label>
      <input type="range" min={0} max={1} step={0.02} value={angka} aria-label={label}
        onChange={e => onChange(e.target.value)}
        className="mt-2.5 w-full accent-slate-700 cursor-pointer" />
      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{catatan}</p>
    </div>
  );
}
