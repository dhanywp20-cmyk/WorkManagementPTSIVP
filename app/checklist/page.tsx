'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Link2, Search, Trash2, Upload } from 'lucide-react';
import { getSession, startSessionWatcher } from '@/lib/auth';
import type { User } from '@/app/dashboard/_components/shared';
import {
  ConfirmDialog, EmptyState, Modal, PageHeader, StatCardGrid, Toast, TombolModal,
  type ConfirmState, type Notif,
} from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import {
  BATAS, bolehKelolaChecklist, formatWaktu, progresDari,
  type ChecklistDaftar, type ChecklistRingkas, type DraftChecklist,
} from '@/lib/checklist';
import { ModalImpor } from './_components/ModalImpor';
import { ModalShare } from './_components/ModalShare';
import { DetailChecklist } from './_components/DetailChecklist';
import { BarProgres, TEMA, fontAngka } from './_components/tampilan';

async function panggil<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `Gagal (${res.status})`);
  return json as T;
}

type Saring = 'semua' | 'berjalan' | 'selesai' | 'link';

/**
 * Checklist Tools - untuk admin dan akun yang diberi menu ini di Admin Panel.
 *
 * Pengelola mengimpor checklist pekerjaan (tempel teks/Markdown atau Excel)
 * tanpa mengetik item satu per satu, lalu membagikan link ke tim lain yang
 * cukup mencentang dari HP tanpa login. Penjaga sesungguhnya ada di server
 * (lib/checklist-server.ts penjagaAkses); pemeriksaan di halaman ini hanya
 * supaya akun tanpa akses melihat penjelasan, bukan layar rusak.
 */
