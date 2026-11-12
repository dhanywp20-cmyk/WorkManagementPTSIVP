'use client';
import React, { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AturanPerbandinganInline } from './perbandingan-aturan';

import { AdminPanelModalProps } from './shared';
import { KodeAcaraInline } from './modal-kode-acara';
import { DaftarPilihanInline } from './modal-daftar-pilihan';
import { ModalPortal } from '@/components/shared';
import { AccountSettingsInline } from './modal-akun';
import { UserManagementInline } from './pengguna/KelolaPenggunaInline';
import { BrandPicSettingInline } from './modal-brand-pic';
import { MerekSettingInline } from './modal-merek';
import { WidgetDasborInline } from './modal-widget-dasbor';
import { KelompokSettingInline } from './modal-kelompok';
import { KartuSuaraNotif } from './kartu-suara-notif';
import { IntegrasiInline } from './modal-integrasi';
import { AplikasiAndroidInline } from './modal-aplikasi-android';
import { KesehatanInline } from './modal-kesehatan';
import { KeamananInline } from './modal-keamanan';
import { LisensiInline } from './modal-lisensi';
import { BriefingPagiKartu } from './modal-briefing';
import { Ikon } from '@/components/shared/Ikon';
import { KpiRosterInline } from './KpiRosterInline';

