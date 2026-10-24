'use client';

/** KepalaJadwal - dipecah dari app/(portal)/reminder-schedule/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { PageHeader } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';
import { Reminder } from './shared';

export interface KepalaJadwalProps {
  canAddReminder: boolean;
  isGuest: boolean;
  mulaiBuatReminder: () => void;
  mulaiRequestJadwal: () => void;
  myActiveReminders: Reminder[];
  pendingReviewCount: number;
  setShowBellPopup: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  view: "list" | "form";
}

export function KepalaJadwal({ canAddReminder, isGuest, mulaiBuatReminder, mulaiRequestJadwal, myActiveReminders, pendingReviewCount, setShowBellPopup, view }: KepalaJadwalProps) {
  return (
    <>
      <PageHeader icon="🗓️" title="Request Schedule">
        <button aria-label={`Notifikasi jadwal${myActiveReminders.length ? ` (${myActiveReminders.length} aktif)` : ''}`} onClick={() => setShowBellPopup(true)}
          className="relative p-2 rounded-xl transition-all hover:bg-cyan-50 border-2 border-transparent hover:border-cyan-200">
          <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {myActiveReminders.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
              style={{ background: '#f59e0b' }}>
              {myActiveReminders.length}
            </span>
          )}
        </button>

        {canAddReminder && view === 'list' && (
          <button onClick={mulaiBuatReminder}
            className="tombol-utama flex items-center gap-1.5 px-4 py-2 rounded-kontrol text-sm font-bold transition-all hover:scale-105 hover:opacity-90">
            <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            Tambah Reminder
          </button>
        )}

        {/* ── Tombol Request Jadwal — hanya untuk role Guest/Sales ── */}
        {isGuest && view === 'list' && (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={() => { if (pendingReviewCount === 0) mulaiRequestJadwal(); }}
              disabled={pendingReviewCount > 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
              style={pendingReviewCount > 0
                ? { background: 'linear-gradient(135deg,#9ca3af,#6b7280)', boxShadow: 'none', cursor: 'not-allowed', opacity: 0.7 }
                : { background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 4px 14px rgba(37,99,235,0.4)', cursor: 'pointer' }
              }
              title={pendingReviewCount > 0 ? `Ada ${pendingReviewCount} form review belum dinilai` : ''}
            >
              {pendingReviewCount > 0
                ? <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                : <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              }
              <IkonTeks nama="📩" />Request Jadwal
            </button>
            {pendingReviewCount > 0 && (
              <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                <IkonTeks nama="⚠" />Selesaikan {pendingReviewCount} form review dulu
              </span>
            )}
          </div>
        )}
      </PageHeader>
    </>
  );
}
