'use client';

/**
 * PermissionAwareDashboard.tsx - Homepage adaptif berbasis permission.
 *
 * Flow (sesuai spec): Registry  Permission Resolver  Filter  Sort Priority
 * Compose  Render. Semua role memakai komponen INI (tidak ada dashboard
 * terpisah per role); yang berbeda hanya kumpulan widget hasil resolve dari
 * `allowed_menus`. Widget `full` (Analytics hero, Quick Action) dirender full
 * width; sisanya (lg/md/sm) di-grid responsif dengan `lg` melebar 2 kolom.
 */

import React, { useEffect, useState } from 'react';
import type { User } from '../shared';
import { WIDGETS, type WidgetDef } from './Widgets';
import { supabase } from '@/lib/supabase';
import { bacaPengaturan } from '@/lib/notifikasi/pengaturan';
import { AnalyticsPlatform, type Tab as AnalyticsTab } from '@/app/analytics-dashboard/_components/AnalyticsPlatform';

const SIZE_SPAN: Record<string, string> = {
  lg: 'sm:col-span-2 lg:col-span-2',
  md: '',
  sm: '',
};

/**
 * Tombol tab Analytics/Command Center/Audit Log versi ringkas untuk header
 * sticky - TabBtn asli (di AnalyticsPlatform) berukuran penuh (px-4 py-2.5
 * text-sm) untuk header standalone-nya sendiri; di sini harus muat berdampingan
 * dengan sambutan "Halo, ..." dan badge "N widget aktif" tanpa mendorong
 * layout jadi terlalu tinggi di mobile.
 */
