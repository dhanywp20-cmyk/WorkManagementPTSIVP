'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { ConfirmDialog, type ConfirmState } from '@/components/shared';
import type { User } from './shared';

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

interface AkunEvent {
  id: string;
  full_name: string | null;
  username: string | null;
  sales_division: string | null;
  team_type: string | null;
  jabatan: string | null;
  created_at: string | null;
}

interface Pengaturan {
  aktif: boolean;
  kode: string;
  berlakuSampai: string | null;
  dariEnv?: boolean;
  jumlahAkunEvent?: number;
  daftarAkun?: AkunEvent[];
}

const tglSingkat = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

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
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [menghapus, setMenghapus] = useState<string | null>(null);

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

  //  Sama seperti hapus akun di modal-akun.tsx: langsung ke tabel users (RLS
  //  sudah mengizinkan admin), bukan lewat /api/admin/kode-acara - route itu
  //  cuma mengurus kode & tanggalnya, bukan akun orangnya.
  const handleDeleteAkun = (id: string, nama: string) => {
    setConfirmState({
      message: `Hapus akun "${nama || 'ini'}"?`,
      description: 'Akun ini terdaftar lewat kode acara. Tindakan ini tidak bisa dibatalkan.',
      danger: true,
      confirmLabel: 'Hapus',
      onConfirm: async () => {
        setMenghapus(id);
        const { error } = await supabase.from('users').delete().eq('id', id).eq('daftar_via_event', true);
        setMenghapus(null);
        //  Pesan asli disertakan - lihat catatan yang sama di modal-akun.tsx.
        if (error) { setPesan({ tipe: 'galat', teks: `Gagal menghapus akun: ${error.message}` }); return; }
        setPesan({ tipe: 'ok', teks: `Akun "${nama || ''}" dihapus.` });
        const admin = getSession<User>();
        void logAudit({ user_id: admin?.id ?? '', user_name: admin?.full_name ?? '', action: 'delete', module: 'user', target_id: id });
        void ambil();
      },
    });
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

  const daftar = form.daftarAkun ?? [];

  return (
    <div className="p-4 sm:p-6">
      {pesan && (
        <div className={`mb-5 px-4 py-3 rounded-xl text-sm font-medium border ${
          pesan.tipe === 'ok'
            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
            : 'text-red-700 bg-red-50 border-red-200'
        }`}>
          {pesan.teks}
        </div>
      )}

      {/* Kiri: pengaturan saklar & kode. Kanan: daftar pendaftar - kolom
          sendiri supaya bisa bergulir sendiri tanpa menyeret form di
          sebelahnya, sesuai permintaan: "list di samping kanan saja
          supaya ideal untuk di scroll". */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-5">

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

        {/* ── Ringkasan pendaftar acara ── */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)]">
          <div className="flex items-center gap-3 p-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
            <span className="text-2xl">🎓</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800">
                {daftar.length} akun terdaftar lewat kode acara
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Ditandai <code className="font-mono text-[11px]">daftar_via_event</code> di kolomnya sendiri — bukan
                di dalam divisi atau tim — jadi akunnya tetap terdata persis seperti akun yang dibuat admin.
              </p>
            </div>
            {/*  Panel ini tidak ikut ke-refresh otomatis saat ada yang
                mendaftar lewat kode acara di tab lain - tanpa tombol ini
                satu-satunya cara melihat pendaftar terbaru adalah memuat
                ulang seluruh URL Admin Panel. */}
            <button type="button" onClick={() => ambil()} disabled={muat} title="Muat ulang daftar pendaftar"
              aria-label="Muat ulang daftar pendaftar"
              className="w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <svg aria-hidden="true" focusable="false" className={`w-4 h-4 ${muat ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {daftar.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">Belum ada yang mendaftar lewat kode acara.</p>
          ) : (
            <>
              {/* Daftar namanya sendiri - bergulir sendiri, lepas dari form
                  di kolom kiri, supaya panel tidak memanjang tak terbatas
                  saat satu acara membawa puluhan peserta. */}
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white border-b border-slate-200">
                    <tr>
                      <th className="text-left font-bold text-slate-500 uppercase tracking-widest px-3 py-2">Nama</th>
                      <th className="text-left font-bold text-slate-500 uppercase tracking-widest px-3 py-2">Divisi</th>
                      <th className="text-left font-bold text-slate-500 uppercase tracking-widest px-3 py-2">Daftar</th>
                      <th className="px-3 py-2" aria-label="Aksi" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {daftar.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-semibold text-slate-800">
                          {a.full_name || '—'}
                          {a.username && <span className="block font-normal text-slate-400 truncate">{a.username}</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {a.sales_division || a.team_type || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap tabular-nums">{tglSingkat(a.created_at)}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteAkun(a.id, a.full_name || a.username || '')}
                            disabled={menghapus === a.id}
                            title="Hapus akun ini"
                            className="text-red-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
    </div>
  );
}
