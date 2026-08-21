'use client';
import React, { useEffect, useState } from 'react';
import {
  Merek, MEREK_BAWAAN, merek as merekSekarang, divisiSales, muatMerek,
  simpanMerek, simpanDivisi, divisiTerpakai, rapikanDivisi, warnaTembus,
} from '@/lib/merek';

/**
 * Bagian "Merek & Divisi" pada Admin Panel.
 *
 * Dua hal yang selama ini hanya bisa diubah lewat deploy: identitas tampilan
 * platform (logo, nama, warna, latar) dan daftar divisi sales. Keduanya
 * disimpan di app_settings - lihat lib/merek.ts.
 */
export function MerekSettingInline() {
  const [form, setForm] = useState<Merek>(MEREK_BAWAAN);
  const [divisi, setDivisi] = useState<string[]>([]);
  const [divisiBaru, setDivisiBaru] = useState('');
  const [terpakai, setTerpakai] = useState<Record<string, number>>({});
  const [menyimpan, setMenyimpan] = useState<'merek' | 'divisi' | null>(null);
  const [kabar, setKabar] = useState<{ jenis: 'ok' | 'gagal'; teks: string } | null>(null);
  const [siap, setSiap] = useState(false);

  const beritahu = (jenis: 'ok' | 'gagal', teks: string) => {
    setKabar({ jenis, teks });
    setTimeout(() => setKabar(null), 4000);
  };

  useEffect(() => {
    void muatMerek().then(() => {
      setForm(merekSekarang());
      setDivisi(divisiSales());
      setSiap(true);
    });
    void divisiTerpakai().then(setTerpakai);
  }, []);

  const ubah = (kunci: keyof Merek, nilai: string) => setForm(f => ({ ...f, [kunci]: nilai }));

  const simpanTampilan = async () => {
    setMenyimpan('merek');
    const { error } = await simpanMerek(form);
    setMenyimpan(null);
    if (error) beritahu('gagal', 'Gagal menyimpan: ' + error);
    else beritahu('ok', 'Tampilan tersimpan. Header & halaman login langsung ikut berubah.');
  };

  const tambahDivisi = () => {
    const nilai = divisiBaru.trim();
    if (!nilai) return;
    if (divisi.some(d => d.toLowerCase() === nilai.toLowerCase())) {
      beritahu('gagal', `"${nilai}" sudah ada di daftar.`);
      return;
    }
    setDivisi(d => [...d, nilai]);
    setDivisiBaru('');
  };

  const hapusDivisi = (nama: string) => {
    // Divisi yang masih tercatat di akun orang TIDAK dihapus diam-diam:
    // dropdown profil mereka akan tampil kosong dan penyaringan per divisi
    // berhenti menemukan pekerjaannya.
    const jumlah = terpakai[nama] ?? 0;
    if (jumlah > 0) {
      beritahu('gagal', `"${nama}" masih dipakai ${jumlah} akun. Pindahkan akunnya dulu.`);
      return;
    }
    setDivisi(d => d.filter(x => x !== nama));
  };

  const simpanDaftarDivisi = async () => {
    setMenyimpan('divisi');
    const { error } = await simpanDivisi(divisi);
    setMenyimpan(null);
    if (error) beritahu('gagal', 'Gagal menyimpan: ' + error);
    else beritahu('ok', `${rapikanDivisi(divisi).length} divisi tersimpan.`);
  };

  if (!siap) {
    return <div className="p-6 text-sm text-slate-400">Memuat pengaturan…</div>;
  }

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

      {/* ── Pratinjau ── */}
      <section className="rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          <p className="text-xs font-bold tracking-widest uppercase text-slate-400">Pratinjau Header</p>
        </div>
        <div className="p-4 flex items-center gap-3 bg-white">
          <div className="rounded-xl shadow-md flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ width: 48, height: 48, background: `linear-gradient(135deg, ${form.warnaUtama}, ${form.warnaUtama2})` }}>
            {form.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={form.logoUrl} alt="" className="w-full h-full object-contain" />
              : <svg aria-hidden="true" className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-tight truncate">{form.namaPlatform || MEREK_BAWAAN.namaPlatform}</h1>
              <span className="text-slate-300 font-light">|</span>
              <span className="text-sm font-bold tracking-wide whitespace-nowrap" style={{ color: form.warnaAksen }}>{form.namaPortal}</span>
            </div>
            <p className="text-slate-500 text-xs font-medium mt-0.5 truncate">{form.namaPerusahaan}</p>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="rounded-xl h-20 flex items-end p-3 bg-cover bg-center"
            style={{ backgroundImage: `url(${form.gambarLatar})` }}>
            <div className="rounded-lg px-3 py-1.5 text-white text-xs font-bold"
              style={{ background: `linear-gradient(135deg, ${warnaTembus(form.warnaUtama2, 0.82)}, ${warnaTembus(form.warnaUtama2, 0.86)})` }}>
              Panel kiri halaman login
            </div>
          </div>
        </div>
      </section>

      {/* ── Tampilan ── */}
      <section className="rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Identitas Tampilan</h3>
          <p className="text-slate-500 text-xs mt-0.5">Dikosongkan = pakai nilai bawaan.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Isian label="Nama Platform" nilai={form.namaPlatform} bawaan={MEREK_BAWAAN.namaPlatform} onChange={v => ubah('namaPlatform', v)} />
          <Isian label="Nama Platform (layar sempit)" nilai={form.namaPlatformSingkat} bawaan={MEREK_BAWAAN.namaPlatformSingkat} onChange={v => ubah('namaPlatformSingkat', v)} />
          <Isian label="Nama Portal" nilai={form.namaPortal} bawaan={MEREK_BAWAAN.namaPortal} onChange={v => ubah('namaPortal', v)} />
          <Isian label="Nama Perusahaan" nilai={form.namaPerusahaan} bawaan={MEREK_BAWAAN.namaPerusahaan} onChange={v => ubah('namaPerusahaan', v)} />
          <Isian label="URL Logo" nilai={form.logoUrl} bawaan="(ikon gedung bawaan)" span2 onChange={v => ubah('logoUrl', v)} />
          <Isian label="URL Gambar Latar Login" nilai={form.gambarLatar} bawaan={MEREK_BAWAAN.gambarLatar} span2 onChange={v => ubah('gambarLatar', v)} />
          <Isian label="Judul Panel Login" nilai={form.judulLogin} bawaan={MEREK_BAWAAN.judulLogin} span2 onChange={v => ubah('judulLogin', v)} />
          <Isian label="Subjudul Panel Login" nilai={form.subjudulLogin} bawaan={MEREK_BAWAAN.subjudulLogin} span2 onChange={v => ubah('subjudulLogin', v)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Warna label="Warna Utama" nilai={form.warnaUtama} onChange={v => ubah('warnaUtama', v)} />
          <Warna label="Warna Utama 2 (gradasi)" nilai={form.warnaUtama2} onChange={v => ubah('warnaUtama2', v)} />
          <Warna label="Warna Aksen (label portal)" nilai={form.warnaAksen} onChange={v => ubah('warnaAksen', v)} />
        </div>

        <div className="flex flex-wrap gap-2 justify-end pt-1">
          <button type="button" onClick={() => setForm(MEREK_BAWAAN)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all">
            Kembalikan ke bawaan
          </button>
          <button type="button" onClick={simpanTampilan} disabled={menyimpan !== null}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${form.warnaUtama}, ${form.warnaUtama2})` }}>
            {menyimpan === 'merek' ? 'Menyimpan…' : 'Simpan Tampilan'}
          </button>
        </div>
      </section>

      {/* ── Divisi sales ── */}
      <section className="rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Divisi Sales <span className="text-slate-400 font-semibold">· {divisi.length}</span></h3>
          <p className="text-slate-500 text-xs mt-0.5">
            Dipakai di seluruh dropdown divisi: Ticketing, Request Schedule, Request Design Project, Piket Showroom, dan pendaftaran akun.
          </p>
        </div>

        <div className="flex gap-2">
          <input value={divisiBaru} onChange={e => setDivisiBaru(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); tambahDivisi(); } }}
            placeholder="Nama divisi baru…"
            className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-slate-400 bg-white" />
          <button type="button" onClick={tambahDivisi}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${form.warnaUtama}, ${form.warnaUtama2})` }}>
            Tambah
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {divisi.map(d => {
            const jumlah = terpakai[d] ?? 0;
            return (
              <span key={d} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-700">
                {d}
                {jumlah > 0 && <span className="text-[10px] font-bold text-slate-400">{jumlah} akun</span>}
                <button type="button" onClick={() => hapusDivisi(d)} title={jumlah > 0 ? `Masih dipakai ${jumlah} akun` : `Hapus ${d}`}
                  className="w-5 h-5 rounded-lg flex items-center justify-center transition-all"
                  style={jumlah > 0
                    ? { color: '#cbd5e1', cursor: 'not-allowed' }
                    : { color: '#94a3b8', background: 'rgba(0,0,0,0.04)' }}>
                  <svg aria-hidden="true" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            );
          })}
        </div>

        <div className="flex justify-end pt-1">
          <button type="button" onClick={simpanDaftarDivisi} disabled={menyimpan !== null || divisi.length === 0}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${form.warnaUtama}, ${form.warnaUtama2})` }}>
            {menyimpan === 'divisi' ? 'Menyimpan…' : 'Simpan Daftar Divisi'}
          </button>
        </div>
      </section>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        Perubahan tersimpan di database, bukan di kode - jadi berlaku untuk semua orang tanpa perlu deploy ulang.
        Halaman yang sedang terbuka di perangkat lain ikut berubah setelah dimuat ulang.
      </p>
    </div>
  );
}

function Isian({ label, nilai, bawaan, span2, onChange }: {
  label: string; nilai: string; bawaan: string; span2?: boolean; onChange: (v: string) => void;
}) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase text-slate-400">{label}</label>
      <input value={nilai} onChange={e => onChange(e.target.value)} placeholder={bawaan}
        className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-slate-400 bg-white" />
    </div>
  );
}

function Warna({ label, nilai, onChange }: { label: string; nilai: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase text-slate-400">{label}</label>
      <div className="flex gap-2">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(nilai) ? nilai : '#000000'}
          onChange={e => onChange(e.target.value)} aria-label={label}
          className="w-11 h-10 rounded-xl border border-slate-200 bg-white p-1 cursor-pointer flex-shrink-0" />
        <input value={nilai} onChange={e => onChange(e.target.value)} placeholder="#e11d48"
          className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-slate-400 bg-white" />
      </div>
    </div>
  );
}