export function AdminPanelModal({ initialTab, onClose }: AdminPanelModalProps) {
  const [activeSection, setActiveSection] = useState<'settings' | 'userManagement' | 'picBrand' | 'kpiRoster' | 'merek' | 'widgetDasbor' | 'kelompok' | 'integrasi' | 'kodeAcara' | 'daftarPilihan' | 'android' | 'kesehatan' | 'perbandingan' | 'keamanan' | 'lisensi'>(initialTab);

const GRUP_NAV: { key: 'organization' | 'appearance' | 'notifications' | 'system'; label: string }[] = [
  { key: 'organization',  label: 'Organisasi' },
  { key: 'appearance',    label: 'Tampilan' },
  { key: 'notifications', label: 'Notifikasi' },
  { key: 'system',        label: 'Sistem' },
];

const navItems: { key: 'settings' | 'userManagement' | 'picBrand' | 'kpiRoster' | 'merek' | 'widgetDasbor' | 'kelompok' | 'integrasi' | 'kodeAcara' | 'daftarPilihan' | 'android' | 'kesehatan' | 'perbandingan' | 'keamanan' | 'lisensi'; group: typeof GRUP_NAV[number]['key']; label: string; icon: React.ReactElement; color: string; activeBg: string; activeBorder: string; activeText: string }[] = [
    {
      key: 'settings',
      group: 'organization',
      label: 'Account Settings',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
      color: '#4338ca', activeBg: 'rgba(99,102,241,0.1)', activeBorder: 'rgba(99,102,241,0.4)', activeText: '#4338ca',
    },
    {
      key: 'userManagement',
      group: 'organization',
      label: 'User Management',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
      color: '#0f766e', activeBg: 'rgba(13,148,136,0.1)', activeBorder: 'rgba(13,148,136,0.4)', activeText: '#0f766e',
    },
    {
      key: 'kodeAcara',
      group: 'organization',
      label: 'Kode Acara',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
      color: '#9333ea', activeBg: 'rgba(147,51,234,0.1)', activeBorder: 'rgba(147,51,234,0.4)', activeText: '#7e22ce',
    },
    {
      key: 'picBrand',
      group: 'organization',
      label: 'PIC Brand',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
      color: '#b45309', activeBg: 'rgba(217,119,6,0.1)', activeBorder: 'rgba(217,119,6,0.4)', activeText: '#b45309',
    },
    {
      key: 'daftarPilihan',
      group: 'organization',
      label: 'Daftar Pilihan',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" /></svg>,
      color: '#0f766e', activeBg: 'rgba(13,148,136,0.1)', activeBorder: 'rgba(13,148,136,0.4)', activeText: '#0f766e',
    },
    {
      key: 'kpiRoster',
      group: 'organization',
      label: 'KPI Roster',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
      color: '#0369a1', activeBg: 'rgba(3,105,161,0.1)', activeBorder: 'rgba(3,105,161,0.4)', activeText: '#0369a1',
    },
    {
      key: 'merek',
      group: 'appearance',
      label: 'Dashboard Setting',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>,
      color: '#7e22ce', activeBg: 'rgba(147,51,234,0.1)', activeBorder: 'rgba(147,51,234,0.4)', activeText: '#7e22ce',
    },
    {
      key: 'widgetDasbor',
      group: 'appearance',
      label: 'Widget Dashboard',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h6v6H4zM14 5h6v4h-6zM4 15h6v5H4zM14 13h6v7h-6z" /></svg>,
      color: '#7e22ce', activeBg: 'rgba(147,51,234,0.1)', activeBorder: 'rgba(147,51,234,0.4)', activeText: '#7e22ce',
    },
    {
      key: 'kelompok',
      group: 'notifications',
      label: 'Kelompok & Notifikasi',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
      color: '#be185d', activeBg: 'rgba(219,39,119,0.1)', activeBorder: 'rgba(219,39,119,0.4)', activeText: '#be185d',
    },
    {
      key: 'integrasi',
      group: 'notifications',
      label: 'Integrations',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
      color: '#0e7490', activeBg: 'rgba(8,145,178,0.1)', activeBorder: 'rgba(8,145,178,0.4)', activeText: '#0e7490',
    },
    {
      key: 'android',
      group: 'notifications',
      label: 'Aplikasi Android',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
      color: '#047857', activeBg: 'rgba(16,185,129,0.1)', activeBorder: 'rgba(16,185,129,0.4)', activeText: '#047857',
    },
    {
      key: 'perbandingan',
      group: 'system',
      label: 'Product Comparison',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 006 0L7 7zm10 0l-3 7a3 3 0 006 0l-3-7z" /></svg>,
      color: '#1d4ed8', activeBg: 'rgba(29,78,216,0.1)', activeBorder: 'rgba(29,78,216,0.4)', activeText: '#1d4ed8',
    },
    {
      key: 'lisensi',
      group: 'system',
      label: 'Lisensi',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
      color: '#4338ca', activeBg: 'rgba(99,102,241,0.1)', activeBorder: 'rgba(99,102,241,0.4)', activeText: '#4338ca',
    },
    {
      key: 'keamanan',
      group: 'system',
      label: 'Keamanan Login',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3zm-2.5 9l1.8 1.8L15 10" /></svg>,
      color: '#0f766e', activeBg: 'rgba(15,118,110,0.1)', activeBorder: 'rgba(15,118,110,0.4)', activeText: '#0f766e',
    },
    {
      key: 'kesehatan',
      group: 'system',
      label: 'Kesehatan Sistem',
      icon: <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h4l3-8 4 16 3-8h4" /></svg>,
      color: '#be123c', activeBg: 'rgba(225,29,72,0.1)', activeBorder: 'rgba(225,29,72,0.4)', activeText: '#be123c',
    },
  ];

  const activeNav = navItems.find(n => n.key === activeSection)!;
  const pratinjau = activeSection === 'widgetDasbor';
  const bagianSebelum = useRef<typeof activeSection>(initialTab);
  useEffect(() => { if (activeSection !== 'widgetDasbor') bagianSebelum.current = activeSection; }, [activeSection]);
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => { if (pratinjau && pathname !== '/dashboard') router.push('/dashboard'); }, [pratinjau, pathname, router]);

  return (
  <ModalPortal>
    <div role="dialog" aria-modal={!pratinjau} aria-label="Admin Panel" style={pratinjau ? undefined : { background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      className={pratinjau ? 'fixed inset-0 z-1000 flex justify-start pointer-events-none' : 'fixed inset-0 z-1000 flex items-center justify-center pt-16 px-4 pb-4'}>
      <div className={pratinjau
        ? 'pointer-events-auto bg-white shadow-modal w-full sm:w-[400px] h-full flex flex-col overflow-hidden border-r border-slate-200'
        : 'bg-white rounded-kartu shadow-modal w-full max-w-7xl h-[90vh] flex flex-col sm:flex-row overflow-hidden border border-slate-200'}>

        <div className={`${pratinjau ? 'hidden' : 'flex'} w-full sm:w-56 shrink-0 flex-col border-b sm:border-b-0 sm:border-r border-slate-100`} style={{ background: 'linear-gradient(160deg, #1e293b 0%, #0f172a 100%)' }}>
          <div className="px-4 sm:px-5 py-3 sm:py-5 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <svg aria-hidden="true" focusable="false" className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight">Admin Panel</p>
                <p className="text-white/40 text-[11px] hidden sm:block">Superadmin Settings</p>
              </div>
            </div>
          </div>

          <div role="tablist" aria-label="Bagian Admin Panel"
            className="flex-1 p-2 sm:p-3 flex flex-row overflow-x-auto sm:flex-col gap-1 sm:gap-0.5 sm:overflow-y-auto">
            {GRUP_NAV.map((grup, gi) => {
              const items = navItems.filter(n => n.group === grup.key);
              if (items.length === 0) return null;
              return (
                <div key={grup.key} className={`flex flex-row sm:flex-col shrink-0 sm:shrink gap-1 sm:gap-0.5 ${gi > 0 ? 'sm:mt-4 pl-2 sm:pl-0 ml-1 sm:ml-0 border-l sm:border-l-0 border-white/10' : ''}`}>
                  <p className="hidden sm:block px-3 pt-1 pb-1.5 text-[11px] font-bold tracking-widest uppercase text-white/30">
                    {grup.label}
                  </p>
                  {items.map(item => {
                    const isActive = activeSection === item.key;
                    return (
                      <button key={item.key} type="button" role="tab" aria-selected={isActive} onClick={() => setActiveSection(item.key)}
                        className="shrink-0 sm:w-full flex items-center gap-2 sm:gap-3 px-3 py-2 sm:py-2.5 rounded-xl text-left transition-all text-xs sm:text-sm font-semibold whitespace-nowrap"
                        style={isActive
                          ? { background: item.activeBg, border: `1px solid ${item.activeBorder}`, color: item.activeText }
                          : { background: 'transparent', border: '1px solid transparent', color: 'rgba(255,255,255,0.55)' }}
                        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.07)'; }}
                        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                        <span className={isActive ? '' : 'opacity-60'}><Ikon nama={item.icon} ukuran={15} /></span>
                        <span className="sm:truncate">{item.label}</span>
                        {isActive && <div className="hidden sm:block ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.color }} />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center gap-2 sm:gap-3 shrink-0"
            style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}>
            {pratinjau && (
              <button type="button" aria-label="Kembali ke menu Admin Panel" title="Kembali ke menu Admin Panel" onClick={() => setActiveSection(bagianSebelum.current)}
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-slate-600 hover:bg-slate-200/70 transition-colors">
                <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: activeNav.activeBg, border: `1px solid ${activeNav.activeBorder}`, color: activeNav.activeText }}>
              <Ikon nama={activeNav.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-slate-800 text-sm sm:text-base sm:leading-6 leading-tight">{activeNav.label}</h2>
              <p className={`text-slate-500 text-[11px] sm:text-xs ${pratinjau ? 'block' : 'hidden sm:block'}`}>
                {activeSection === 'settings' && 'Kelola akun user & hak akses menu'}
                {activeSection === 'userManagement' && 'Mapping Atasan, IVP & MVI Account & CC per User'}
                {activeSection === 'kodeAcara' && 'Pendaftaran acara tanpa persetujuan admin'}
                {activeSection === 'picBrand' && 'Mapping Brand PIC per divisi & produk'}
                {activeSection === 'kpiRoster' && 'Pilih anggota tim yang masuk dalam penilaian KPI'}
                {activeSection === 'merek' && 'Logo, nama, warna header & tampilan halaman login'}
                {activeSection === 'widgetDasbor' && 'Perubahan langsung terlihat di dashboard sebelah kanan'}
                {activeSection === 'kelompok' && 'Daftar kelompok kerja & lonceng yang boleh dilihat masing-masing'}
                {activeSection === 'integrasi' && 'Kanal notifikasi (In-App, WhatsApp, Telegram) & event mana lewat kanal mana'}
                {activeSection === 'android' && 'Unggah APK baru - langsung tampil di Profil untuk diunduh'}
                {activeSection === 'kesehatan' && 'Cron, kuota paket Free, keamanan basis data, pemakaian AI & WA'}
                {activeSection === 'keamanan' && 'Verifikasi 2 langkah (authenticator)'}
                {activeSection === 'lisensi' && 'Edisi & masa berlaku lisensi'}
              </p>
            </div>
            <button aria-label="Tutup" onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all text-slate-500 hover:text-slate-700"
              style={{ background: 'rgba(0,0,0,0.05)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#dc2626'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = ''; }}
              title="Tutup">
              <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeSection === 'settings' && <AccountSettingsInline />}
            {activeSection === 'userManagement' && <UserManagementInline />}
            {activeSection === 'kodeAcara' && <KodeAcaraInline />}
            {activeSection === 'picBrand' && <BrandPicSettingInline />}
            {activeSection === 'daftarPilihan' && <DaftarPilihanInline />}
            {activeSection === 'kpiRoster' && <KpiRosterInline />}
            {activeSection === 'merek' && <MerekSettingInline />}
            {activeSection === 'widgetDasbor' && <WidgetDasborInline />}
            {activeSection === 'kelompok' && (
              <><div className="px-4 pt-4"><KartuSuaraNotif /></div><KelompokSettingInline /></>
            )}
            {activeSection === 'integrasi' && (
              <div className="p-4"><BriefingPagiKartu /><IntegrasiInline /></div>
            )}
            {activeSection === 'android' && <AplikasiAndroidInline />}
            {activeSection === 'kesehatan' && <KesehatanInline />}
            {activeSection === 'keamanan' && <KeamananInline />}
            {activeSection === 'lisensi' && <LisensiInline />}
            {activeSection === 'perbandingan' && <AturanPerbandinganInline />}
          </div>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}
