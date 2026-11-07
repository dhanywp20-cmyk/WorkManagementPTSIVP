'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { type WidgetProps, AKSEN_UTAMA, BAYANG_UBIN, EmptyState, LABEL_UBIN, Loading, UBIN } from '../widgets/primitives';
import { isAdminRole, isTeamMember, hasMenu } from '../widgets/permissions';
import { useWorkQueue, type ActionItem, type Urgency } from './useWorkQueue';
import { Ikon } from '@/components/shared/Ikon';

type TabAgenda = 'aksi' | 'hari' | 'nanti';

export interface RingkasAgenda { aksi: number; hari: number; nanti: number }

const WARNA_URGENSI: Record<Urgency, string> = { urgent: '#dc2626', pending: '#ea580c', upcoming: '#2563eb' };

const AKSI_CEPAT: { key: string; label: string; icon: string; url?: string; judul?: string }[] = [
  { key: 'daily-report', label: 'Isi Daily Report', icon: '📈' },
  { key: 'reminder-schedule', label: 'Jadwal Saya', icon: '🗓️' },
  { key: 'ticket-troubleshooting', label: 'Buat Ticket', icon: '🎫', url: '/ticketing?buat=1', judul: 'Ticket Troubleshooting' },
  { key: 'project-progress', label: 'Project Progress', icon: '📊' },
];

function tglPendek(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function BarisAgenda({ item, onClick }: { item: ActionItem; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="bb-agenda-baris">
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full shrink-0 mt-[7px]" style={{ background: WARNA_URGENSI[item.urgency] }} />
      <span className="min-w-0 flex-1">
        <b className="block text-[13px] font-semibold text-slate-800 truncate leading-snug">{item.title}</b>
        <small className="block text-[11px] text-slate-500 truncate">{item.subtitle}</small>
      </span>
      {item.date && <time className="text-[11px] font-semibold text-slate-500 shrink-0 mt-0.5 tabular-nums">{tglPendek(item.date)}</time>}
    </button>
  );
}

const PanelAgenda: React.FC<WidgetProps & { onRingkas?: (r: RingkasAgenda) => void }> = ({ user, openMenu, openUrl, onRingkas }) => {
  const { loading, error, myAction, today, upcoming } = useWorkQueue(user);
  const idAksi = useMemo(() => new Set(myAction.map(i => i.id)), [myAction]);
  const hariIni = useMemo(() => today.filter(i => !idAksi.has(i.id)), [today, idAksi]);
  const tabAwal: TabAgenda = myAction.length ? 'aksi' : hariIni.length ? 'hari' : upcoming.length ? 'nanti' : 'aksi';
  const [pilihanTab, setPilihanTab] = useState<TabAgenda | null>(null);
  const aktif = pilihanTab ?? tabAwal;

  useEffect(() => {
    if (!loading && !error) onRingkas?.({ aksi: myAction.length, hari: hariIni.length, nanti: upcoming.length });
  }, [loading, error, myAction.length, hariIni.length, upcoming.length, onRingkas]);

  const TAB: { k: TabAgenda; label: string; items: ActionItem[]; warna: string }[] = [
    { k: 'aksi', label: 'Aksi', items: myAction, warna: '#dc2626' },
    { k: 'hari', label: 'Hari ini', items: hariIni, warna: '#0e7490' },
    { k: 'nanti', label: 'Nanti', items: upcoming, warna: '#6d28d9' },
  ];
  const sekarang = TAB.find(t => t.k === aktif)!;
  const [utama, ...sisa] = sekarang.items;
  const aksiCepat = (isTeamMember(user) || isAdminRole(user)) ? AKSI_CEPAT.filter(a => hasMenu(user, a.key)) : [];

  return (
    <div className={`${UBIN} h-full`} style={{ boxShadow: BAYANG_UBIN }}>
      <h3 className={`${LABEL_UBIN} mb-3`}>Agenda Saya</h3>
      <div role="tablist" aria-label="Agenda" className="flex gap-1 p-1 rounded-xl bg-slate-100 mb-3 shrink-0">
        {TAB.map(t => {
          const on = t.k === aktif;
          return (
            <button key={t.k} type="button" role="tab" aria-selected={on} onClick={() => setPilihanTab(t.k)}
              className={`flex-1 min-w-0 flex items-center justify-center gap-1 px-1 py-1.5 rounded-lg text-[11.5px] font-semibold transition-colors ${on ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              <span className="truncate">{t.label}</span>
              <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0"
                style={t.items.length > 0 ? { background: t.warna, color: '#fff' } : { background: '#e2e8f0', color: '#475569' }}>{t.items.length}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1">
        {loading ? <Loading /> : error ? (
          <div className="flex flex-col items-center justify-center gap-2 text-center py-6">
            <p className="text-sm font-semibold text-rose-700">Gagal memuat daftar tugas.</p>
            <button type="button" onClick={() => window.location.reload()}
              className="text-xs font-bold px-3 py-1.5 rounded-lg text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100">Coba lagi</button>
          </div>
        ) : !utama ? (
          <EmptyState
            judul={aktif === 'aksi' ? 'Tidak ada yang mendesak' : aktif === 'hari' ? 'Hari ini kosong' : 'Belum ada jadwal'}
            text={aktif === 'nanti' ? 'Jadwal 5 hari ke depan akan muncul di sini.' : 'Cek tab lain untuk agenda berikutnya.'}
            aksi={aktif === 'nanti' && hasMenu(user, 'reminder-schedule') ? { label: 'Buka Jadwal', onClick: () => openMenu('reminder-schedule') } : undefined} />
        ) : (
          <div key={aktif} className="bb-geser">
            <div className="bb-fokus">
              <div className="flex items-start gap-2">
                <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0 mt-[6px]" style={{ background: WARNA_URGENSI[utama.urgency] }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-slate-900 leading-snug">{utama.title}</p>
                  <p className="text-[12px] text-slate-600 mt-0.5">{utama.subtitle}</p>
                </div>
              </div>
              <button type="button" onClick={() => openMenu(utama.menuKey)} className="bb-tombol-utama" style={{ background: AKSEN_UTAMA }}>Kerjakan sekarang</button>
            </div>
            {sisa.map(i => <BarisAgenda key={i.id} item={i} onClick={() => openMenu(i.menuKey)} />)}
          </div>
        )}
      </div>

      {aksiCepat.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 pt-3 mt-3 border-t border-slate-100 shrink-0">
          {aksiCepat.map(a => (
            <button key={a.key} type="button" className="bb-aksi"
              onClick={() => (a.url ? openUrl(a.url, a.judul ?? a.label) : openMenu(a.key))}>
              <span aria-hidden="true" className="text-slate-500 shrink-0"><Ikon nama={a.icon} ukuran={14} /></span>
              <span className="truncate">{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PanelAgenda;
