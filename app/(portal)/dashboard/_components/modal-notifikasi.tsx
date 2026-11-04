'use client';
import { ingat } from '@/lib/cache-singkat';
import { hasFullAccess } from '@/lib/constants';
import { lingkupSaya, loncengTampil, namaKelompokPTS, useKelompok, useLingkupManager, type Lonceng } from '@/lib/kelompok';
import { useNotifSoundAlarm } from '@/lib/notif-sound';
import { markAllNotifsRead } from '@/lib/notifications';
import { aktifkanPushNotif, matikanPushNotif, pushDidukung, statusIzinNotif, sudahBerlanggananPush } from '@/lib/push-client';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NotifBell } from './modal-notifikasi-lonceng';
import { BagianNotif, PanelNotifBagian } from './modal-notifikasi-panel';
import { IconBell, IconBriefcase, IconCalendar, IconSpeaker, IconStar, IconTicket } from './notif-icons';
import { NotificationItem, User } from './shared';
import { useMuatNotifikasi } from './useMuatNotifikasi';

interface NotificationBarProps {
  currentUser: User;
  onNavigate: (internalUrl: string, title: string, refId?: string) => void;
}

export function NotificationBar({ currentUser: userProp, onNavigate }: NotificationBarProps) {
  const [panelBuka, setPanelBuka] = useState(false);
  const userKey = JSON.stringify(userProp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentUser = useMemo(() => userProp, [userKey]);
  const [ticketNotifs, setTicketNotifs]   = useState<NotificationItem[]>([]);
  const [requireNotifs, setRequireNotifs] = useState<NotificationItem[]>([]);
  const [reminderNotifs, setReminderNotifs] = useState<NotificationItem[]>([]);
  const [reviewNotifs, setReviewNotifs]   = useState<NotificationItem[]>([]);
  const [personalNotifs, setPersonalNotifs] = useState<NotificationItem[]>([]);
  const [putaranMuat, setPutaranMuat] = useState(0);

  const { muted: soundMuted, toggleMuted: toggleSoundMuted, playIfAllowed: mainkanAlarm } = useNotifSoundAlarm();

  const [pushStatus, setPushStatus] = useState<'cek' | 'unsupported' | 'off' | 'denied' | 'on'>('cek');
  const [pushProses, setPushProses] = useState(false);
  const [pushGalat, setPushGalat] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!pushDidukung()) { setPushStatus('unsupported'); return; }
      const izin = statusIzinNotif();
      if (izin === 'denied') { setPushStatus('denied'); return; }
      const sudah = await sudahBerlanggananPush();
      setPushStatus(sudah ? 'on' : 'off');
    })();
  }, []);

  const toggleNotifAlerts = async () => {
    const akanAktif = soundMuted;
    toggleSoundMuted();
    if (pushStatus === 'unsupported' || pushStatus === 'denied') return;
    setPushGalat(null);
    setPushProses(true);
    try {
      if (akanAktif) {
        if (pushStatus !== 'on') {
          const hasil = await aktifkanPushNotif();
          if (hasil.ok) setPushStatus('on');
          else setPushGalat(hasil.alasan ?? 'Notifikasi HP gagal diaktifkan - alarm suara tetap aktif.');
        }
      } else if (pushStatus === 'on') {
        await matikanPushNotif();
        setPushStatus('off');
      }
    } finally {
      setPushProses(false);
    }
  };

  const roleLC = (currentUser.role ?? '').trim().toLowerCase();
  const teamType = (currentUser.team_type ?? '').trim();
  const isAdmin = ['admin', 'superadmin'].includes(roleLC) || hasFullAccess(currentUser);

  useKelompok();
  const bolehLonceng = (l: Lonceng) => loncengTampil({ peranAdmin: isAdmin, teamType, lonceng: l });
  const bolehTiket = bolehLonceng('tiket');
  const bolehRequire = bolehLonceng('require');
  const bolehJadwal = bolehLonceng('jadwal');
  const bolehReview = bolehLonceng('review');

  useLingkupManager();
  const lingkupKu = lingkupSaya(currentUser.id);
  const batasiLingkup = isAdmin && lingkupKu.length < namaKelompokPTS().length;
  const kunciLingkup = lingkupKu.join('|');

  const { fetchAll } = useMuatNotifikasi({ batasiLingkup, bolehJadwal, bolehRequire, bolehReview, bolehTiket, currentUser, isAdmin, kunciLingkup, lingkupKu, roleLC, setPersonalNotifs, setPutaranMuat, setReminderNotifs, setRequireNotifs, setReviewNotifs, setTicketNotifs, teamType });

  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const mulaiPolling = () => {
      if (pollInterval) return;
      pollInterval = setInterval(fetchAll, 120_000);
    };
    const hentikanPolling = () => {
      if (!pollInterval) return;
      clearInterval(pollInterval);
      pollInterval = null;
    };
    const saatVisibilitasBerubah = () => {
      if (document.visibilityState === 'hidden') { hentikanPolling(); return; }
      fetchAll();
      mulaiPolling();
    };
    fetchAll();
    if (document.visibilityState !== 'hidden') mulaiPolling();
    document.addEventListener('visibilitychange', saatVisibilitasBerubah);
    return () => {
      hentikanPolling();
      document.removeEventListener('visibilitychange', saatVisibilitasBerubah);
    };
  }, [fetchAll]);

  const fetchAllJikaTerlihat = () => { if (document.visibilityState !== 'hidden') fetchAll(); };
  useEffect(() => {
    const ch1 = supabase.channel('dash-notif-tickets-v2').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => { setTimeout(fetchAllJikaTerlihat, 400); }).subscribe();
    const ch2 = supabase.channel('dash-notif-requires-v2').on('postgres_changes', { event: '*', schema: 'public', table: 'project_requests' }, () => { setTimeout(fetchAllJikaTerlihat, 400); }).subscribe();
    const ch3 = supabase.channel('dash-notif-reminders-v2').on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => { setTimeout(fetchAllJikaTerlihat, 400); }).subscribe();
    const ch4 = supabase.channel('dash-notif-reviews-v2').on('postgres_changes', { event: '*', schema: 'public', table: 'form_reviews' }, () => { setTimeout(fetchAllJikaTerlihat, 400); }).subscribe();
    const ch5 = supabase.channel(`dash-notif-personal-${currentUser.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, () => { setTimeout(fetchAllJikaTerlihat, 400); }).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); supabase.removeChannel(ch4); supabase.removeChannel(ch5); };
  }, [fetchAll]);

  const prevNotifIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!putaranMuat) return;
    const idSekarang = new Set<string>([
      ...ticketNotifs.map(n => `tk:${n.id}`),
      ...requireNotifs.map(n => `rq:${n.id}`),
      ...reminderNotifs.map(n => `rm:${n.id}`),
      ...reviewNotifs.map(n => `rv:${n.id}`),
      ...personalNotifs.map(n => `pn:${n.id}`),
    ]);
    if (prevNotifIdsRef.current) {
      let adaBaru = false;
      for (const id of idSekarang) { if (!prevNotifIdsRef.current.has(id)) { adaBaru = true; break; } }
      if (adaBaru) mainkanAlarm();
    }
    prevNotifIdsRef.current = idSekarang;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [putaranMuat]);

  const handleClick = (item: NotificationItem) => {
    if (personalNotifs.find(n => n.id === item.id)) {
      Promise.resolve(supabase.from('notifications').update({ is_read: true }).eq('id', item.id))
        .then(() => setPersonalNotifs(p => p.filter(n => n.id !== item.id)))
        .catch(() => {});
    }
    if (item.internalUrl) onNavigate(item.internalUrl, item.menuTitle, item.refId ?? item.id);
  };

  const handleMarkAllPersonalRead = () => {
    const sebelum = personalNotifs;
    setPersonalNotifs([]);
    markAllNotifsRead(currentUser.id).catch(() => {
      setPersonalNotifs(sebelum);
    });
  };

  const totalCount = ticketNotifs.length + requireNotifs.length + reminderNotifs.length + reviewNotifs.length + personalNotifs.length;

  const hasAnyBell = true;

  const bagianNotif: BagianNotif[] = [
    ...(bolehTiket ? [{ kunci: 'tiket', label: 'Ticket', icon: IconTicket, color: '#be123c', bgColor: 'rgba(254,205,211,0.6)', dotColor: '#e11d48', items: ticketNotifs }] : []),
    ...(bolehRequire ? [{ kunci: 'require', label: 'Require', icon: IconBriefcase, color: '#7e22ce', bgColor: 'rgba(233,213,255,0.6)', dotColor: '#9333ea', items: requireNotifs }] : []),
    ...(bolehJadwal ? [{ kunci: 'reminder', label: 'Reminder', icon: IconCalendar, color: '#0e7490', bgColor: 'rgba(207,250,254,0.6)', dotColor: '#0891b2', items: reminderNotifs }] : []),
    ...(bolehReview ? [{ kunci: 'review', label: 'Review', icon: IconStar, color: '#b45309', bgColor: 'rgba(254,243,199,0.6)', dotColor: '#d97706', items: reviewNotifs }] : []),
    { kunci: 'personal', label: 'Notifikasi', icon: IconBell, color: '#4338ca', bgColor: 'rgba(224,231,255,0.6)', dotColor: '#4f46e5', items: personalNotifs, onMarkAllRead: handleMarkAllPersonalRead },
  ];

  return (
    <>
    {panelBuka && <PanelNotifBagian bagian={bagianNotif} onTutup={() => setPanelBuka(false)} onItemClick={handleClick} />}
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl"
      style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
      <button type="button" onClick={() => setPanelBuka(true)}
        aria-label={`Notifikasi: ${totalCount} - lihat rincian per bagian`} title="Lihat rincian notifikasi"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg flex-shrink-0 mr-1 min-h-[28px] transition-transform active:scale-95"
        style={totalCount > 0
          ? { background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 1px 4px rgba(220,38,38,0.35)' }
          : { background: 'rgba(0,0,0,0.05)' }}>
        <svg aria-hidden="true" focusable="false" className="w-4 h-4" style={{ color: totalCount > 0 ? '#fff' : '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {totalCount > 0 && <span className="text-white font-bold text-xs leading-none">{totalCount}</span>}
      </button>
      <div className="relative">
        <button type="button" onClick={toggleNotifAlerts} disabled={pushProses}
          aria-label={soundMuted ? 'Aktifkan notifikasi' : 'Matikan notifikasi'}
          title={
            pushStatus === 'denied'
              ? `Alarm suara: ${soundMuted ? 'MATI' : 'AKTIF'} - notifikasi HP diblokir peramban, aktifkan lewat pengaturan situs`
              : pushStatus === 'on'
              ? `Notifikasi (suara & HP): ${soundMuted ? 'MATI' : 'AKTIF'} - klik untuk ${soundMuted ? 'aktifkan' : 'matikan'}`
              : `Alarm suara: ${soundMuted ? 'MATI' : 'AKTIF'} - klik untuk ${soundMuted ? 'aktifkan' : 'matikan'}`
          }
          className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          style={{ background: soundMuted ? 'rgba(0,0,0,0.05)' : 'rgba(79,70,229,0.12)', border: `1px solid ${soundMuted ? 'rgba(0,0,0,0.1)' : 'rgba(79,70,229,0.3)'}` }}>
          {pushProses ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" aria-hidden="true" />
          ) : (
            <IconSpeaker muted={soundMuted} className="w-4 h-4" style={{ color: soundMuted ? '#94a3b8' : '#4338ca' }} />
          )}
        </button>
        {pushGalat && (
          <div className="absolute top-full mt-2 right-0 z-[50] w-56 px-3 py-2 rounded-xl text-[11px] font-medium text-white shadow-xl"
            style={{ background: '#991b1b' }}>
            {pushGalat}
          </div>
        )}
      </div>
      <div className="hidden sm:block w-px h-5 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.09)' }} />
      <div className="hidden sm:flex items-center gap-1">
        {bolehTiket && (
          <NotifBell icon={IconTicket} label="Ticket" count={ticketNotifs.length} color="#be123c" bgColor="rgba(254,205,211,0.6)" borderColor="#fda4af" dotColor="#e11d48" items={ticketNotifs} onItemClick={handleClick} />
        )}
        {bolehRequire && (
          <NotifBell icon={IconBriefcase} label="Require" count={requireNotifs.length} color="#7e22ce" bgColor="rgba(233,213,255,0.6)" borderColor="#c4b5fd" dotColor="#9333ea" items={requireNotifs} onItemClick={handleClick} />
        )}
        {bolehJadwal && (
          <NotifBell icon={IconCalendar} label="Reminder" count={reminderNotifs.length} color="#0e7490" bgColor="rgba(207,250,254,0.6)" borderColor="#67e8f9" dotColor="#0891b2" items={reminderNotifs} onItemClick={handleClick} />
        )}
        {bolehReview && (
          <NotifBell icon={IconStar} label="Review" count={reviewNotifs.length} color="#b45309" bgColor="rgba(254,243,199,0.6)" borderColor="#fcd34d" dotColor="#d97706" items={reviewNotifs} onItemClick={handleClick} />
        )}
        <NotifBell icon={IconBell} label="Notifikasi" count={personalNotifs.length} color="#4338ca" bgColor="rgba(224,231,255,0.6)" borderColor="#a5b4fc" dotColor="#4f46e5" items={personalNotifs} onItemClick={handleClick} onMarkAllRead={handleMarkAllPersonalRead} />
      </div>
    </div>
    </>
  );
}
export * from './modal-notifikasi-lonceng';
export * from './modal-notifikasi-panel';
