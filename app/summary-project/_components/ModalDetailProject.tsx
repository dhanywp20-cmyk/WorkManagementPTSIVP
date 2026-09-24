'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal, ConfirmDialog, type ConfirmState } from '@/components/shared';
import {
  ambilDetailProject, ubahProject, lepasLink, pindahkanLink, gabungkanProject,
  type LingkupProject, type RingkasanProject, type DetailProject, type SourceModule,
} from '@/lib/summary-project';
import { PilihProject } from './PilihProject';
import { TIPE_CFG, STATUS_PROJECT, fmtTgl, warnaStatus, type AktivitasTipe } from './tampilan';

interface Aktivitas {
  id: string; tipe: AktivitasTipe; tanggal: string | null;
  judul: string; meta: string; status?: string; href: string;
  /** Id baris project_source_links bila record ini dipetakan langsung (bukan ikut reminder). */
  linkId?: string;
}

/** Gabungkan 4 sumber jadi SATU linimasa kronologis - lebih enak dibaca daripada 4 kotak terpisah. */
function bangunLinimasa(detail: DetailProject): Aktivitas[] {
  const list: Aktivitas[] = [];
  const link = (m: SourceModule, id: string) => detail.linkId[`${m}:${id}`];
  detail.reminders.forEach(r => list.push({
    id: `r-${r.id}`, tipe: 'schedule', tanggal: r.due_date,
    judul: `${r.category} · ${r.mode_penyelesaian === 'remote' ? 'Remote' : 'Onsite'}`,
    meta: `${r.assign_name}${r.address ? ' · ' + r.address : ''}`,
    status: r.status, href: `/reminder-schedule?open=${r.id}`, linkId: link('reminders', r.id),
  }));
  detail.tickets.forEach(t => list.push({
    id: `t-${t.id}`, tipe: 'ticket', tanggal: t.date,
    judul: t.issue_case, meta: t.assign_name,
    status: t.status, href: `/ticketing?open=${t.id}`, linkId: link('tickets', t.id),
  }));
  detail.requests.forEach(r => list.push({
    id: `p-${r.id}`, tipe: 'design', tanggal: r.due_date,
    judul: r.requester_name, meta: r.assigned_handler || 'Belum ada handler',
    status: r.status, href: `/form-require-project?open=${r.id}`, linkId: link('project_requests', r.id),
  }));
  detail.reviews.forEach(r => list.push({
    id: `f-${r.id}`, tipe: 'review', tanggal: null,
    judul: r.review_category || 'Review', meta: r.guest_fullname,
    href: `/form-review?open=${r.id}`, linkId: link('form_reviews', r.id),
  }));
  // Terbaru dulu. Yang tanpa tanggal (Form Review) diletakkan paling akhir.
  return list.sort((a, b) => {
    if (!a.tanggal && !b.tanggal) return 0;
    if (!a.tanggal) return 1;
    if (!b.tanggal) return -1;
    return b.tanggal.localeCompare(a.tanggal);
  });
}

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
  const [mode, setMode] = useState<'lihat' | 'edit' | 'gabung'>('lihat');
  const [pindahId, setPindahId] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [form, setForm] = useState({
    name: project.name, customer: project.customer ?? '', location: project.location ?? '',
    sales_name: project.sales_name ?? '', status: project.status,
  });

  const muat = useCallback(async () => {
    setDetail(null);
    setDetail(await ambilDetailProject(project.project_id, lingkup));
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
  const jumlah: [AktivitasTipe, number][] = [
    ['schedule', project.schedule_count], ['ticket', project.ticket_count],
    ['design', project.design_count], ['review', project.review_count],
  ];

  return (
    <Modal buka onTutup={onTutup} ukuran="xl" ikon="🗂️"
      judul={<span><span className="text-indigo-500 font-black mr-2">{project.code}</span>{project.name}</span>}
      keterangan={[project.customer, project.location, project.sales_name && `Sales: ${project.sales_name}`].filter(Boolean).join(' · ') || undefined}>
      <div className="space-y-4">
        {/* Ringkasan + aksi admin */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {jumlah.map(([t, n]) => (
              <span key={t} className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: TIPE_CFG[t].bg, color: n ? TIPE_CFG[t].color : '#94a3b8' }}>
                {TIPE_CFG[t].icon} {n} {TIPE_CFG[t].pendek}
              </span>
            ))}
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{STATUS_PROJECT[project.status]}</span>
          </div>
          {isAdmin && mode === 'lihat' && (
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setMode('edit')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200">✏️ Edit</button>
              <button type="button" onClick={() => setMode('gabung')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100">🔀 Gabungkan</button>
            </div>
          )}
        </div>

        {mode === 'edit' && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block sm:col-span-2"><span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Nama Project</span>
                <input className={INPUT} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
              <label className="block"><span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Customer</span>
                <input className={INPUT} value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))} /></label>
              <label className="block"><span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Sales</span>
                <input className={INPUT} value={form.sales_name} onChange={e => setForm(f => ({ ...f, sales_name: e.target.value }))} /></label>
              <label className="block sm:col-span-2"><span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Lokasi</span>
                <input className={INPUT} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></label>
              <label className="block"><span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Status</span>
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

        {/* Linimasa */}
        {!detail ? (
          <p className="py-10 text-center text-sm text-gray-400">Memuat riwayat...</p>
        ) : linimasa.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">Belum ada aktivitas tercatat untuk project ini.</p>
        ) : (
          <div className="relative pl-5">
            <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-gray-200" aria-hidden="true" />
            <div className="space-y-5">
              {linimasa.map(a => {
                const cfg = TIPE_CFG[a.tipe];
                return (
                  <div key={a.id} className="relative">
                    <span className="absolute -left-5 top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                      style={{ background: cfg.color }} aria-hidden="true" />
                    <p className="text-[10px] font-black tracking-wider" style={{ color: cfg.color }}>{cfg.icon} {cfg.label}</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">{a.judul}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{fmtTgl(a.tanggal)} · {a.meta}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {a.status && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${warnaStatus(a.status)}18`, color: warnaStatus(a.status) }}>
                          {a.status}
                        </span>
                      )}
                      <a href={a.href} className="text-[11px] font-bold hover:underline" style={{ color: cfg.color }}>Buka Detail →</a>
                      {isAdmin && a.linkId && (
                        <>
                          <button type="button" onClick={() => setPindahId(pindahId === a.linkId ? null : a.linkId!)}
                            className="text-[11px] font-bold text-indigo-500 hover:underline">Pindah project</button>
                          <button type="button"
                            onClick={() => setConfirmState({
                              message: 'Lepas record ini dari project?',
                              description: 'Record kembali ke antrean Mapping Center. Datanya sendiri tidak dihapus.',
                              danger: true, confirmLabel: 'Lepas',
                              onConfirm: () => jalankan(() => lepasLink(a.linkId!), 'Record dilepas dari project.'),
                            })}
                            className="text-[11px] font-bold text-gray-400 hover:text-red-500 hover:underline">Lepas</button>
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
      </div>
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
    </Modal>
  );
}
