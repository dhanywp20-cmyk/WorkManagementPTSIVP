'use client';
import { Keterangan } from '@/components/shared/Keterangan';
import React, { useEffect, useRef, useState } from 'react';
import {
  Merek, MEREK_BAWAAN, merek as merekSekarang, muatMerek, simpanMerek,
  unggahBerkasMerek, angkaTembus, gradasiPanelLogin, type JenisBerkasMerek,
} from '@/lib/merek/inti';

export function MerekSettingInline() {
  const [form, setForm] = useState<Merek>(MEREK_BAWAAN);
  const [menyimpan, setMenyimpan] = useState(false);
  const [mengunggah, setMengunggah] = useState<JenisBerkasMerek | null>(null);
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
    else beritahu('ok', 'Tersimpan. Header, background dashboard & halaman login langsung ikut berubah.');
  };

  const terimaBerkas = async (berkas: File, jenis: JenisBerkasMerek) => {
    setMengunggah(jenis);
    const { url, error } = await unggahBerkasMerek(berkas, jenis);
    setMengunggah(null);
    if (error || !url) { beritahu('gagal', error ?? 'Unggahan gagal.'); return; }
    const kunci = ({ logo: 'logoUrl', latar: 'gambarLatar', latarDasbor: 'gambarLatarDasbor', latarMatte: 'gambarLatarMatte' } as const)[jenis];
    ubah(kunci, url);
    if (jenis === 'latarMatte') ubah('latarMatte', 'gambar');
    beritahu('ok', 'Berhasil diunggah. Lihat pratinjaunya, lalu tekan Simpan.');
  };

  if (!siap) return <div className="p-6 text-sm text-slate-500">Memuat pengaturan…</div>;

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

      <section className="rounded-2xl border border-slate-200 overflow-hidden">
        <Kepala judul="Dashboard" catatan="Header yang dilihat tim setelah masuk." />

        <div className="px-4 pt-4">
          <Label>Pratinjau</Label>
          <div className="mt-1.5 rounded-xl border border-slate-200 p-3.5 flex items-center gap-3 bg-white">
            <KotakLogo url={form.logoUrl} a={form.warnaUtama} b={form.warnaUtama2} sisi={48} />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-tight truncate">{form.namaPlatform || MEREK_BAWAAN.namaPlatform}</h1>
                <span className="text-slate-400 font-light">|</span>
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
            <Isian label="Kredit Pembuat" nilai={form.kredit} bawaan={MEREK_BAWAAN.kredit} onChange={v => ubah('kredit', v)} />
            <Isian label="Kontak Bantuan" nilai={form.kontakDukungan} bawaan="email / no. WA — kosongkan bila tidak dipakai" onChange={v => ubah('kontakDukungan', v)} />
            <Isian label="Nama Platform (layar sempit)" nilai={form.namaPlatformSingkat} bawaan={MEREK_BAWAAN.namaPlatformSingkat} onChange={v => ubah('namaPlatformSingkat', v)} />
            <Isian label="Nama Portal" nilai={form.namaPortal} bawaan={MEREK_BAWAAN.namaPortal} onChange={v => ubah('namaPortal', v)} />
            <Isian label="Nama Perusahaan" nilai={form.namaPerusahaan} bawaan={MEREK_BAWAAN.namaPerusahaan} onChange={v => ubah('namaPerusahaan', v)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Warna label="Warna Utama" nilai={form.warnaUtama} onChange={v => ubah('warnaUtama', v)} />
            <Warna label="Warna Utama 2" nilai={form.warnaUtama2} onChange={v => ubah('warnaUtama2', v)} />
            <Warna label="Warna Aksen (nama portal)" nilai={form.warnaAksen} onChange={v => ubah('warnaAksen', v)} />
            <Warna label="Warna Tema (menu aktif, kartu & grafik)" nilai={form.warnaTema} onChange={v => ubah('warnaTema', v)} />
          </div>

          <Pilihan label="Sidebar saat pertama masuk" nilai={form.sidebarCiut || 'ya'} onChange={v => ubah('sidebarCiut', v)}
            opsi={[['ya', 'Diciutkan (ikon saja)'], ['tidak', 'Lebar (dengan nama menu)']]}
            keterangan="Berlaku untuk semua pengguna setiap kali masuk. Pengguna tetap bisa melebarkan / menciutkan sendiri." />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 overflow-hidden">
        <Kepala judul="Tampilan Glass & Matte" catatan="Dua gaya dashboard dengan pengaturan masing-masing. HP selalu Matte; di desktop pengguna bisa pindah lewat tombol Glass / Matte di sidebar." />

        <div className="p-4 space-y-4">
          <Pilihan label="Tampilan bawaan desktop" nilai={form.gayaBawaan === 'matte' ? 'matte' : 'glass'} onChange={v => ubah('gayaBawaan', v)}
            opsi={[['glass', 'Glass'], ['matte', 'Matte']]}
            keterangan="Dipakai pengguna desktop yang belum pernah memilih sendiri. Pilihan pengguna di sidebar tetap diutamakan." />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 p-3.5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-800">Glass</h4>
                <span className="text-[11px] font-semibold text-slate-500">bingkai terang · panel transparan</span>
              </div>
              <PratinjauGlass form={form} />
              <Warna label="Warna aksen kartu (garis & tint tipis)" nilai={form.warnaKartuGlass} onChange={v => ubah('warnaKartuGlass', v)} />
              <Pilihan label="Latar Glass" nilai={form.latarDasbor || 'netral'} onChange={v => ubah('latarDasbor', v)}
                opsi={[['netral', 'Netral (disarankan)'], ['gambar', 'Gambar di bawah']]}
                keterangan="Latar netral membuat angka & grafik lebih mudah dibaca. Halaman login tetap memakai fotonya sendiri." />
              <Unggah label="Gambar latar Glass" jenis="latarDasbor" nilai={form.gambarLatarDasbor} sedang={mengunggah === 'latarDasbor'}
                keterangan="Foto latar dashboard gaya Glass (boleh beda dari foto Halaman Login). Maks 8MB, dikecilkan otomatis ke 2400px."
                onBerkas={f => terimaBerkas(f, 'latarDasbor')} onHapus={() => ubah('gambarLatarDasbor', MEREK_BAWAAN.gambarLatarDasbor)} />
            </div>

            <div className="rounded-xl border border-slate-200 p-3.5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-800">Matte</h4>
                <span className="text-[11px] font-semibold text-slate-500">bingkai gelap · panel putih</span>
              </div>
              <PratinjauMatte form={form} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Warna label="Warna aksen Matte" nilai={form.warnaMatte} onChange={v => ubah('warnaMatte', v)} />
                <Warna label="Warna bingkai gelap" nilai={form.warnaBingkaiMatte} onChange={v => ubah('warnaBingkaiMatte', v)} />
              </div>
              <Pilihan label="Latar Matte" nilai={form.latarMatte === 'gambar' ? 'gambar' : 'gradasi'} onChange={v => ubah('latarMatte', v)}
                opsi={[['gradasi', 'Gradasi warna bingkai (disarankan)'], ['gambar', 'Gambar di bawah']]}
                keterangan="Terpisah dari latar Glass. Bila memakai gambar, foto ditutup lapisan warna bingkai supaya menu & teks putih tetap terbaca." />
              <Unggah label="Gambar latar Matte" jenis="latarMatte" nilai={form.gambarLatarMatte} sedang={mengunggah === 'latarMatte'}
                labelHapus="Hapus gambar"
                keterangan="Foto latar bingkai gaya Matte, terpisah dari gambar latar Glass. Setelah diunggah, Latar Matte otomatis pindah ke 'Gambar di bawah'. Maks 8MB, dikecilkan otomatis ke 2400px."
                onBerkas={f => terimaBerkas(f, 'latarMatte')}
                onHapus={() => { ubah('gambarLatarMatte', MEREK_BAWAAN.gambarLatarMatte); ubah('latarMatte', 'gradasi'); }} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 overflow-hidden">
        <Kepala judul="Halaman Login" catatan="Dilihat semua orang, termasuk yang belum punya akun." />

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
                <p className="text-white/80 text-[11px] mt-1 line-clamp-2">{form.subjudulLogin}</p>
              </div>
              <p className="text-white/50 text-[10px]">© 2026 {form.namaPerusahaan}</p>
            </div>
            <div className="w-1/2 flex items-center justify-center p-4"
              style={{ background: `rgba(255,255,255,${angkaTembus(form.tembusKanan, 0.55)})` }}>
              <div className="w-full bg-white/95 rounded-xl shadow-lg p-3">
                <p className="text-sm font-bold text-slate-800">Selamat Datang</p>
                <div className="h-5 rounded-md bg-slate-100 mt-2" />
                <div className="h-5 rounded-md bg-slate-100 mt-1.5" />
                <div className="h-7 rounded-lg mt-2 flex items-center justify-center text-white text-[11px] font-bold"
                  style={{ background: `linear-gradient(to right, ${form.warnaUtama}, ${form.warnaUtama2})` }}>
                  Masuk ke Portal
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
        <p className="text-[11px] text-slate-500 mr-auto">Dikosongkan = kembali ke nilai bawaan.</p>
        <button type="button" onClick={() => setForm(MEREK_BAWAAN)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all">
          Kembalikan semua ke bawaan
        </button>
        {tombolSimpan}
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        Tersimpan di database, bukan di kode - berlaku untuk semua orang tanpa deploy ulang.
        Halaman yang sedang terbuka di perangkat lain ikut berubah setelah dimuat ulang.
      </p>
    </div>
  );
}