function HeaderTabBtn({ label, icon, active, onClick, badge }: {
  label: string; icon: string; active: boolean; onClick: () => void; badge?: number;
}) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1 text-[10px] md:text-[11px] font-bold px-2 py-1 md:px-2.5 md:py-1.5 rounded-full transition-all flex-shrink-0"
      style={active
        ? { background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white' }
        : { background: 'rgba(0,0,0,0.05)', color: '#64748b' }}>
      <span className="select-none">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-[15px] h-[15px] rounded-full flex items-center justify-center text-[9px] font-black px-1"
          style={{ background: active ? 'rgba(255,255,255,0.3)' : '#ef4444', color: 'white' }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

export default function PermissionAwareDashboard({ currentUser, openMenu, openUrl, onHubungkanTelegram }: {
  currentUser: User;
  openMenu: (key: string) => void;
  openUrl: (url: string, title: string) => void;
  /** Membuka Profil, tempat akun Telegram dihubungkan. */
  onHubungkanTelegram?: () => void;
}) {
  /*
    Spanduk "Telegram belum terhubung".

    Telegram hanya bisa mengirim ke orang yang SUDAH menyapa botnya sendiri -
    tidak ada cara admin mengisikannya dari belakang layar. Jadi selama seorang
    anggota belum melakukannya, seluruh notifikasi Telegram untuknya hilang
    tanpa jejak: tidak ada yang gagal, tidak ada yang error, pesannya memang
    tidak pernah punya tujuan. Spanduk ini satu-satunya tempat kenyataan itu
    bisa terlihat oleh orang yang bisa membereskannya.

    Hanya muncul kalau kanal Telegram memang menyala - kalau admin belum
    menyalakannya, mengajak orang menghubungkan akun cuma jadi gangguan.
  */
  const [ajakTelegram, setAjakTelegram] = useState(false);
  const [tutupAjakan, setTutupAjakan] = useState(false);

  /*
    Tab Analytics/Command Center/Audit Log dipindah ke sini (header sticky)
    dari dalam widget Analytics-nya sendiri - sebelumnya tab bar itu muncul
    mengambang di tengah alur widget, jauh di bawah header, padahal ia
    sebenarnya navigasi tingkat-halaman (mengganti seluruh isi widget
    Analytics), bukan bagian dari satu widget. Ditaruh di sebelah badge
    "N widget aktif" supaya berpindah tab tidak perlu scroll ke bawah dulu.
    State-nya tetap di sini (bukan di dalam AnalyticsPlatform) supaya header
    & widget-nya bisa saling melihat tab yang sama - lihat prop
    controlledTab/onTabChange/onCounts di AnalyticsPlatform.
  */
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('kpi');
  const [analyticsCounts, setAnalyticsCounts] = useState({ totalAlerts: 0, auditCount: 0 });

  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const p = await bacaPengaturan();
        if (!p.aktif.telegram) return;
        const { data, error } = await supabase.from('users')
          .select('telegram_chat_id').eq('id', currentUser.id).maybeSingle();
        // Kolomnya baru; pemasangan yang belum menjalankan migrasinya cukup
        // tidak menampilkan spanduk, bukan menampilkan ajakan yang keliru.
        if (!batal && !error && data && !data.telegram_chat_id) setAjakTelegram(true);
      } catch { /* diam - spanduk opsional, bukan bagian alur kerja */ }
    })();
    return () => { batal = true; };
  }, [currentUser.id]);
  // Resolve: filter by permission  sort by priority.
  const visible = WIDGETS
    .filter(w => w.permission(currentUser))
    .sort((a, b) => a.priority - b.priority);

  // Compose: pertahankan urutan priority, tapi kelompokkan widget non-full yang
  // berurutan ke dalam satu grid; widget `full` berdiri sendiri full width.
  const composed: ({ type: 'full'; widget: WidgetDef } | { type: 'grid'; widgets: WidgetDef[] })[] = [];
  let buffer: WidgetDef[] = [];
  const flush = () => { if (buffer.length) { composed.push({ type: 'grid', widgets: buffer }); buffer = []; } };
  for (const w of visible) {
    if (w.size === 'full') { flush(); composed.push({ type: 'full', widget: w }); }
    else buffer.push(w);
  }
  flush();

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = (currentUser.full_name ?? '').split(' ')[0];
  const showAnalyticsTabs = visible.some(w => w.id === 'analytics');

  return (
    <div className="w-full h-full overflow-y-auto">
      {/* ── Header sambutan ──────────────────────────────────────────────────
          Dulu sambutan ini ikut terkurung di dalam kolom max-w-[1600px] yang
          sama dengan isi, jadi ia melayang di atas latar tanpa batas yang
          jelas — beda sendiri dari seluruh platform lain yang memakai bilah
          header penuh kiri-ke-kanan. Sekarang bilahnya membentang penuh dan
          menempel di atas seperti PageHeader di modul lain; hanya isinya yang
          tetap dibatasi lebarnya supaya sejajar dengan widget di bawahnya. */}
      <header className="sticky top-0 z-40"
        style={{ background: 'rgba(255,255,255,0.95)', borderBottom: '3px solid #b91c1c', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-2.5 md:py-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-base md:text-xl font-black tracking-tight leading-tight text-slate-800">Halo, {firstName} 👋</h1>
            <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-0.5">{today}</p>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap justify-end">
            {showAnalyticsTabs && (
              <div className="flex items-center gap-1 md:gap-1.5 flex-wrap">
                <HeaderTabBtn label="Analytics"      icon="📊" active={analyticsTab==='kpi'}     onClick={() => setAnalyticsTab('kpi')} />
                <HeaderTabBtn label="Command Center" icon="🏠" active={analyticsTab==='command'} onClick={() => setAnalyticsTab('command')} badge={analyticsCounts.totalAlerts} />
                <HeaderTabBtn label="Audit Log"      icon="📋" active={analyticsTab==='audit'}   onClick={() => setAnalyticsTab('audit')} badge={analyticsCounts.auditCount} />
              </div>
            )}
            <span className="text-[10px] md:text-[11px] font-semibold px-2.5 py-1 md:px-3 md:py-1.5 rounded-full bg-slate-100 text-slate-600 border border-black/5 flex-shrink-0">
              {visible.length} widget aktif
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-3 md:px-8 py-4 md:py-6 space-y-4 md:space-y-5">

        {ajakTelegram && !tutupAjakan && (
          <div className="rounded-xl flex items-center gap-3 md:gap-4 px-4 py-3.5 flex-wrap"
            style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}>
            <span className="w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 text-white text-base"
              style={{ background: '#f59e0b' }}>➤</span>
            <span className="flex-1 min-w-[220px]">
              <span className="block text-[13.5px] font-bold text-slate-800">Telegram Anda belum terhubung</span>
              <span className="block text-[12px] text-slate-600 mt-0.5 leading-relaxed">
                Notifikasi jadwal baru, assign tugas, dan approval belum bisa masuk ke Telegram.
                Cukup sekali hubungkan — tidak perlu diulang.
              </span>
            </span>
            <button type="button" onClick={() => setTutupAjakan(true)}
              className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 flex-shrink-0">
              Nanti saja
            </button>
            <button type="button" onClick={onHubungkanTelegram}
              className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg text-white flex-shrink-0"
              style={{ background: '#f59e0b' }}>
              Hubungkan sekarang →
            </button>
          </div>
        )}

        {composed.map((block, i) =>
          block.type === 'full' ? (
            <div key={`full-${block.widget.id}-${i}`}>
              {/*
                Widget Analytics dirender langsung (bukan lewat
                block.widget.Component) supaya tab-nya bisa dikontrol dari
                header di atas - lihat analyticsTab/showAnalyticsTabs.
              */}
              {block.widget.id === 'analytics' ? (
                <AnalyticsPlatform embedded injectedUser={currentUser}
                  controlledTab={analyticsTab} onTabChange={setAnalyticsTab} onCounts={setAnalyticsCounts} />
              ) : (
                <block.widget.Component user={currentUser} openMenu={openMenu} openUrl={openUrl} />
              )}
            </div>
          ) : (
            <div key={`grid-${i}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
              {block.widgets.map(w => (
                <div key={w.id} className={SIZE_SPAN[w.size] ?? ''}>
                  <w.Component user={currentUser} openMenu={openMenu} openUrl={openUrl} />
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
