'use client';

/**
 * QuickActionsSection.tsx - 4-6 aksi yang paling sering dipakai, per role.
 *
 * Reuse PintasanBuat (sudah ada di Widgets.tsx, dipakai Analytics Saya) -
 * bukan tombol baru dengan gaya sendiri. Daftar aksinya disaring lewat
 * hasMenu() yang sama dipakai seluruh Permission-Aware Dashboard, jadi Guest
 * otomatis hanya melihat aksi yang menu-nya memang ia punya - tanpa aturan
 * baru soal "apa yang boleh dilihat Guest".
 */

import React from 'react';
import { type WidgetProps, PintasanBuat } from '../widgets/primitives';
import { hasMenu, isAdminRole, isTeamMember } from '../widgets/permissions';
import type { User } from '../shared';

interface AksiDef {
  key: string;          // menu key untuk hasMenu()
  label: string;
  warna: string;
  run: (u: User, openMenu: (k: string) => void, openUrl: (url: string, title: string) => void) => void;
}

const AKSI_TEAM: AksiDef[] = [
  { key: 'daily-report', label: 'Isi Daily Report', warna: '#0f766e', run: (_u, openMenu) => openMenu('daily-report') },
  { key: 'reminder-schedule', label: 'Jadwal Saya', warna: '#0891b2', run: (_u, openMenu) => openMenu('reminder-schedule') },
  { key: 'ticket-troubleshooting', label: 'Buat Ticket', warna: '#e11d48', run: (_u, _openMenu, openUrl) => openUrl('/ticketing?buat=1', 'Ticket Troubleshooting') },
  { key: 'project-progress', label: 'Project Progress', warna: '#7c3aed', run: (_u, openMenu) => openMenu('project-progress') },
  { key: 'picket-showroom', label: 'Piket Showroom', warna: '#0d9488', run: (_u, openMenu) => openMenu('picket-showroom') },
  { key: 'learning-center', label: 'Learning Center', warna: '#4338ca', run: (_u, openMenu) => openMenu('learning-center') },
];

const AKSI_SALES: AksiDef[] = [
  { key: 'reminder-schedule', label: 'Request Schedule', warna: '#0891b2', run: (_u, _openMenu, openUrl) => openUrl('/reminder-schedule?buat=1', 'Request Schedule') },
  { key: 'request-design-project', label: 'Design Project', warna: '#7c3aed', run: (_u, _openMenu, openUrl) => openUrl('/form-require-project?buat=1', 'Request Design Project') },
  { key: 'ticket-troubleshooting', label: 'Buat Ticket', warna: '#e11d48', run: (_u, _openMenu, openUrl) => openUrl('/ticketing?buat=1', 'Ticket Troubleshooting') },
  { key: 'form-bast', label: 'Form Review/BAST', warna: '#475569', run: (_u, openMenu) => openMenu('form-bast') },
  { key: 'project-progress', label: 'Project Progress', warna: '#0d9488', run: (_u, openMenu) => openMenu('project-progress') },
  { key: 'learning-center', label: 'Learning Center', warna: '#4338ca', run: (_u, openMenu) => openMenu('learning-center') },
];

const QuickActionsSection: React.FC<WidgetProps> = ({ user, openMenu, openUrl }) => {
  const daftar = (isTeamMember(user) || isAdminRole(user)) ? AKSI_TEAM : AKSI_SALES;
  const aksi = daftar.filter(a => hasMenu(user, a.key)).slice(0, 6);

  if (aksi.length === 0) return null;

  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2.5 inline-flex items-center bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm">
        ⚡ Quick Action
      </h3>
      {/*
        Grid, bukan flex-wrap - PintasanBuat memakai `flex-1` (dirancang utk
        baris flex tetap 3 tombol di Analytics Saya). Dalam flex-wrap, flex-1
        membuat tombol yang wrap sendirian ke baris baru melebar penuh 100%
        dan terlihat janggal. Grid membuat tiap tombol mengisi selnya sendiri
        secara merata berapa pun jumlahnya (4-6).
      */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {aksi.map(a => (
          <PintasanBuat key={a.key} label={a.label} warna={a.warna} onClick={() => a.run(user, openMenu, openUrl)} />
        ))}
      </div>
    </div>
  );
};

export default QuickActionsSection;
