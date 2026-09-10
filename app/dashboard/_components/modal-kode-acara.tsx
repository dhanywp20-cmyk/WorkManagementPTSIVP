'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Pengaturan pendaftaran lewat Kode Acara.
 *
 * Dulu ini hidup sebagai REGISTER_BYPASS_* di Vercel: membuka pendaftaran
 * untuk satu acara berarti menyunting variabel lingkungan lalu menunggu deploy
 * ulang, dan menutupnya kembali menuntut hal yang sama sekali lagi. Panitia
 * yang butuh mengubahnya di pagi hari acara harus menunggu orang yang punya
 * akses Vercel.
 *
 * Semua isian di sini lewat /api/admin/kode-acara, TIDAK langsung ke tabel
 * seperti pengaturan lain. Alasannya di route itu: kodenya rahasia, dan
 * kuncinya disimpan dengan nama yang membuat policy basis data menolak
 * peramban membacanya. Jadi jangan ubah layar ini untuk membaca app_settings
 * langsung - yang kembali cuma kosong.
 */

interface Pengaturan {
  aktif: boolean;
  kode: string;
  berlakuSampai: string | null;
  dariEnv?: boolean;
  jumlahAkunEvent?: number;
}

/** ISO -> nilai untuk <input type="datetime-local"> di zona waktu pemakai. */
function keInputLokal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function acakKode(): string {
  //  Tanpa 0/O/1/I/L: kode ini dibacakan panitia dan diketik ulang peserta di
  //  ponsel, dan pasangan itulah yang paling sering tertukar.
  const huruf = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let hasil = '';
  const acak = new Uint32Array(10);
  crypto.getRandomValues(acak);
  for (let i = 0; i < 10; i++) hasil += huruf[acak[i] % huruf.length];
  return hasil;
}

