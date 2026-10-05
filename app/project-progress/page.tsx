'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link2, Plus, Search } from 'lucide-react';
import { getSession, startSessionWatcher } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { muatIdPimpinan } from '@/lib/pimpinan';
import { bolehDitugaskanOleh } from '@/lib/teams';
import type { User } from '@/app/dashboard/_components/shared';
import { PageHeader, StatCardGrid, Toast, type Notif, type SalesPickerUser } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { STATUS_PROYEK, keadaanJadwal, type ProyekRingkas } from '@/lib/checklist';
import { BarProgres, KepingKendala, TEMA, progresDariStat } from './_components/tampilan';
import { DetailProyek } from './_components/DetailProyek';
import { DetailChecklist } from './_components/DetailChecklist';
import { ModalProyek, type IsianProyek } from './_components/FormProyek';
import type { CalonAnggota } from './_components/PilihAnggota';
import { panggil, pesanGalat } from './_components/api';

type Saring = 'semua' | 'berjalan' | 'kendala' | 'terlambat' | 'saya' | 'selesai';

function terlambat(p: ProyekRingkas): boolean {
  const target = p.target_terdekat ?? p.target_date;
  return p.status !== 'done' && keadaanJadwal(target, false).keadaan === 'terlambat';
}

/**
 * Project Progress - proyek -> checklist per lokasi -> bagian -> item.
 *
 *   Admin    : buat & hapus proyek/checklist, atur anggota, link proyek.
 *   Anggota  : (di-assign per checklist) centang, kendala, foto, ubah item.
 *   Team     : melihat semua proyek.   Sales: melihat proyeknya sendiri.
 *   Tim lapangan tanpa akun: link checklist (/checklist/share/<token>).
 *
 * Semua aturan itu ditegakkan di server (lib/checklist-server.ts); halaman
 * ini hanya menyembunyikan tombol yang memang tidak akan diizinkan.
 */
