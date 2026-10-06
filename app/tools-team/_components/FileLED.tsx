'use client';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog, type ConfirmState } from '@/components/shared/ConfirmDialog';
import { Ikon } from '@/components/shared/Ikon';
import type { RingkasanLED } from '@/lib/tools-team';
import { f } from './ui';

const API = '/api/tools-team/led';

export interface FileAktifLED { id: string; nama: string; bolehUbah: boolean }
interface Baris {
  id: string; nama: string; ringkasan: Partial<RingkasanLED>; dibuat_oleh_nama: string; diubah_oleh_nama: string;
  updated_at: string; bolehUbah: boolean;
}

const tgl = (x: string) => new Date(x).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Simpan & buka hitungan Kalkulator LED (dibagikan ke seluruh tim). Satu modal
 * untuk dua keperluan: `mode` 'simpan' menampilkan kolom nama + tombol simpan
 * di atas daftar; 'buka' hanya daftar.
 */
export function FileLED({ mode, onTutup, isian, ringkasan, namaAwal, fileAktif, onBuka, onTersimpan }: {
  mode: 'buka' | 'simpan' | null; onTutup: () => void;
  isian: Record<string, unknown>; ringkasan: RingkasanLED; namaAwal: string;
  fileAktif: FileAktifLED | null;
  onBuka: (data: Record<string, unknown>, file: FileAktifLED) => void;
  onTersimpan: (file: FileAktifLED) => void;
}) {
  const [q, setQ] = useState('');
  const [daftar, setDaftar] = useState<Baris[] | null>(null);
  const [nama, setNama] = useState('');
  const [status, setStatus] = useState<{ teks: string; galat: boolean } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [segar, setSegar] = useState(0);
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);

  useEffect(() => { if (mode) { setNama(fileAktif?.nama || namaAwal); setStatus(null); } }, [mode, fileAktif, namaAwal]);

  useEffect(() => {
    if (!mode) return;
    let hidup = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`, { credentials: 'include', cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (!hidup) return;
        if (r.ok && j?.ok) setDaftar(j.daftar); else { setDaftar([]); setStatus({ teks: j?.alasan ?? 'Daftar tidak bisa dimuat.', galat: true }); }
      } catch { if (hidup) { setDaftar([]); setStatus({ teks: 'Tidak terhubung ke server.', galat: true }); } }
    }, q ? 300 : 0);
    return () => { hidup = false; clearTimeout(t); };
  }, [mode, q, segar]);

  const simpan = async (baru: boolean) => {
    const n = nama.trim() || 'Kalkulasi LED';
    const timpa = !baru && fileAktif?.bolehUbah ? fileAktif.id : undefined;
    setSibuk(true); setStatus(null);
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: timpa, nama: n, data: isian, ringkasan }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setStatus({ teks: j?.alasan ?? 'Gagal menyimpan.', galat: true }); return; }
      onTersimpan({ id: j.file.id, nama: j.file.nama, bolehUbah: true });
      setStatus({ teks: timpa ? 'Perubahan tersimpan.' : fileAktif && !baru ? 'Milik orang lain - disimpan sebagai salinan Anda.' : 'Tersimpan.', galat: false });
      setSegar(x => x + 1);
    } catch { setStatus({ teks: 'Tidak terhubung ke server.', galat: true }); } finally { setSibuk(false); }
  };

  const buka = async (d: Baris) => {
    setSibuk(true); setStatus(null);
    try {
      const r = await fetch(`${API}?id=${encodeURIComponent(d.id)}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setStatus({ teks: j?.alasan ?? 'Tidak bisa dibuka.', galat: true }); return; }
      onBuka(j.file.data as Record<string, unknown>, { id: j.file.id, nama: j.file.nama, bolehUbah: !!j.file.bolehUbah });
      onTutup();
    } catch { setStatus({ teks: 'Tidak terhubung ke server.', galat: true }); } finally { setSibuk(false); }
  };

  const hapus = (d: Baris) => setKonfirmasi({
    message: `Hapus "${d.nama}"?`, description: 'Seluruh tim tidak bisa membukanya lagi.', danger: true, confirmLabel: 'Hapus',
    onConfirm: () => void hapusYa(d),
  });
  const hapusYa = async (d: Baris) => {
    const r = await fetch(`${API}?id=${encodeURIComponent(d.id)}`, { method: 'DELETE', credentials: 'include' }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r?.ok || !j?.ok) { setStatus({ teks: j?.alasan ?? 'Gagal menghapus.', galat: true }); return; }
    setSegar(x => x + 1);
  };

  return (
    <>
    <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    <Modal buka={!!mode} onTutup={onTutup} judul={mode === 'simpan' ? 'Simpan hitungan LED' : 'Buka hitungan LED'} ukuran="md"
      ikon={<Ikon nama={mode === 'simpan' ? '💾' : '📁'} ukuran={18} />}
      keterangan="Hitungan tersimpan di server dan bisa dibuka seluruh tim. Referensi modul/hardware tidak ikut disimpan.">
      {mode === 'simpan' && (
        <div className="flex gap-2 flex-wrap mb-3">
          <input value={nama} onChange={e => setNama(e.target.value)} placeholder="Nama hitungan" aria-label="Nama hitungan"
            className="flex-1 min-w-[160px] rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" />
          <button type="button" disabled={sibuk} onClick={() => void simpan(false)}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50">
            {fileAktif?.bolehUbah ? 'Simpan perubahan' : 'Simpan'}
          </button>
          {fileAktif && (
            <button type="button" disabled={sibuk} onClick={() => void simpan(true)}
              className="px-3 py-2 rounded-xl text-sm font-bold text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:opacity-50">Simpan sebagai baru</button>
          )}
        </div>
      )}
      {status && <p className={`mb-2 text-[12.5px] font-semibold ${status.galat ? 'text-rose-700' : 'text-emerald-700'}`}>{status.teks}</p>}
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama, project, customer, atau pembuat" aria-label="Cari hitungan"
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm mb-2" />
      {daftar === null ? <p className="text-sm text-slate-500">Memuat...</p> : daftar.length === 0 ? (
        <p className="text-sm text-slate-500">{q ? 'Tidak ada yang cocok.' : 'Belum ada hitungan tersimpan.'}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {daftar.map(d => {
            const r = d.ringkasan ?? {};
            return (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                <button type="button" disabled={sibuk} onClick={() => void buka(d)} className="min-w-0 text-left">
                  <span className="block text-[13px] font-bold text-blue-700 hover:underline truncate">
                    {d.nama}{fileAktif?.id === d.id && <span className="ml-1 text-[11px] text-emerald-700">· terbuka</span>}
                  </span>
                  <span className="block text-[11.5px] text-slate-600 truncate">
                    {[r.project, r.customer].filter(Boolean).join(' · ') || '—'}
                    {r.kode ? ` · ${r.kode} ${f(r.lebarM ?? 0)} × ${f(r.tinggiM ?? 0)} m` : ''}{r.resX ? ` · ${r.resX}×${r.resY} px` : ''}
                    {(r.screen ?? 1) > 1 ? ` · ${r.screen} screen` : ''}
                  </span>
                  <span className="block text-[11px] text-slate-500 truncate">{d.diubah_oleh_nama || d.dibuat_oleh_nama || '—'} · {tgl(d.updated_at)}</span>
                </button>
                {d.bolehUbah && (
                  <button type="button" aria-label={`Hapus ${d.nama}`} onClick={() => void hapus(d)}
                    className="w-7 h-7 flex-shrink-0 grid place-items-center rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-50"><Ikon nama="🗑" ukuran={14} /></button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
    </>
  );
}