export default function ChecklistToolsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [siap, setSiap] = useState(false);
  const [daftar, setDaftar] = useState<ChecklistRingkas[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [cari, setCari] = useState('');
  const [saring, setSaring] = useState<Saring>('semua');
  const [dipilihId, setDipilihId] = useState<string | null>(null);
  const [imporBuka, setImporBuka] = useState(false);
  const [shareFor, setShareFor] = useState<ChecklistDaftar | null>(null);
  const [versiShare, setVersiShare] = useState(0);
  const [duplikat, setDuplikat] = useState<{ sumber: ChecklistDaftar; judul: string } | null>(null);
  const [menduplikat, setMenduplikat] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const [toast, setToast] = useState<Notif | null>(null);

  const beritahu = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    const u = getSession<User>();
    if (!u) {
      const target = window.top !== window ? window.top : window;
      if (target) target.location.href = '/dashboard';
      return;
    }
    setUser(u);
    setSiap(true);
    return startSessionWatcher();
  }, []);

  const admin = bolehKelolaChecklist(user);

  const muat = useCallback(async () => {
    try {
      const { daftar: d } = await panggil<{ daftar: ChecklistRingkas[] }>('/api/checklist');
      setDaftar(d);
      setGalat('');
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat checklist.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { if (admin) muat(); }, [admin, muat]);

  const statistik = useMemo(() => ({
    total: daftar.length,
    selesai: daftar.filter(d => d.total > 0 && d.selesai === d.total).length,
    berjalan: daftar.filter(d => d.total === 0 || d.selesai < d.total).length,
    link: daftar.filter(d => d.share_aktif).length,
  }), [daftar]);

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return daftar
      .filter(d => !q || d.judul.toLowerCase().includes(q))
      .filter(d => saring === 'semua'
        || (saring === 'selesai' && d.total > 0 && d.selesai === d.total)
        || (saring === 'berjalan' && (d.total === 0 || d.selesai < d.total))
        || (saring === 'link' && d.share_aktif))
      // Yang belum selesai di atas: itulah yang perlu dipantau.
      .sort((a, b) => Number(a.total > 0 && a.selesai === a.total) - Number(b.total > 0 && b.selesai === b.total)
        || b.updated_at.localeCompare(a.updated_at));
  }, [daftar, cari, saring]);

  const simpanImpor = async (draft: DraftChecklist, sumber: 'teks' | 'excel') => {
    const { id } = await panggil<{ id: string }>('/api/checklist', {
      method: 'POST', body: JSON.stringify({ mode: 'impor', sumber, draft }),
    });
    setImporBuka(false);
    await muat();
    setDipilihId(id);
    beritahu('success', 'Checklist diimpor. Bagikan link ke tim lewat tombol "Bagikan link".');
  };

  const jalankanDuplikat = async () => {
    if (!duplikat || !duplikat.judul.trim()) return;
    setMenduplikat(true);
    try {
      const { id } = await panggil<{ id: string }>('/api/checklist', {
        method: 'POST', body: JSON.stringify({ mode: 'duplikat', sumberId: duplikat.sumber.id, judul: duplikat.judul }),
      });
      setDuplikat(null);
      await muat();
      setDipilihId(id);
      beritahu('success', 'Salinan dibuat dengan semua centang kosong.');
    } catch (e) {
      beritahu('error', e instanceof Error ? e.message : 'Gagal menduplikat.');
    } finally {
      setMenduplikat(false);
    }
  };

  const ubahShare = async (aksi: 'share' | 'tokenBaru', aktif?: boolean) => {
    if (!shareFor) return;
    const hasil = await panggil<{ share_aktif: boolean; share_token: string }>(`/api/checklist/${shareFor.id}`, {
      method: 'PATCH', body: JSON.stringify({ aksi, aktif }),
    });
    setShareFor({ ...shareFor, ...hasil });
    setDaftar(prev => prev.map(d => (d.id === shareFor.id ? { ...d, ...hasil } : d)));
    setVersiShare(v => v + 1);
  };

  const hapus = (d: ChecklistDaftar) => setKonfirmasi({
    message: `Hapus "${d.judul}"?`,
    description: 'Semua bagian, item, centang, dan riwayatnya ikut terhapus permanen. Link share berhenti berfungsi.',
    confirmLabel: 'Hapus permanen', danger: true,
    onConfirm: async () => {
      setKonfirmasi(null);
      try {
        await panggil(`/api/checklist/${d.id}`, { method: 'DELETE' });
        if (dipilihId === d.id) setDipilihId(null);
        await muat();
        beritahu('success', 'Checklist dihapus.');
      } catch (e) {
        beritahu('error', e instanceof Error ? e.message : 'Gagal menghapus.');
      }
    },
  });

  const bukaDuplikat = (d: ChecklistDaftar) => setDuplikat({ sumber: d, judul: `${d.judul} (salinan)`.slice(0, BATAS.judul) });

  const tombolIkon = 'p-2 rounded-lg transition-colors hover:bg-slate-100';

  return (
    <div className="min-h-screen" style={{ background: 'var(--halaman)' }}>
      <Toast notif={toast} />
      <PageHeader icon="✅" title="Checklist Tools" color={TEMA.warna} colorLight={TEMA.warnaTua}
        subtitle="Impor checklist pekerjaan · bagikan link · tim mencentang tanpa login">
        {admin && (
          <button onClick={() => setImporBuka(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-bold text-white"
            style={{ background: TEMA.warna }}>
            <Upload size={15} /> Impor checklist
          </button>
        )}
      </PageHeader>

      <main className="max-w-[1500px] mx-auto px-3 sm:px-6 py-5 space-y-4">
        {siap && !admin && (
          <EmptyState icon="🔒" title="Belum punya akses"
            description="Akun Anda belum diberi menu Checklist Tools. Minta Admin mengaktifkannya di Admin Panel, atau minta link checklist untuk mencentang pekerjaan." />
        )}

        {admin && dipilihId && (
          <DetailChecklist id={dipilihId} versiShare={versiShare} beritahu={beritahu}
            onKembali={() => { setDipilihId(null); muat(); }}
            onShare={setShareFor} onDuplikat={bukaDuplikat} onBerubah={muat} />
        )}

        {admin && !dipilihId && (
          <>
            <StatCardGrid cols={4} items={[
              { label: 'Checklist', value: statistik.total, accent: TEMA.warna, onClick: () => setSaring('semua'), active: saring === 'semua' },
              { label: 'Berjalan', value: statistik.berjalan, sub: 'masih ada item terbuka', accent: '#f59e0b', onClick: () => setSaring('berjalan'), active: saring === 'berjalan' },
              { label: 'Selesai 100%', value: statistik.selesai, accent: TEMA.selesai, onClick: () => setSaring('selesai'), active: saring === 'selesai' },
              { label: 'Link aktif', value: statistik.link, sub: 'bisa dicentang tim', accent: '#0891b2', onClick: () => setSaring('link'), active: saring === 'link' },
            ]} />

            <div className="rounded-xl overflow-hidden" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
              <div className="flex items-center gap-2 px-3 sm:px-4 py-3" style={{ borderBottom: `1px solid ${NETRAL.garis}` }}>
                <div className="relative flex-1 max-w-sm">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: TEMA.samar }} />
                  <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari judul checklist…" aria-label="Cari checklist"
                    className="w-full rounded-lg pl-9 pr-3 py-2 text-[13px] outline-none focus:ring-2"
                    style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta }} />
                </div>
                <span className="text-[12px] font-semibold ml-auto" style={{ ...fontAngka, color: TEMA.samar }}>{tampil.length} checklist</span>
              </div>

              {memuat && <p className="px-4 py-10 text-center text-sm" style={{ color: TEMA.samar }}>Memuat…</p>}
              {!memuat && galat && (
                <div className="px-4 py-10 text-center space-y-2">
                  <p className="text-sm font-bold" style={{ color: '#991b1b' }}>{galat}</p>
                  <button onClick={muat} className="text-[12px] font-bold" style={{ color: TEMA.warna }}>Coba lagi</button>
                </div>
              )}
              {!memuat && !galat && daftar.length === 0 && (
                <div className="px-4 py-12 text-center space-y-3">
                  <p className="text-[15px] font-bold" style={{ color: NETRAL.tinta }}>Belum ada checklist</p>
                  <p className="text-[13px] max-w-md mx-auto" style={{ color: NETRAL.tinta2 }}>
                    Impor dari teks/Markdown (mis. ekspor dokumen checklist) atau file Excel. Semua item langsung jadi, tinggal dibagikan.
                  </p>
                  <button onClick={() => setImporBuka(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-white"
                    style={{ background: TEMA.warna }}><Upload size={15} /> Impor checklist pertama</button>
                </div>
              )}
              {!memuat && !galat && daftar.length > 0 && tampil.length === 0 && (
                <p className="px-4 py-10 text-center text-sm" style={{ color: TEMA.samar }}>Tidak ada checklist yang cocok.</p>
              )}

              <ul className="divide-y" style={{ borderColor: NETRAL.garis }}>
                {tampil.map(d => (
                  <li key={d.id} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-5 px-3 sm:px-4 py-3 hover:bg-slate-50/70 transition-colors">
                    <button onClick={() => setDipilihId(d.id)} className="flex-1 min-w-0 text-left">
                      <p className="text-[14px] font-bold truncate" style={{ color: NETRAL.tinta }}>{d.judul}</p>
                      <p className="text-[11.5px] mt-0.5" style={{ color: TEMA.samar }}>
                        {d.sumber === 'excel' ? 'Excel' : d.sumber === 'duplikat' ? 'Salinan' : 'Teks'} · diperbarui {formatWaktu(d.updated_at)}
                      </p>
                    </button>
                    <button onClick={() => setDipilihId(d.id)} className="md:w-[320px] flex-shrink-0 text-left" aria-label={`Buka ${d.judul}`}>
                      <BarProgres progres={progresDari(d.selesai, d.total)} />
                    </button>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setShareFor(d)} className={tombolIkon}
                        aria-label={d.share_aktif ? 'Link aktif - kelola' : 'Bagikan link'} title={d.share_aktif ? 'Link aktif' : 'Bagikan link'}
                        style={{ color: d.share_aktif ? TEMA.selesai : TEMA.samar }}>
                        <Link2 size={16} />
                      </button>
                      <button onClick={() => bukaDuplikat(d)} className={tombolIkon} aria-label="Duplikat" title="Duplikat (centang dikosongkan)"
                        style={{ color: TEMA.samar }}>
                        <Copy size={16} />
                      </button>
                      <button onClick={() => hapus(d)} className={tombolIkon} aria-label="Hapus" title="Hapus" style={{ color: '#dc2626' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </main>

      <ModalImpor buka={imporBuka} onTutup={() => setImporBuka(false)} onSimpan={simpanImpor} />
      <ModalShare daftar={shareFor} onTutup={() => setShareFor(null)} onUbah={ubahShare} beritahu={beritahu} />

      <Modal buka={!!duplikat} onTutup={() => !menduplikat && setDuplikat(null)} ukuran="md" ikon="📋"
        judul="Duplikat checklist"
        keterangan="Bagian, item, dan catatan disalin. Semua centang dikosongkan dan link share-nya terpisah."
        footer={<>
          <TombolModal onClick={() => setDuplikat(null)} disabled={menduplikat}>Batal</TombolModal>
          <TombolModal jenis="utama" onClick={jalankanDuplikat} disabled={menduplikat || !duplikat?.judul.trim()}>
            {menduplikat ? 'Menyalin…' : 'Buat salinan'}
          </TombolModal>
        </>}>
        {duplikat && (
          <label className="block">
            <span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>Judul checklist baru</span>
            <input value={duplikat.judul} maxLength={BATAS.judul} autoFocus
              onChange={e => setDuplikat({ ...duplikat, judul: e.target.value })}
              placeholder="mis. Instalasi AV - Ruang Rapat Lt. 3"
              className="mt-1 w-full rounded-xl px-3 py-2 text-[13.5px] outline-none focus:ring-2"
              style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta }} />
          </label>
        )}
      </Modal>

      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </div>
  );
}
