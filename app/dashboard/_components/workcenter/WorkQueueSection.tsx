'use client';

/**
 * WorkQueueSection.tsx - "My Action" + "Today" + "Upcoming", satu hook
 * (useWorkQueue) dipakai bertiga supaya tidak fetch data yang sama 3x.
 *
 * Ini widget FULL-width paling atas di Work Center (priority 0 di registry),
 * menjawab "apa yang harus saya kerjakan sekarang" sebelum apa pun lain di
 * halaman - sesuai tujuan Work Center: action dulu, statistik belakangan.
 */

import React from 'react';
import { type WidgetProps, WidgetCard, EmptyState, Loading } from '../widgets/primitives';
import { useWorkQueue, type ActionItem, type Urgency } from './useWorkQueue';

const URGENCY_DOT: Record<Urgency, string> = { urgent: '#dc2626', pending: '#ea580c', upcoming: '#2563eb' };
const URGENCY_EMOJI: Record<Urgency, string> = { urgent: '🔴', pending: '🟠', upcoming: '🔵' };

function ActionRow({ item, onClick, showUrgencyDot = true }: {
  item: ActionItem; onClick: () => void; showUrgencyDot?: boolean;
}) {
  return (
    <button onClick={onClick}
      className="flex items-start gap-2.5 py-2 px-1.5 w-full text-left rounded-lg hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
      {showUrgencyDot && (
        <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: URGENCY_DOT[item.urgency] }}
          aria-label={item.urgency} title={item.urgency} />
      )}
      <span className="text-sm flex-shrink-0 leading-tight" aria-hidden="true">{item.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-slate-800 truncate leading-snug">{item.title}</div>
        <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
      </div>
    </button>
  );
}

const WorkQueueSection: React.FC<WidgetProps> = ({ user, openMenu }) => {
  const { loading, error, myAction, today, upcoming } = useWorkQueue(user);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-3"><WidgetCard title="My Action" icon="🎯" accent="#dc2626"><Loading /></WidgetCard></div>
      </div>
    );
  }

  if (error) {
    return (
      <WidgetCard title="My Action" icon="🎯" accent="#dc2626">
        {/*
          BEDA dari empty state "bersih, tidak ada tugas" di bawah - ini
          gagal MEMUAT, bukan berhasil memuat lalu memang kosong. Tombol
          Coba Lagi memuat ulang halaman - cara paling sederhana yang tidak
          menambah state manajemen baru hanya untuk retry satu widget.
        */}
        <div className="flex flex-col items-center justify-center gap-2 text-center py-3">
          <span className="text-2xl">⚠️</span>
          <p className="text-sm font-semibold text-rose-600">Gagal memuat daftar tugas.</p>
          <button onClick={() => window.location.reload()}
            className="mt-1 text-xs font-bold px-3 py-1.5 rounded-lg text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100">
            Coba lagi
          </button>
        </div>
      </WidgetCard>
    );
  }

  const kosongSemua = myAction.length === 0 && today.length === 0 && upcoming.length === 0;

  if (kosongSemua) {
    /*
      Bilah TIPIS, bukan WidgetCard penuh (header ikon+judul+padding besar) -
      satu kalimat tidak butuh bobot visual sebesar kartu berisi daftar.
      "Tidak ada jadwal aktif" - bukan "No Data" polos, supaya jelas ini
      artinya BERSIH (tidak ada tugas menumpuk), bukan data gagal dimuat.
    */
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-white/95 backdrop-blur-sm shadow-sm border border-black/5 px-4 py-3">
        <span className="text-lg flex-shrink-0">🎉</span>
        <span className="text-sm font-semibold text-emerald-700">Tidak ada tugas aktif yang butuh tindakan saat ini.</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      {/* MY ACTION - selebar 2 kolom, paling menonjol */}
      <div className="lg:col-span-2">
        <WidgetCard title="My Action" icon="🎯" accent="#dc2626">
          {myAction.length === 0 ? (
            <EmptyState text="Tidak ada item mendesak - lihat Hari Ini & Mendatang di samping." />
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2 text-[10px] font-semibold text-slate-400">
                <span>{URGENCY_EMOJI.urgent} Urgent/terlambat</span>
                <span>{URGENCY_EMOJI.pending} Perlu tindakan</span>
              </div>
              {myAction.map(item => (
                <ActionRow key={item.id} item={item} onClick={() => openMenu(item.menuKey)} />
              ))}
            </>
          )}
        </WidgetCard>
      </div>

      {/* TODAY + UPCOMING - satu kolom kanan, dua kartu ringkas */}
      <div className="flex flex-col gap-4">
        <WidgetCard title="Hari Ini" icon="📅" accent="#0891b2">
          {today.length === 0 ? (
            <EmptyState text="Tidak ada jadwal untuk hari ini." />
          ) : today.map(item => (
            <ActionRow key={item.id} item={item} onClick={() => openMenu(item.menuKey)} showUrgencyDot={false} />
          ))}
        </WidgetCard>
        <WidgetCard title="Mendatang" icon="🔜" accent="#7c3aed">
          {upcoming.length === 0 ? (
            <EmptyState text="Tidak ada jadwal dalam waktu dekat." />
          ) : upcoming.map(item => (
            <ActionRow key={item.id} item={item} onClick={() => openMenu(item.menuKey)} showUrgencyDot={false} />
          ))}
        </WidgetCard>
      </div>
    </div>
  );
};

export default WorkQueueSection;
