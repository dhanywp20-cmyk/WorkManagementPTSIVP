'use client';

import React from 'react';
import { type WidgetProps, WidgetCard, EmptyState, Loading } from '../widgets/primitives';
import { IkonTimbul, KartuAngka3D } from '../widgets/dimensi';
import { isAdminRole, isTeamMember, hasMenu } from '../widgets/permissions';
import { useWorkQueue, type ActionItem, type Urgency } from './useWorkQueue';
import type { User } from '../shared';
import { Ikon } from '@/components/shared/Ikon';

const URGENSI: Record<Urgency, { label: string; warna: string }> = {
  urgent: { label: 'Mendesak', warna: '#dc2626' },
  pending: { label: 'Perlu tindakan', warna: '#ea580c' },
  upcoming: { label: 'Mendatang', warna: '#2563eb' },
};

/** Satu tugas sebagai kartu: ikon timbul, judul, keterangan, label status (dan tanggal di tab Mendatang). */
function ActionRow({ item, onClick, showUrgencyDot = true, tanggal }: {
  item: ActionItem; onClick: () => void; showUrgencyDot?: boolean; tanggal?: string;
}) {
  const u = URGENSI[item.urgency];
  return (
    <button onClick={onClick} className="kartu-tugas">
      <IkonTimbul ikon={item.icon} warna={u.warna} ukuran={34} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-slate-800 truncate leading-snug">{item.title}</div>
        <div className="text-[11.5px] text-slate-500 truncate mt-0.5">{item.subtitle}</div>
      </div>
      {tanggal && (
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 flex-shrink-0 tabular-nums px-2 py-1 rounded-full bg-slate-100">
          <Ikon nama="🗓️" ukuran={12} />{tanggal}
        </span>
      )}
      {showUrgencyDot && (
        <span className="hidden sm:inline text-[10.5px] font-bold flex-shrink-0 px-2 py-1 rounded-full"
          style={{ background: `${u.warna}14`, color: u.warna }}>{u.label}</span>
      )}
    </button>
  );
}

interface AksiDef {
  key: string; label: string; icon: string; warna: string;
  run: (openMenu: (k: string) => void, openUrl: (url: string, title: string) => void) => void;
}

const AKSI_TEAM: AksiDef[] = [
  { key: 'daily-report', label: 'Isi Daily Report', icon: '📈', warna: '#0f766e', run: (openMenu) => openMenu('daily-report') },
  { key: 'reminder-schedule', label: 'Jadwal Saya', icon: '🗓️', warna: '#0891b2', run: (openMenu) => openMenu('reminder-schedule') },
  { key: 'ticket-troubleshooting', label: 'Buat Ticket', icon: '🎫', warna: '#e11d48', run: (_openMenu, openUrl) => openUrl('/ticketing?buat=1', 'Ticket Troubleshooting') },
  { key: 'project-progress', label: 'Project Progress', icon: '📊', warna: '#7c3aed', run: (openMenu) => openMenu('project-progress') },
  { key: 'picket-showroom', label: 'Piket Showroom', icon: '🏪', warna: '#0d9488', run: (openMenu) => openMenu('picket-showroom') },
  { key: 'learning-center', label: 'Learning Center', icon: '🎓', warna: '#4338ca', run: (openMenu) => openMenu('learning-center') },
];

/** Pintasan Team - ikon timbul + label, DI DALAM kartu Agenda, di bawah daftar tugas. */
function TeamActionChips({ user, openMenu, openUrl }: {
  user: User; openMenu: (k: string) => void; openUrl: (url: string, title: string) => void;
}) {
  const aksi = AKSI_TEAM.filter(a => hasMenu(user, a.key)).slice(0, 6);
  if (aksi.length === 0) return null;
  return (
    <div className="flex gap-1 mt-auto pt-3 border-t border-slate-100 overflow-x-auto -mx-1 px-1 pb-0.5 [scrollbar-width:none]">
      {aksi.map(a => (
        <button key={a.key} type="button" onClick={() => a.run(openMenu, openUrl)} className="pintasan-3d flex-1">
          <IkonTimbul ikon={a.icon} warna={a.warna} ukuran={40} />
          <span>{a.label}</span>
        </button>
      ))}
    </div>
  );
}

type TabAgenda = 'aksi' | 'hari' | 'nanti';

