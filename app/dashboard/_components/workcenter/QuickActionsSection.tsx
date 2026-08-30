'use client';

/**
 * QuickActionsSection.tsx - 4-6 aksi yang paling sering dipakai, per role.
 *
 * Dua tata letak, disaring hasMenu() yang sama dipakai seluruh Permission-
 * Aware Dashboard - Guest otomatis hanya melihat aksi yang menu-nya memang
 * ia punya, tanpa aturan akses baru:
 *
 *   TEAM/ADMIN   - satu baris chip kompak (bukan tombol besar/lebar), pas di
 *                  bawah My Action - bukan blok terpisah yang memakan satu
 *                  baris penuh sendiri.
 *   SALES/GUEST  - chip diapit KIRI & KANAN kartu "Analytics Saya"
 *                  (SalesAnalyticsWidget, dirender LANGSUNG di sini - lihat
 *                  catatan di registry Widgets.tsx soal kenapa entri
 *                  'sales-analytics' terpisah sudah tidak ada). Di layar
 *                  sempit (mobile) otomatis turun jadi satu kolom: chip di
 *                  atas, Analytics Saya di bawah - "kiri-kanan" memang
 *                  konsep lebar desktop, menumpuk itu penyesuaian mobile
 *                  yang benar, bukan pelanggaran instruksinya.
 *
 * Chip-nya proporsional (lebar mengikuti isi, satu baris, ikon kecil) -
 * lihat QuickActionChip di primitives.tsx untuk alasannya.
 */

import React from 'react';
import { type WidgetProps, QuickActionChip } from '../widgets/primitives';
import { hasMenu, isAdminRole, isTeamMember } from '../widgets/permissions';
import { SalesAnalyticsWidget, hasSalesAnalyticsData } from '../widgets/SalesAnalyticsWidget';
import type { User } from '../shared';

interface AksiDef {
  key: string;          // menu key untuk hasMenu()
  label: string;
  icon: string;
  warna: string;
  run: (u: User, openMenu: (k: string) => void, openUrl: (url: string, title: string) => void) => void;
}

const AKSI_TEAM: AksiDef[] = [
  { key: 'daily-report', label: 'Isi Daily Report', icon: '📈', warna: '#0f766e', run: (_u, openMenu) => openMenu('daily-report') },
  { key: 'reminder-schedule', label: 'Jadwal Saya', icon: '🗓️', warna: '#0891b2', run: (_u, openMenu) => openMenu('reminder-schedule') },
  { key: 'ticket-troubleshooting', label: 'Buat Ticket', icon: '🎫', warna: '#e11d48', run: (_u, _openMenu, openUrl) => openUrl('/ticketing?buat=1', 'Ticket Troubleshooting') },
  { key: 'project-progress', label: 'Project Progress', icon: '📊', warna: '#7c3aed', run: (_u, openMenu) => openMenu('project-progress') },
  { key: 'picket-showroom', label: 'Piket Showroom', icon: '🏪', warna: '#0d9488', run: (_u, openMenu) => openMenu('picket-showroom') },
  { key: 'learning-center', label: 'Learning Center', icon: '🎓', warna: '#4338ca', run: (_u, openMenu) => openMenu('learning-center') },
];

const AKSI_SALES: AksiDef[] = [
  { key: 'reminder-schedule', label: 'Request Schedule', icon: '🗓️', warna: '#0891b2', run: (_u, _openMenu, openUrl) => openUrl('/reminder-schedule?buat=1', 'Request Schedule') },
  { key: 'request-design-project', label: 'Design Project', icon: '🏗️', warna: '#7c3aed', run: (_u, _openMenu, openUrl) => openUrl('/form-require-project?buat=1', 'Request Design Project') },
  { key: 'ticket-troubleshooting', label: 'Buat Ticket', icon: '🎫', warna: '#e11d48', run: (_u, _openMenu, openUrl) => openUrl('/ticketing?buat=1', 'Ticket Troubleshooting') },
  { key: 'form-bast', label: 'Form Review/BAST', icon: '⭐', warna: '#475569', run: (_u, openMenu) => openMenu('form-bast') },
  { key: 'project-progress', label: 'Project Progress', icon: '📊', warna: '#0d9488', run: (_u, openMenu) => openMenu('project-progress') },
  { key: 'learning-center', label: 'Learning Center', icon: '🎓', warna: '#4338ca', run: (_u, openMenu) => openMenu('learning-center') },
];

function Chips({ aksi, user, openMenu, openUrl, className = '' }: {
  aksi: AksiDef[]; user: User; openMenu: (k: string) => void; openUrl: (url: string, title: string) => void; className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {aksi.map(a => (
        <QuickActionChip key={a.key} label={a.label} icon={a.icon} warna={a.warna} onClick={() => a.run(user, openMenu, openUrl)} />
      ))}
    </div>
  );
}

const QuickActionsSection: React.FC<WidgetProps> = ({ user, openMenu, openUrl }) => {
  const isTeamSide = isTeamMember(user) || isAdminRole(user);
  const daftar = isTeamSide ? AKSI_TEAM : AKSI_SALES;
  const aksi = daftar.filter(a => hasMenu(user, a.key)).slice(0, 6);

  if (aksi.length === 0) return null;

  const label = (
    <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2 inline-flex items-center bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm">
      ⚡ Quick Action
    </h3>
  );

  if (isTeamSide) {
    // Satu strip kompak, langsung di bawah My Action - bukan kartu besar sendiri.
    return (
      <div>
        {label}
        <Chips aksi={aksi} user={user} openMenu={openMenu} openUrl={openUrl} />
      </div>
    );
  }

  // Sales/Guest: apit Analytics Saya kiri-kanan kalau datanya relevan;
  // kalau tidak (menu-nya tidak ada satu pun), cukup satu strip chip biasa.
  if (!hasSalesAnalyticsData(user)) {
    return (
      <div>
        {label}
        <Chips aksi={aksi} user={user} openMenu={openMenu} openUrl={openUrl} />
      </div>
    );
  }

  const tengah = Math.ceil(aksi.length / 2);
  const kiri = aksi.slice(0, tengah);
  const kanan = aksi.slice(tengah);

  return (
    <div>
      {label}
      {/*
        3 kolom di layar lebar (chip-kiri | Analytics Saya | chip-kanan),
        turun jadi 1 kolom (menumpuk) di bawah lg - mobile-safe. Kolom chip
        cuma selebar isinya (max-content) supaya Analytics Saya tetap dapat
        ruang paling besar, bukan dipaksa berbagi rata 1fr/1fr/1fr.
      */}
      <div className="grid grid-cols-1 lg:grid-cols-[max-content_1fr_max-content] gap-3 items-start">
        <div className="flex lg:flex-col gap-2 lg:pt-1">
          {kiri.map(a => (
            <QuickActionChip key={a.key} label={a.label} icon={a.icon} warna={a.warna} onClick={() => a.run(user, openMenu, openUrl)} />
          ))}
        </div>
        <SalesAnalyticsWidget user={user} openMenu={openMenu} openUrl={openUrl} />
        <div className="flex lg:flex-col gap-2 lg:pt-1">
          {kanan.map(a => (
            <QuickActionChip key={a.key} label={a.label} icon={a.icon} warna={a.warna} onClick={() => a.run(user, openMenu, openUrl)} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickActionsSection;
