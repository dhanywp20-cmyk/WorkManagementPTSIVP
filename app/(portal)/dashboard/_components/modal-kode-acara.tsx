'use client';

import { appBaseUrl } from '@/lib/app-url';
import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth/sesi';
import { logAudit } from '@/lib/audit';
import { ConfirmDialog, type ConfirmState } from '@/components/shared';
import type { User } from './shared';
import { IkonTeks } from '@/components/shared/Ikon';
import { DaftarAkunEvent } from './DaftarAkunEvent';

export interface AkunEvent {
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

export const tglSingkat = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function keInputLokal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function acakKode(): string {
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
  const [asalUrl, setAsalUrl] = useState('');
  const [gambarQr, setGambarQr] = useState<string | null>(null);
  const [disalin, setDisalin] = useState(false);
  useEffect(() => { setAsalUrl(appBaseUrl()); }, []);

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

  const linkDaftar = asalUrl && awal?.kode?.trim()
    ? `${asalUrl}/dashboard?kode=${encodeURIComponent(awal.kode.trim())}`
    : '';

  useEffect(() => {
    if (!linkDaftar) { setGambarQr(null); return; }
    let batal = false;
    QRCode.toDataURL(linkDaftar, { width: 240, margin: 1, color: { dark: '#312E81', light: '#FFFFFF' } })
      .then(url => { if (!batal) setGambarQr(url); })
      .catch(() => { if (!batal) setGambarQr(null); });
    return () => { batal = true; };
  }, [linkDaftar]);

  const salinLink = async () => {
    try {
      await navigator.clipboard.writeText(linkDaftar);
      setDisalin(true);
      window.setTimeout(() => setDisalin(false), 2000);
    } catch {
      setPesan({ tipe: 'galat', teks: 'Gagal menyalin link. Salin manual dari kotak di atas.' });
    }
  };

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
        if (error) { setPesan({ tipe: 'galat', teks: `Gagal menghapus akun: ${error.message}` }); return; }
        setPesan({ tipe: 'ok', teks: `Akun "${nama || ''}" dihapus.` });
        const admin = getSession<User>();
        void logAudit({ user_id: admin?.id ?? '', user_name: admin?.full_name ?? '', action: 'delete', module: 'user', target_id: id });
        void ambil();
      },
    });
  };

  if (muat) return <div className="p-6 text-sm text-slate-500">Memuat pengaturan…</div>;
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-5">

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

          <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white cursor-pointer">
            <input
              id="kode-acara-aktif"
              type="checkbox"
              checked={form.aktif}
              onChange={e => setForm({ ...form, aktif: e.target.checked })}
              className="w-5 h-5 mt-0.5 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-400 shrink-0"
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
                className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono tracking-wider outline-hidden focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setLihatKode(v => !v)}
                  className="px-3 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all whitespace-nowrap">
                  {lihatKode ? '🙈 Sembunyikan' : '👁 Lihat'}
                </button>
                <button type="button" onClick={() => { setForm({ ...form, kode: acakKode() }); setLihatKode(true); }}
                  className="px-3 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all whitespace-nowrap">
                  <IkonTeks nama="🎲" />Acak
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Minimal 6 karakter. Tombol Acak menghindari 0/O dan 1/I/L — pasangan yang paling sering tertukar saat kode
              dibacakan lalu diketik ulang di ponsel.
            </p>
          </div>

          <div>
            <label htmlFor="kode-acara-sampai" className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">
              Berlaku Sampai <span className="text-slate-500 normal-case tracking-normal font-medium">(opsional)</span>
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
                className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-hidden focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
              {form.berlakuSampai && (
                <button type="button" onClick={() => setForm({ ...form, berlakuSampai: null })}
                  className="px-3 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all whitespace-nowrap">
                  ✕ Kosongkan
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Lewat waktu ini kode ditolak walau saklarnya masih menyala. Kosong = berlaku sampai kamu mematikannya
              sendiri — yang gampang terlupa setelah acara bubar.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label className="block text-xs font-bold mb-1.5 text-slate-600 tracking-widest uppercase">
              Link &amp; QR Code Pendaftaran
            </label>
            {!awal?.kode?.trim() ? (
              <p className="text-sm text-slate-500">Isi dan simpan Kode Acara dulu untuk membuat link pendaftarannya.</p>
            ) : (
              <div className="flex flex-col sm:flex-row items-start gap-4">
                {gambarQr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={gambarQr} alt="QR Code pendaftaran" width={128} height={128}
                    className="w-32 h-32 rounded-lg border border-slate-200 shrink-0" />
                ) : (
                  <div className="w-32 h-32 rounded-lg border border-slate-200 flex items-center justify-center text-[11px] text-slate-500 shrink-0">
                    Membuat QR…
                  </div>
                )}
                <div className="flex-1 min-w-0 w-full space-y-2">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Cetak atau tampilkan QR ini di acara. Yang memindai dibawa ke halaman Masuk - cocok untuk
                    peserta yang sudah pernah daftar. Yang belum punya akun tinggal klik Daftar sendiri, Kode
                    Acara sudah terisi otomatis di situ.
                  </p>
                  <div className="flex flex-col formulir:flex-row gap-2">
                    <input readOnly value={linkDaftar} onFocus={e => e.target.select()}
                      aria-label="Link pendaftaran"
                      className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-600 bg-slate-50" />
                    <div className="flex gap-2">
                      <button type="button" onClick={salinLink}
                        className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all whitespace-nowrap">
                        {disalin ? '✓ Disalin' : '📋 Salin'}
                      </button>
                      {gambarQr && (
                        <a href={gambarQr} download={`qr-daftar-${awal.kode.trim()}.png`}
                          className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all whitespace-nowrap">
                          <IkonTeks nama="⬇" />Unduh QR
                        </a>
                      )}
                    </div>
                  </div>
                  {berubah && (
                    <p className="text-[11px] text-amber-700 font-semibold">
                      Link/QR ini memakai kode yang sudah TERSIMPAN, bukan perubahan di atas yang belum disimpan.
                    </p>
                  )}
                </div>
              </div>
            )}
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

        <DaftarAkunEvent daftar={daftar} ambil={ambil} muat={muat} handleDeleteAkun={handleDeleteAkun} menghapus={menghapus} />
      </div>

      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
    </div>
  );
}