/** "2026-10-06" -> "Sen, 6 Okt". */
function tglPendek(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Agenda - SATU kartu bertab menggantikan tiga ubin terpisah (My Action,
 * Hari Ini, Mendatang). Tiga ubin dulu membuat beranda kaku: kolom
 * Mendatang membentang dua baris walau sering kosong, dan item yang sama
 * (mis. "Daily Report belum diisi") tercetak di My Action DAN Hari Ini.
 * Kini satu daftar, tab memilih sudut pandangnya, jumlah tiap tab tetap
 * terlihat sehingga tidak ada yang tersembunyi.
 */
const WorkQueueSection: React.FC<WidgetProps> = ({ user, openMenu, openUrl }) => {
  const { loading, error, myAction, today, upcoming } = useWorkQueue(user);
  const isTeamSide = isTeamMember(user) || isAdminRole(user);
  const idAksi = new Set(myAction.map(i => i.id));
  //  Hari Ini tanpa item yang sudah ada di Perlu tindakan - tidak dicetak dua kali.
  const hariIni = today.filter(i => !idAksi.has(i.id));
  const tabAwal: TabAgenda = myAction.length ? 'aksi' : hariIni.length ? 'hari' : upcoming.length ? 'nanti' : 'aksi';
  const [tab, setTab] = React.useState<TabAgenda | null>(null);
  const aktif = tab ?? tabAwal;

  if (loading) {
    return <div className="h-full"><WidgetCard title="Agenda Saya" icon="🎯" accent="#1d4ed8"><Loading /></WidgetCard></div>;
  }

  if (error) {
    return (
      <div className="h-full">
        <WidgetCard title="Agenda Saya" icon="🎯" accent="#dc2626">
          <div className="flex flex-col items-center justify-center gap-2 text-center py-3">
            <span className="text-2xl"><Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <p className="text-sm font-semibold text-rose-700">Gagal memuat daftar tugas.</p>
            <button onClick={() => window.location.reload()}
              className="mt-1 text-xs font-bold px-3 py-1.5 rounded-lg text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100">
              Coba lagi
            </button>
          </div>
        </WidgetCard>
      </div>
    );
  }

  const kosongSemua = myAction.length === 0 && hariIni.length === 0 && upcoming.length === 0;

  //  Sales/Guest tanpa tugas: bilah tipis - Quick Action mereka ada di kartu
  //  Analytics Saya, jadi kartu penuh hanya akan berisi satu kalimat.
  if (kosongSemua && !isTeamSide) {
    return (
      <div className="h-full flex items-center gap-2.5 rounded-2xl bg-white border border-slate-200/80 px-4 py-3">
        <span className="text-lg flex-shrink-0 text-emerald-700"><Ikon nama="🎉" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
        <span className="text-sm font-semibold text-emerald-700">Tidak ada tugas aktif yang butuh tindakan saat ini.</span>
      </div>
    );
  }

  const TAB: { k: TabAgenda; label: string; n: number; warna: string; ikon: string; items: ActionItem[] }[] = [
    { k: 'aksi', label: 'Tindakan', n: myAction.length, warna: '#dc2626', ikon: '⚡', items: myAction },
    { k: 'hari', label: 'Hari ini', n: hariIni.length, warna: '#0e7490', ikon: '📅', items: hariIni },
    { k: 'nanti', label: 'Mendatang', n: upcoming.length, warna: '#6d28d9', ikon: '🗓️', items: upcoming },
  ];
  const sekarang = TAB.find(t => t.k === aktif)!;

  return (
    <div className="h-full">
      <WidgetCard title="Agenda Saya" icon="🎯" accent="#1d4ed8">
        {kosongSemua ? (
          <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold py-2">
            <Ikon nama="🎉" ukuran="1.1em" /> Tidak ada tugas aktif yang butuh tindakan saat ini.
          </div>
        ) : (
          <>
            {/* Tiga kartu angka timbul - sekaligus tab: jumlah tiap sudut pandang selalu terlihat. */}
            <div role="tablist" aria-label="Agenda" className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
              {TAB.map(t => (
                <KartuAngka3D key={t.k} label={t.label} nilai={t.n} ikon={t.ikon} warna={t.warna}
                  aktif={t.k === aktif} onClick={() => setTab(t.k)} />
              ))}
            </div>
            <div role="tabpanel" className="flex-1 min-h-[88px] sm:min-h-[132px] max-h-[300px] overflow-y-auto overscroll-contain -mx-1.5 px-1.5 py-0.5 flex flex-col gap-2">
              {sekarang.items.length === 0 ? (
                <EmptyState
                  judul={aktif === 'aksi' ? 'Tidak ada yang mendesak' : aktif === 'hari' ? 'Hari ini kosong' : 'Belum ada jadwal'}
                  text={aktif === 'nanti' ? 'Jadwal 5 hari ke depan akan muncul di sini.' : 'Cek tab lain untuk agenda berikutnya.'}
                  aksi={aktif === 'nanti' && hasMenu(user, 'reminder-schedule') ? { label: 'Buka Jadwal', onClick: () => openMenu('reminder-schedule') } : undefined} />
              ) : sekarang.items.map(item => (
                <ActionRow key={item.id} item={item} onClick={() => openMenu(item.menuKey)} showUrgencyDot={aktif === 'aksi'}
                  tanggal={aktif === 'nanti' ? tglPendek(item.date) : undefined} />
              ))}
            </div>
          </>
        )}
        {isTeamSide && <TeamActionChips user={user} openMenu={openMenu} openUrl={openUrl} />}
      </WidgetCard>
    </div>
  );
};

export default WorkQueueSection;
