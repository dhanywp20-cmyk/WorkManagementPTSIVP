'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal, ConfirmDialog, ErrorState, type ConfirmState } from '@/components/shared';
import {
  ambilDetailProject, ubahProject, lepasLink, pindahkanLink, gabungkanProject,
  type LingkupProject, type RingkasanProject, type DetailProject,
} from '@/lib/summary-project';
import { PilihProject } from './PilihProject';
import { TIPE_CFG, STATUS_PROJECT, fmtTgl, warnaStatus, type AktivitasTipe } from './tampilan';
import { bangunLinimasa, diMasaDepan, LABEL_TANGGAL, saringLinimasa, type SaringLinimasa } from './linimasa';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { TombolEkspor } from '@/components/shared/TombolEkspor';

const INPUT = 'w-full px-3 py-2 rounded-lg text-sm outline-none bg-white border border-gray-200 focus:ring-2 focus:ring-indigo-400';

export function ModalDetailProject({ project, lingkup, isAdmin, currentUserName, onTutup, onBerubah, beritahu }: {
  project: RingkasanProject;
  lingkup: LingkupProject;
  isAdmin: boolean;
  currentUserName: string;
  onTutup: () => void;
  /** Data project berubah (edit/pindah/gabung) - daftar di halaman perlu dimuat ulang. */
  onBerubah: () => Promise<void> | void;
  beritahu: (type: 'success' | 'error', msg: string) => void;
}) {
  const [detail, setDetail] = useState<DetailProject | null>(null);
  /** Pesan galat muat riwayat (kueri gagal) - dulu tampil sebagai "belum ada aktivitas". */
  const [galat, setGalat] = useState<string | null>(null);
  /** Kapan riwayat terakhir dimuat - angka & status di sini adalah keadaan saat itu. */
  const [dimuatPada, setDimuatPada] = useState<Date | null>(null);
  /** Penyaring linimasa: semua / belum selesai di menu asal / lewat tenggat. */
  const [saring, setSaring] = useState<SaringLinimasa>('semua');
  const [mode, setMode] = useState<'lihat' | 'edit' | 'gabung'>('lihat');
  const [pindahId, setPindahId] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [form, setForm] = useState({
    name: project.name, customer: project.customer ?? '', location: project.location ?? '',
    sales_name: project.sales_name ?? '', status: project.status,
  });

  const muat = useCallback(async () => {
    setDetail(null); setGalat(null);
    try {
      setDetail(await ambilDetailProject(project.project_id, lingkup));
      setDimuatPada(new Date());
    } catch {
      //  Pesan teknis (kode PostgREST dsb.) tidak ditampilkan ke pengguna.
      setGalat('Riwayat project ini gagal dimuat.');
    }
  }, [project.project_id, lingkup]);

  useEffect(() => { muat(); }, [muat]);

  const jalankan = async (aksi: () => Promise<void>, sukses: string, tutup = false) => {
    setSibuk(true);
    try {
      await aksi();
      beritahu('success', sukses);
      await onBerubah();
      if (tutup) onTutup(); else { setMode('lihat'); setPindahId(null); await muat(); }
    } catch (e) {
      beritahu('error', `Gagal: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setSibuk(false); }
  };

  const simpanEdit = () => jalankan(() => ubahProject(project.project_id, {
    name: form.name.trim() || project.name,
    customer: form.customer.trim() || null, location: form.location.trim() || null,
    sales_name: form.sales_name.trim() || null, status: form.status,
  }), 'Project diperbarui.');

  const linimasa = detail ? bangunLinimasa(detail) : [];
  const nTerbuka = linimasa.filter(a => a.terbuka).length, nTerlambat = linimasa.filter(a => a.terlambat).length;
  const tampil = saringLinimasa(linimasa, saring);
  const jumlah: [AktivitasTipe, number][] = [
    ['schedule', project.schedule_count], ['ticket', project.ticket_count],
    ['design', project.design_count], ['review', project.review_count],
  ];

  return (
    <Modal buka onTutup={onTutup} ukuran="xl" ikon="🗂️"
      judul={<span><span className="text-indigo-600 font-black mr-2">{project.code}</span>{project.name}</span>}
      keterangan={[project.customer, project.location, project.sales_name && `Sales: ${project.sales_name}`].filter(Boolean).join(' · ') || undefined}>
      <div className="space-y-4">
        {/* Ringkasan + aksi admin */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {jumlah.map(([t, n]) => (
              <span key={t} className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: TIPE_CFG[t].bg, color: n ? TIPE_CFG[t].color : '#94a3b8' }}>
                <Ikon nama={TIPE_CFG[t].icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {n} {TIPE_CFG[t].pendek}
              </span>
            ))}
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{STATUS_PROJECT[project.status]}</span>
          </div>
          {isAdmin && mode === 'lihat' && (
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setMode('edit')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200"><IkonTeks nama="✏" />Edit</button>
              <button type="button" onClick={() => setMode('gabung')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100"><IkonTeks nama="🔀" />Gabungkan</button>
            </div>
          )}
        </div>

        {mode === 'edit' && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block sm:col-span-2"><span className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Nama Project</span>
                <input className={INPUT} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
              <label className="block"><span className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Customer</span>
                <input className={INPUT} value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))} /></label>
              <label className="block"><span className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Sales</span>
                <input className={INPUT} value={form.sales_name} onChange={e => setForm(f => ({ ...f, sales_name: e.target.value }))} /></label>
              <label className="block sm:col-span-2"><span className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Lokasi</span>
                <input className={INPUT} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></label>
              <label className="block"><span className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">Status</span>
                <select className={INPUT} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as RingkasanProject['status'] }))}>
                  {Object.entries(STATUS_PROJECT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMode('lihat')} className="px-4 py-2 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-600">Batal</button>
              <button type="button" disabled={sibuk} onClick={simpanEdit} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">Simpan</button>
            </div>
          </div>
        )}

        {mode === 'gabung' && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2">
            <p className="text-xs text-indigo-900">
              Semua aktivitas <b>{project.code}</b> dipindah ke project tujuan, lalu <b>{project.code}</b> dihapus.
              Pakai ini untuk project dobel karena beda ketik.
            </p>
            <PilihProject kecuali={project.project_id} sibuk={sibuk}
              onPilih={p => setConfirmState({
                message: `Gabungkan ${project.code} ke ${p.code}?`,
                description: `"${project.name}" akan dihapus dan seluruh aktivitasnya masuk ke "${p.name}".`,
                danger: true, confirmLabel: 'Gabungkan',
                onConfirm: () => jalankan(() => gabungkanProject(project.project_id, p.project_id, currentUserName), `Digabung ke ${p.code}.`, true),
              })} />
            <div className="flex justify-end">
              <button type="button" onClick={() => setMode('lihat')} className="px-4 py-2 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-600">Batal</button>
            </div>
          </div>
        )}

        {/* Linimasa - bisa diekspor / dicetak untuk dibagikan ke Sales / pimpinan */}
        {linimasa.length > 0 && (
          <div className="flex justify-end mb-3">
            <TombolEkspor jumlah={linimasa.length} data={() => ({
              judul: `${project.code} ${project.name}`, menu: 'Summary Project', warna: ['#4f46e5', '#6366f1'], baris: linimasa,
              filter: [['Customer', project.customer], ['Lokasi', project.location], ['Sales', project.sales_name]],
              kolom: [
                { judul: 'Tanggal', ambil: a => fmtTgl(a.tanggal) }, { judul: 'Jenis', ambil: a => TIPE_CFG[a.tipe].pendek },
                { judul: 'Aktivitas', ambil: a => a.judul }, { judul: 'Keterangan', ambil: a => a.meta }, { judul: 'Status', ambil: a => a.labelStatus },
              ],
            })} />
          </div>
        )}
        {/* Perlu perhatian: penyaring linimasa menurut status menu asal. */}
        {detail && linimasa.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Saring aktivitas">
            {([['semua', `Semua (${linimasa.length})`], ['terbuka', `Belum selesai (${nTerbuka})`], ['terlambat', `Terlambat (${nTerlambat})`]] as [SaringLinimasa, string][]).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setSaring(v)} aria-pressed={saring === v}
                className={`px-3 py-1.5 rounded-full text-[11.5px] font-bold border transition-colors ${saring === v
                  ? (v === 'terlambat' ? 'bg-rose-600 border-rose-600 text-white' : 'bg-slate-900 border-slate-900 text-white')
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{l}</button>
            ))}
            <span className="text-[11px] text-slate-500 ml-1">
              Belum selesai = status di menu asalnya belum Completed / Solved / Cancelled / Rejected.
            </span>
          </div>
        )}
        {detail && detail.tidakTampil > 0 && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-600">
            {detail.tidakTampil} record lain terhubung ke project ini tetapi tidak ditampilkan: di luar akses akun Anda
            (Sales / divisi lain) atau sudah dihapus di menu asalnya.
          </p>
        )}

        {/* Linimasa */}
        {galat ? (
          <ErrorState message={galat} onRetry={() => { void muat(); }} />
        ) : !detail ? (
          <p className="py-10 text-center text-sm text-gray-500" role="status">Memuat riwayat...</p>
        ) : linimasa.length === 0 ? (
          <div className="py-10 text-center space-y-1">
            <p className="text-sm font-semibold text-gray-600">Belum ada aktivitas yang bisa ditampilkan.</p>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Aktivitas muncul di sini setelah Request Schedule, Ticket, atau Design Project dengan nama project ini dihubungkan
              {isAdmin ? ' - lewat Mapping Center' : ' oleh admin'}. Form Review ikut jadwalnya.
            </p>
          </div>
        ) : tampil.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-sm font-semibold text-gray-600">{saring === 'terlambat' ? 'Tidak ada aktivitas yang terlambat.' : 'Semua aktivitas sudah selesai.'}</p>
            <button type="button" onClick={() => setSaring('semua')} className="text-xs font-bold text-indigo-600 hover:underline">Tampilkan semua aktivitas</button>
          </div>
        ) : (
          <div className="relative pl-5">
            <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-gray-200" aria-hidden="true" />
            <div className="space-y-5">
              {tampil.map(a => {
                const cfg = TIPE_CFG[a.tipe];
                const mendatang = diMasaDepan(a.tanggal);
                return (
                  <div key={a.id} className="relative">
                    <span className="absolute -left-5 top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                      style={{ background: cfg.color }} aria-hidden="true" />
                    <p className="text-[11px] font-black tracking-wider" style={{ color: cfg.color }}><Ikon nama={cfg.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /> {cfg.label}</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">{a.judul}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      <span className="font-semibold text-gray-600">{LABEL_TANGGAL[a.tipe]} {fmtTgl(a.tanggal)}</span>
                      {mendatang && <span className="ml-1 font-bold text-cyan-700">(akan datang)</span>}
                      {a.meta && <> · {a.meta}</>}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {a.labelStatus && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${warnaStatus(a.status ?? '')}18`, color: warnaStatus(a.status ?? '') }}>
                          {a.labelStatus}
                        </span>
                      )}
                      {a.terlambat && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">Terlambat</span>}
                      <a href={a.href} className="text-[11px] font-bold hover:underline" style={{ color: cfg.color }}
                        title={`Buka record ini di menu ${cfg.pendek}. Tombol Kembali di peramban membawa Anda ke project ini lagi.`}>Buka di {cfg.pendek} →</a>
                      {isAdmin && a.linkId && (
                        <>
                          <button type="button" onClick={() => setPindahId(pindahId === a.linkId ? null : a.linkId!)}
                            className="text-[11px] font-bold text-indigo-600 hover:underline">Pindah project</button>
                          <button type="button"
                            onClick={() => setConfirmState({
                              message: 'Lepas record ini dari project?',
                              description: 'Record kembali ke antrean Mapping Center. Datanya sendiri tidak dihapus.',
                              danger: true, confirmLabel: 'Lepas',
                              onConfirm: () => jalankan(() => lepasLink(a.linkId!), 'Record dilepas dari project.'),
                            })}
                            className="text-[11px] font-bold text-gray-500 hover:text-red-500 hover:underline">Lepas</button>
                        </>
                      )}
                    </div>
                    {pindahId && pindahId === a.linkId && (
                      <div className="mt-2 max-w-md rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                        <PilihProject kecuali={project.project_id} sibuk={sibuk}
                          onPilih={p => jalankan(() => pindahkanLink(a.linkId!, p.project_id, currentUserName), `Dipindah ke ${p.code}.`)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {dimuatPada && !galat && (
          <p className="text-[11px] text-slate-400 text-right">
            Sumber: record yang dihubungkan ke project ini · dimuat {dimuatPada.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
    </Modal>
  );
}