export default function ProjectProgressPage() {
  const [user, setUser] = useState<User | null>(null);
  const [proyek, setProyek] = useState<ProyekRingkas[]>([]);
  const [admin, setAdmin] = useState(false);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [cari, setCari] = useState('');
  const [saring, setSaring] = useState<Saring>('semua');
  const [proyekId, setProyekId] = useState<string | null>(null);
  const [checklistId, setChecklistId] = useState<string | null>(null);
  const [baruBuka, setBaruBuka] = useState(false);
  const [salesUsers, setSalesUsers] = useState<SalesPickerUser[]>([]);
  const [calonAnggota, setCalonAnggota] = useState<CalonAnggota[]>([]);
  const [toast, setToast] = useState<Notif | null>(null);
  /**
   * Daftar proyek TIDAK dimuat ulang setiap ada perubahan di dalam proyek /
   * checklist - cukup ditandai, lalu dimuat sekali saat kembali ke daftar.
   * Menghemat permintaan & egress (Vercel/Supabase paket gratis).
   */
  const perluMuat = useRef(false);
  const tandaiBerubah = useCallback(() => { perluMuat.current = true; }, []);

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
    return startSessionWatcher();
  }, []);

  const muat = useCallback(async () => {
    perluMuat.current = false;
    try {
      const r = await panggil<{ proyek: ProyekRingkas[]; admin: boolean }>('/api/project-progress');
      setProyek(r.proyek);
      setAdmin(r.admin);
      setGalat('');
    } catch (e) {
      setGalat(pesanGalat(e, 'Gagal memuat proyek.'));
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { if (user) muat(); }, [user, muat]);

  // Daftar akun untuk pemilih Sales & anggota - pola yang sama dengan dropdown
  // Request Schedule: Sales = role guest; anggota = yang boleh ditugaskan.
  useEffect(() => {
    if (!admin) return;
    (async () => {
      const { data } = await supabase.from('users')
        .select('id, full_name, role, team_type, sales_division, jabatan, bisa_ditugaskan').order('full_name');
      const rows = (data ?? []) as {
        id: string; full_name: string; role: string; team_type?: string | null; sales_division?: string | null;
        jabatan?: string | null; bisa_ditugaskan?: boolean | null;
      }[];
      const idPim = await muatIdPimpinan(supabase);
      setSalesUsers(rows.filter(u => u.role === 'guest' && !idPim.has(u.id)).map(u => ({ id: u.id, full_name: u.full_name, sales_division: u.sales_division ?? null })));
      setCalonAnggota(rows.filter(u => bolehDitugaskanOleh(u, true))
        .map(u => ({ id: u.id, full_name: u.full_name, sub: [u.team_type, u.jabatan].filter(Boolean).join(' · ') })));
    })();
  }, [admin]);

  const statistik = useMemo(() => ({
    berjalan: proyek.filter(p => p.status !== 'done').length,
    kendala: proyek.filter(p => p.stat.kendala > 0).length,
    terlambat: proyek.filter(terlambat).length,
    saya: proyek.filter(p => p.saya).length,
    selesai: proyek.filter(p => p.status === 'done').length,
  }), [proyek]);

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return proyek
      .filter(p => !q || [p.nama, p.client, p.sales_name].some(v => (v ?? '').toLowerCase().includes(q)))
      .filter(p => saring === 'semua'
        || (saring === 'berjalan' && p.status !== 'done')
        || (saring === 'kendala' && p.stat.kendala > 0)
        || (saring === 'terlambat' && terlambat(p))
        || (saring === 'saya' && p.saya)
        || (saring === 'selesai' && p.status === 'done'))
      // Yang perlu perhatian di atas: kendala, terlambat, lalu yang terbaru.
      .sort((a, b) => Number(b.stat.kendala > 0) - Number(a.stat.kendala > 0)
        || Number(terlambat(b)) - Number(terlambat(a))
        || Number(a.status === 'done') - Number(b.status === 'done')
        || b.updated_at.localeCompare(a.updated_at));
  }, [proyek, cari, saring]);

  const buatProyek = async (f: IsianProyek) => {
    const { id } = await panggil<{ id: string }>('/api/project-progress', { method: 'POST', body: JSON.stringify(f) });
    setBaruBuka(false);
    tandaiBerubah();
    setProyekId(id);
    beritahu('success', 'Proyek dibuat. Tambahkan checklist untuk tiap lokasi.');
  };

  const saringKartu = (k: Saring) => () => setSaring(s => (s === k ? 'semua' : k));

  return (
    <div className="min-h-screen" style={{ background: 'var(--halaman)' }}>
      <Toast notif={toast} />
      <PageHeader icon="📊" title="Project Progress" color={TEMA.warna} colorLight={TEMA.warnaTua}
        subtitle="Checklist pekerjaan per proyek & lokasi · tim mencentang langsung dari lapangan">
        {admin && !proyekId && (
          <button onClick={() => setBaruBuka(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12.5px] font-bold text-white" style={{ background: TEMA.warna }}>
            <Plus size={15} /> Proyek baru
          </button>
        )}
      </PageHeader>

      <main className="max-w-[1500px] mx-auto px-3 sm:px-6 py-5 space-y-4">
        {checklistId && (
          <DetailChecklist key={checklistId} id={checklistId} beritahu={beritahu} onBerubah={tandaiBerubah} calonAnggota={calonAnggota}
            namaSaya={user?.full_name || user?.username || ''}
            daftarProyek={proyek.map(p => ({ id: p.id, nama: p.nama, client: p.client }))}
            onBukaChecklist={(id, pid) => { setProyekId(pid); setChecklistId(id); }}
            onKembali={() => setChecklistId(null)} />
        )}

        {!checklistId && proyekId && (
          <DetailProyek proyekId={proyekId} beritahu={beritahu} onBerubah={tandaiBerubah}
            salesUsers={salesUsers} calonAnggota={calonAnggota}
            onKembali={() => { setProyekId(null); if (perluMuat.current) muat(); }} onBukaChecklist={setChecklistId} />
        )}

        {!checklistId && !proyekId && (
          <>
            <StatCardGrid cols={5} items={[
              { label: 'Berjalan', value: statistik.berjalan, accent: TEMA.warna, onClick: saringKartu('berjalan'), active: saring === 'berjalan' },
              { label: 'Ada kendala', value: statistik.kendala, sub: 'item ditandai bermasalah', accent: '#d97706', onClick: saringKartu('kendala'), active: saring === 'kendala' },
              { label: 'Terlambat', value: statistik.terlambat, sub: 'lewat target', accent: '#dc2626', onClick: saringKartu('terlambat'), active: saring === 'terlambat' },
              { label: 'Tugas saya', value: statistik.saya, sub: 'checklist yang di-assign', accent: '#0891b2', onClick: saringKartu('saya'), active: saring === 'saya' },
              { label: 'Selesai', value: statistik.selesai, accent: '#16a34a', onClick: saringKartu('selesai'), active: saring === 'selesai' },
            ]} />

            <div className="rounded-xl overflow-hidden" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
              <div className="flex items-center gap-2 px-3 sm:px-4 py-3" style={{ borderBottom: `1px solid ${NETRAL.garis}` }}>
                <div className="relative flex-1 max-w-sm">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: TEMA.samar }} />
                  <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari proyek, client, atau Sales…" aria-label="Cari proyek"
                    className="w-full rounded-lg pl-9 pr-3 py-2 text-[13px] outline-none focus:ring-2"
                    style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta }} />
                </div>
                <span className="text-[12px] font-semibold ml-auto" style={{ color: TEMA.samar, fontVariantNumeric: 'tabular-nums' }}>
                  {tampil.length} proyek{saring !== 'semua' ? ' · tersaring' : ''}
                </span>
              </div>

              {memuat && <p className="px-4 py-10 text-center text-sm" style={{ color: TEMA.samar }}>Memuat…</p>}
              {!memuat && galat && (
                <div className="px-4 py-10 text-center space-y-2">
                  <p className="text-sm font-bold" style={{ color: TEMA.bahaya }}>{galat}</p>
                  <button onClick={muat} className="text-[12px] font-bold" style={{ color: TEMA.warna }}>Coba lagi</button>
                </div>
              )}
              {!memuat && !galat && proyek.length === 0 && (
                <div className="px-4 py-12 text-center space-y-2">
                  <p className="text-[15px] font-bold" style={{ color: NETRAL.tinta }}>Belum ada proyek</p>
                  <p className="text-[13px] max-w-md mx-auto" style={{ color: NETRAL.tinta2 }}>
                    {admin ? 'Buat proyek, lalu tambahkan checklist per lokasi dengan impor teks/Excel. Proyek kategori Konfigurasi juga dibuat otomatis dari Request Schedule.'
                      : 'Proyek yang Anda tangani atau di-assign akan muncul di sini.'}
                  </p>
                </div>
              )}
              {!memuat && !galat && proyek.length > 0 && tampil.length === 0 && (
                <p className="px-4 py-10 text-center text-sm" style={{ color: TEMA.samar }}>Tidak ada proyek yang cocok.</p>
              )}

              <ul className="divide-y" style={{ borderColor: NETRAL.garis }}>
                {tampil.map(p => {
                  const st = STATUS_PROYEK[p.status] ?? STATUS_PROYEK.in_progress;
                  const j = keadaanJadwal(p.target_terdekat ?? p.target_date, p.status === 'done');
                  const warnaJ = j.keadaan === 'terlambat' ? TEMA.bahaya : j.keadaan === 'dekat' ? TEMA.kendala : j.keadaan === 'selesai' ? TEMA.selesai : TEMA.samar;
                  return (
                    <li key={p.id}>
                      <button onClick={() => setProyekId(p.id)}
                        className="w-full text-left flex flex-col md:flex-row md:items-center gap-2 md:gap-5 px-3 sm:px-4 py-3 hover:bg-slate-50/70 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[14px] font-bold truncate" style={{ color: NETRAL.tinta }}>{p.nama}</p>
                            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold" style={{ background: st.tint, color: st.warna }}>{st.label}</span>
                            {p.saya && <span className="px-1.5 py-0.5 rounded text-[10.5px] font-bold" style={{ background: TEMA.tint, color: TEMA.warnaTua }}>Tugas saya</span>}
                            {p.share_aktif && <Link2 size={13} aria-label="Link proyek aktif" style={{ color: TEMA.selesai }} />}
                          </div>
                          <p className="text-[11.5px] mt-0.5 truncate" style={{ color: TEMA.samar }}>
                            {[p.client, p.sales_name ? `Sales ${p.sales_name}` : null, `${p.jumlah_checklist} lokasi`].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="md:w-[300px] flex-shrink-0 space-y-1">
                          {p.stat.total > 0 ? <BarProgres progres={progresDariStat(p.stat)} />
                            : <p className="text-[11.5px] font-semibold" style={{ color: TEMA.samar }}>Belum ada item checklist</p>}
                        </div>
                        <div className="md:w-[200px] flex-shrink-0 flex items-center gap-2 flex-wrap">
                          <span className="text-[11.5px] font-bold" style={{ color: warnaJ }}>{j.label}</span>
                          <KepingKendala jumlah={p.stat.kendala} />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </main>

      <ModalProyek buka={baruBuka} awal={null} salesUsers={salesUsers} onTutup={() => setBaruBuka(false)} onSimpan={buatProyek} />
    </div>
  );
}