function Kepala({ judul, catatan }: { judul: string; catatan: string }) {
  return (
    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
      <h3 className="font-bold text-slate-800 text-sm">{judul}</h3>
      <p className="text-slate-500 text-xs mt-0.5">{catatan}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="block text-[11px] font-bold tracking-widest uppercase text-slate-500">{children}</span>;
}

function KotakLogo({ url, a, b, tembus, sisi }: { url: string; a?: string; b?: string; tembus?: boolean; sisi: number }) {
  return (
    <div className="rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
      style={{ width: sisi, height: sisi,
        background: url ? (tembus ? 'rgba(255,255,255,0.92)' : '#ffffff')
                        : (tembus ? 'rgba(255,255,255,0.15)' : `linear-gradient(135deg, ${a}, ${b})`),
        border: url && !tembus ? '1px solid rgba(15,23,42,0.08)' : undefined }}>
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt="" className="w-full h-full object-contain p-[11%]" />
        : <svg aria-hidden="true" className="text-white" style={{ width: sisi * 0.52, height: sisi * 0.52 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
    </div>
  );
}

function Unggah({ label, jenis, nilai, sedang, keterangan, labelHapus = 'Kembalikan ke bawaan', onBerkas, onHapus }: {
  label: string; jenis: JenisBerkasMerek; nilai: string; sedang: boolean;
  keterangan: string; labelHapus?: string; onBerkas: (f: File) => void; onHapus: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const bawaan = (jenis === 'latar' && nilai === MEREK_BAWAAN.gambarLatar)
    || (jenis === 'latarDasbor' && nilai === MEREK_BAWAAN.gambarLatarDasbor)
    || (jenis === 'latarMatte' && nilai === MEREK_BAWAAN.gambarLatarMatte);
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 flex items-center gap-3">
        <div className={`rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 ${jenis === 'logo' ? 'w-14 h-14' : 'w-24 h-14'}`}>
          {nilai
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={nilai} alt="" className="w-full h-full object-contain" />
            : <span className="text-[11px] text-slate-500 font-bold">kosong</span>}
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
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 transition-all disabled:opacity-50">
              {labelHapus}
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{keterangan}</p>
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
        className="mt-1.5 w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-hidden focus:border-slate-400 bg-white" />
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
          className="w-11 h-10 rounded-xl border border-slate-200 bg-white p-1 cursor-pointer shrink-0" />
        <input value={nilai} onChange={e => onChange(e.target.value)} placeholder="#e11d48"
          className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-hidden focus:border-slate-400 bg-white" />
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
      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{catatan}</p>
    </div>
  );
}

function Pilihan({ label, nilai, opsi, keterangan, onChange }: {
  label: string; nilai: string; opsi: readonly (readonly [string, string])[]; keterangan?: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className="block text-[11px] font-bold text-slate-600 mb-1">{label}</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {opsi.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={nilai === v} onClick={() => onChange(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${nilai === v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300'}`}>
            {l}
          </button>
        ))}
      </div>
      {keterangan && <Keterangan className="ml-1">{keterangan}</Keterangan>}
    </div>
  );
}

const hexAman = (nilai: string, bawaan: string) => (/^#[0-9a-f]{6}$/i.test(nilai ?? '') ? nilai : bawaan);

/** Kartu mini dengan tint & garis aksen tipis, sama dengan pola kartu di dashboard. */
function KartuMini({ aksen, lebar }: { aksen: string; lebar: string }) {
  return (
    <div className="rounded-lg p-1.5 space-y-1" style={{ width: lebar,
      background: `linear-gradient(180deg, color-mix(in srgb, ${aksen} 8%, #fff), #fff 60%)`,
      boxShadow: `0 0 0 1px color-mix(in srgb, ${aksen} 22%, #e5e7eb)` }}>
      <div className="h-1 w-6 rounded-full" style={{ background: `color-mix(in srgb, ${aksen} 55%, #94a3b8)` }} />
      <div className="h-2 w-4 rounded-sm bg-slate-700" />
      <div className="h-1 rounded-full" style={{ background: `color-mix(in srgb, ${aksen} 16%, #fff)` }}>
        <div className="h-1 w-3/5 rounded-full" style={{ background: aksen }} />
      </div>
    </div>
  );
}

function PratinjauGlass({ form }: { form: Merek }) {
  const aksen = hexAman(form.warnaKartuGlass, MEREK_BAWAAN.warnaKartuGlass);
  const tema = hexAman(form.warnaTema, MEREK_BAWAAN.warnaTema);
  const bergambar = form.latarDasbor === 'gambar' && form.gambarLatarDasbor;
  return (
    <div aria-hidden="true" className="rounded-xl overflow-hidden border border-slate-200 h-32 p-2 flex flex-col gap-1.5 bg-cover bg-center"
      style={bergambar ? { backgroundImage: `url(${form.gambarLatarDasbor})` } : { background: 'linear-gradient(180deg, #efeae3, #e8e1d8)' }}>
      <div className="h-3 rounded-md bg-white/95" />
      <div className="flex-1 flex gap-1.5 min-h-0">
        <div className="w-10 rounded-lg bg-white/95 p-1 space-y-1">
          <div className="h-1.5 rounded-full" style={{ background: tema }} />
          <div className="h-1.5 rounded-full bg-slate-200" />
          <div className="h-1.5 rounded-full bg-slate-200" />
        </div>
        <div className="flex-1 rounded-lg p-1.5 flex gap-1.5 flex-wrap content-start" style={{ background: 'rgba(248,246,242,.72)' }}>
          <KartuMini aksen={aksen} lebar="31%" /><KartuMini aksen={aksen} lebar="31%" /><KartuMini aksen={aksen} lebar="31%" />
        </div>
      </div>
    </div>
  );
}

function PratinjauMatte({ form }: { form: Merek }) {
  const aksen = hexAman(form.warnaMatte, MEREK_BAWAAN.warnaMatte);
  const dasar = hexAman(form.warnaBingkaiMatte, MEREK_BAWAAN.warnaBingkaiMatte);
  const atas = `color-mix(in srgb, ${aksen} 22%, ${dasar})`;
  const bawah = `color-mix(in srgb, ${dasar} 62%, #000)`;
  const bergambar = form.latarMatte === 'gambar' && form.gambarLatarMatte;
  const lapisan = `linear-gradient(165deg, color-mix(in srgb, ${atas} 84%, transparent), color-mix(in srgb, ${bawah} 92%, transparent))`;
  return (
    <div aria-hidden="true" className="rounded-xl overflow-hidden border border-slate-200 h-32 p-2 flex flex-col gap-1.5"
      style={{ background: bergambar ? `${lapisan}, url(${form.gambarLatarMatte}) center / cover no-repeat` : `linear-gradient(165deg, ${atas}, ${bawah})`, backgroundColor: bawah }}>
      <div className="h-3 flex items-center gap-1"><div className="h-2 w-12 rounded-full bg-white/80" /><div className="ml-auto h-2.5 w-10 rounded-full bg-white/95" /></div>
      <div className="flex-1 flex gap-1.5 min-h-0">
        <div className="w-10 p-0.5 space-y-1">
          <div className="h-1.5 rounded-full bg-white/40" />
          <div className="h-1.5 rounded-full bg-white/15" />
          <div className="h-1.5 rounded-full bg-white/15" />
        </div>
        <div className="flex-1 rounded-lg p-1.5 flex gap-1.5 flex-wrap content-start" style={{ background: '#f7f9fd' }}>
          <KartuMini aksen={aksen} lebar="31%" /><KartuMini aksen={aksen} lebar="31%" /><KartuMini aksen={aksen} lebar="31%" />
        </div>
      </div>
    </div>
  );
}