export function KodeAcaraInline() {
  const [form, setForm] = useState<Pengaturan | null>(null);
  const [awal, setAwal] = useState<Pengaturan | null>(null);
  const [muat, setMuat] = useState(true);
  const [simpan, setSimpan] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'galat'; teks: string } | null>(null);
  const [lihatKode, setLihatKode] = useState(false);

  const ambil = useCallback(async () => {
    setMuat(true);
    try {
      const res = await fetch('/api/admin/kode-acara', { credentials: 'include' });
      const isi = await res.json();
      if (!res.ok) { setPesan({ tipe: 'galat', teks: isi.error ?? 'Gagal memuat pengaturan.' }); return; }
      setForm(isi); setAwal(isi);
    } catch {
      setPesan({ tipe: 'galat', teks: 'Gagal menghubungi server.' });
    } finally { setMuat(false); }
  }, []);
  useEffect(() => { ambil(); }, [ambil]);

  const berubah = form && awal && (
    form.aktif !== awal.aktif || form.kode !== awal.kode || form.berlakuSampai !== awal.berlakuSampai
  );

  const kirim = async () => {
    if (!form) return;
    setSimpan(true); setPesan(null);
    try {
      const res = await fetch('/api/admin/kode-acara', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aktif: form.aktif, kode: form.kode.trim(), berlakuSampai: form.berlakuSampai }),
      });
      const isi = await res.json();
      if (!res.ok) { setPesan({ tipe: 'galat', teks: isi.error ?? 'Gagal menyimpan.' }); return; }
      const baru = { ...form, kode: form.kode.trim(), dariEnv: false };
      setForm(baru); setAwal(baru);
      setPesan({ tipe: 'ok', teks: 'Tersimpan. Berlaku seketika — tidak perlu deploy ulang.' });
    } catch {
      setPesan({ tipe: 'galat', teks: 'Gagal menghubungi server.' });
    } finally { setSimpan(false); }
  };

  if (muat) return <div className="p-6 text-sm text-slate-400">Memuat pengaturan…</div>;
  if (!form) {
    return (
      <div className="p-6">
        <div className="px-4 py-3 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-200">
          {pesan?.teks ?? 'Pengaturan tidak bisa dimuat.'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl">

      {/* Apa yang sebenarnya dilakukan saklar ini - disebut apa adanya, karena
          yang dilewati adalah persetujuan admin, bukan sekadar "kemudahan". */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-bold text-amber-900 mb-1">Apa yang dilakukan kode ini</p>
        <p className="text-xs text-amber-800 leading-relaxed">
          Siapa pun yang memegang kode ini bisa mendaftar dan <strong>langsung aktif tanpa persetujuan admin</strong>.
          Divisi dan jabatan tetap diisi sendiri oleh pendaftar seperti biasa. Matikan lagi setelah acara selesai,
          atau isi tanggal berlakunya supaya ia menutup sendiri.
        </p>
      </div>

      {form.dariEnv && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-xs text-sky-900 leading-relaxed">
            <strong>Nilai ini masih dibaca dari variabel lingkungan Vercel</strong> (REGISTER_BYPASS_*), karena belum
            pernah disimpan dari layar ini. Begitu kamu menekan Simpan, yang dipakai adalah nilai di sini dan
            variabel lingkungannya tidak lagi berpengaruh — kamu boleh menghapusnya dari Vercel setelah itu.
          </p>
        </div>
      )}

      {/* Saklar utama */}
      <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white cursor-pointer">
        <input
          id="kode-acara-aktif"
          type="checkbox"
          checked={form.aktif}
          onChange={e => setForm({ ...form, aktif: e.target.checked })}
          className="w-5 h-5 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 flex-shrink-0"
        />
        <span>
          <span className="block text-sm font-bold text-slate-800">Aktifkan pendaftaran lewat Kode Acara</span>
          <span className="block text-xs text-slate-500 mt-0.5">
            {form.aktif
              ? 'Menyala — pendaftar yang memasukkan kode di bawah langsung bisa login.'
              : 'Mati — semua pendaftar menunggu persetujuan admin seperti biasa.'}
          </span>
        </span>
      </label>

      {/* Kode */}
      <div>
        <label htmlFor="kode-acara-nilai" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">
          Kode Acara
        </label>
        <div className="flex flex-col formulir:flex-row gap-2">
          <input
            id="kode-acara-nilai"
            type={lihatKode ? 'text' : 'password'}
            value={form.kode}
            onChange={e => setForm({ ...form, kode: e.target.value })}
            placeholder="mis. IVPEXPO2026"
            autoComplete="off"
            className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono tracking-wider outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setLihatKode(v => !v)}
              className="px-3 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all whitespace-nowrap">
              {lihatKode ? '🙈 Sembunyikan' : '👁 Lihat'}
            </button>
            <button type="button" onClick={() => { setForm({ ...form, kode: acakKode() }); setLihatKode(true); }}
              className="px-3 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all whitespace-nowrap">
              🎲 Acak
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">
          Minimal 6 karakter. Tombol Acak menghindari 0/O dan 1/I/L — pasangan yang paling sering tertukar saat kode
          dibacakan lalu diketik ulang di ponsel.
        </p>
      </div>

      {/* Berlaku sampai */}
      <div>
        <label htmlFor="kode-acara-sampai" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">
          Berlaku Sampai <span className="text-slate-400 normal-case tracking-normal font-medium">(opsional)</span>
        </label>
        <div className="flex flex-col formulir:flex-row gap-2">
          <input
            id="kode-acara-sampai"
            type="datetime-local"
            value={keInputLokal(form.berlakuSampai)}
            onChange={e => setForm({
              ...form,
              berlakuSampai: e.target.value ? new Date(e.target.value).toISOString() : null,
            })}
            className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
          {form.berlakuSampai && (
            <button type="button" onClick={() => setForm({ ...form, berlakuSampai: null })}
              className="px-3 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all whitespace-nowrap">
              ✕ Kosongkan
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">
          Lewat waktu ini kode ditolak walau saklarnya masih menyala. Kosong = berlaku sampai kamu mematikannya
          sendiri — yang gampang terlupa setelah acara bubar.
        </p>
      </div>

      {/* Berapa yang sudah masuk lewat jalur ini */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-3">
        <span className="text-2xl">🎓</span>
        <div>
          <p className="text-sm font-bold text-slate-800">
            {form.jumlahAkunEvent ?? 0} akun terdaftar lewat kode acara
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Ditandai <code className="font-mono">daftar_via_event</code> di basis data, jadi tetap bisa dibedakan dari
            akun biasa walau divisi dan timnya terisi normal.
          </p>
        </div>
      </div>

      {pesan && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium border ${
          pesan.tipe === 'ok'
            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
            : 'text-red-700 bg-red-50 border-red-200'
        }`}>
          {pesan.teks}
        </div>
      )}

      <div className="flex flex-col formulir:flex-row gap-2 formulir:items-center">
        <button
          type="button"
          onClick={kirim}
          disabled={!berubah || simpan}
          className="px-5 py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700"
        >
          {simpan ? 'Menyimpan…' : 'Simpan Pengaturan'}
        </button>
        {berubah && !simpan && (
          <span className="text-xs text-amber-700 font-semibold">Ada perubahan yang belum disimpan.</span>
        )}
      </div>
    </div>
  );
}
