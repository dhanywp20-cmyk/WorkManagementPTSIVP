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

// Notification Bar Component
interface NotificationBarProps {
  currentUser: User;
  onNavigate: (internalUrl: string, title: string, refId?: string) => void;
}

export function NotificationBar({ currentUser: userProp, onNavigate }: NotificationBarProps) {
  /** Panel rincian per bagian (badge total diketuk) - lihat PanelNotifBagian. */
  const [panelBuka, setPanelBuka] = useState(false);
  /*
    Distabilkan berdasar ISI - dashboard memanggil setCurrentUser() dua kali
    saat load (sesi tersimpan, lalu baris segar dari tabel users). Tanpa ini
    fetchAll berganti identitas, sehingga semua query badge dan 5 channel
    realtime di bawah dibongkar-pasang ulang tanpa ada data yang berubah.
  */
  const userKey = JSON.stringify(userProp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentUser = useMemo(() => userProp, [userKey]);
  const [ticketNotifs, setTicketNotifs]   = useState<NotificationItem[]>([]);
  const [requireNotifs, setRequireNotifs] = useState<NotificationItem[]>([]);
  const [reminderNotifs, setReminderNotifs] = useState<NotificationItem[]>([]);
  const [reviewNotifs, setReviewNotifs]   = useState<NotificationItem[]>([]);
  // User-specific in-app notifications (from `notifications` table)
  const [personalNotifs, setPersonalNotifs] = useState<NotificationItem[]>([]);
  /** Bertambah setiap fetchAll SELESAI (kelima daftar sudah terisi) - pemicu cek alarm suara. */
  const [putaranMuat, setPutaranMuat] = useState(0);

  //  Alarm suara - bunyi begitu ada ticket/notifikasi BARU, supaya orang yang
  //  membiarkan tab ini terbuka seharian tidak harus melirik layar terus.
  const { muted: soundMuted, toggleMuted: toggleSoundMuted, playIfAllowed: mainkanAlarm } = useNotifSoundAlarm();

  /*
    Push notification asli (bunyi + notifikasi sistem walau app/tab HP
    tertutup) - beda dari alarm suara di atas yang cuma bunyi SELAMA tab ini
    terbuka. 'unsupported' disembunyikan total (peramban lama/desktop
    tertentu memang tidak punya Push API - tombol yang tidak akan pernah
    berhasil lebih membingungkan daripada tidak ada).
  */
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

  /**
   * Satu saklar untuk suara DAN push - sebelumnya dua tombol terpisah
   * (speaker + HP) padahal bagi pengguna keduanya sama-sama berarti "beri
   * tahu aku ada notifikasi baru". Klik menyalakan/mematikan alarm suara
   * tab ini SEKALIGUS mencoba menyalakan/mematikan push perangkat kalau
   * peramban mendukungnya - kalau tidak didukung/diblokir, saklar tetap
   * bekerja sebagai alarm suara saja (soundMuted adalah sumber kebenaran).
   */
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
  // isAdmin di sini dipakai sebagai "lihat SEMUA notifikasi" (bukan hak kelola
  // akun) - jadi ikut diperluas ke akun Team PTS dengan toggle "Full Access"
  // aktif (lihat lib/constants.ts hasFullAccess), mis. Manager PTS.
  const isAdmin = ['admin', 'superadmin'].includes(roleLC) || hasFullAccess(currentUser);

  /**
   * Lonceng mana yang tampil - dibaca dari pengaturan kelompok di Admin Panel,
   * bukan dari deretan syarat yang menyebut nama kelompok satu per satu.
   *
   * Bentuk lama itulah yang membuat Team PTS MVI tidak pernah mendapat lonceng
   * Ticket, Require, dan Review: namanya memang tidak pernah disebut, dan
   * tidak ada tempat untuk memperbaikinya selain menyunting kode. Sekarang
   * kelompok baru cukup didaftarkan sekali beserta hak loncengnya.
   *
   * useKelompok() ikut dipanggil supaya lonceng dirender ulang begitu
   * pengaturannya termuat - tanpa itu, hak yang baru disimpan baru terlihat
   * setelah halaman dibuka ulang.
   */
  useKelompok();
  const bolehLonceng = (l: Lonceng) => loncengTampil({ peranAdmin: isAdmin, teamType, lonceng: l });
  const bolehTiket = bolehLonceng('tiket');
  const bolehRequire = bolehLonceng('require');
  const bolehJadwal = bolehLonceng('jadwal');
  const bolehReview = bolehLonceng('review');

  /**
   * Kelompok yang dibawahi akun ini. Akun yang TIDAK dipetakan di Admin Panel
   * mendapat seluruh kelompok, jadi selama belum ada satu pun pemetaan,
   * penyaringan di bawah tidak mengubah apa pun.
   *
   * Yang disaring hanya daftar milik akun berjangkauan luas (admin / Full
   * Access). Anggota tim biasa sudah tersaring lebih dulu oleh namanya
   * sendiri, jadi lingkup tidak menambah apa-apa di sana.
   */
  useLingkupManager();
  const lingkupKu = lingkupSaya(currentUser.id);
  const batasiLingkup = isAdmin && lingkupKu.length < namaKelompokPTS().length;
  // Dependensi berupa TEKS, bukan lariknya. lingkupSaya() membuat larik baru
  // tiap render; memakainya langsung sebagai dependensi membuat fetchAll
  // dibuat ulang tiap render, dan effect yang bergantung padanya berputar
  // tanpa henti - satu query ke database tiap kali komponen dirender.
  const kunciLingkup = lingkupKu.join('|');

  const { fetchAll } = useMuatNotifikasi({ batasiLingkup, bolehJadwal, bolehRequire, bolehReview, bolehTiket, currentUser, isAdmin, kunciLingkup, lingkupKu, roleLC, setPersonalNotifs, setPutaranMuat, setReminderNotifs, setRequireNotifs, setReviewNotifs, setTicketNotifs, teamType });

  /*
    NotificationBar terpasang di HAMPIR SETIAP halaman (header dashboard) -
    beda dari daftar Ticketing/Command Center yang cuma polling saat
    halaman itu sendiri dibuka. Sebelumnya interval ini jalan terus tiap 2
    menit TANPA peduli tab sedang dilihat atau tidak - satu tab yang
    dibiarkan terbuka seharian di background tetap menembak 6-7 query tiap
    2 menit. Pola berhenti-saat-tersembunyi yang sudah dipakai di Ticketing
    (lihat app/ticketing/page.tsx) diterapkan di sini juga.
  */
  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const mulaiPolling = () => {
      if (pollInterval) return;
      pollInterval = setInterval(fetchAll, 120_000); // setiap 2 menit
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

  /*
    Setiap tulis ke salah satu tabel ini, dari SIAPA PUN, memicu refetch di
    SEMUA sesi yang sedang terbuka - tersembunyi maupun tidak. Tab yang
    diminimize/pindah ke background tidak butuh data real-time (pengguna
    memang tidak sedang melihatnya); begitu dilihat lagi, useEffect polling
    di atas sudah menyegarkan sekali lewat visibilitychange. Guard ini
    mencegah tab-tab tersembunyi ikut menembak 6-7 query tiap kali ada
    satu ticket/request/reminder/review dibuat/diubah di mana pun.
  */
  const fetchAllJikaTerlihat = () => { if (document.visibilityState !== 'hidden') fetchAll(); };
  useEffect(() => {
    const ch1 = supabase.channel('dash-notif-tickets-v2').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => { setTimeout(fetchAllJikaTerlihat, 400); }).subscribe();
    const ch2 = supabase.channel('dash-notif-requires-v2').on('postgres_changes', { event: '*', schema: 'public', table: 'project_requests' }, () => { setTimeout(fetchAllJikaTerlihat, 400); }).subscribe();
    const ch3 = supabase.channel('dash-notif-reminders-v2').on('postgres_changes', { event: '*', schema: 'public', table: 'reminders' }, () => { setTimeout(fetchAllJikaTerlihat, 400); }).subscribe();
    const ch4 = supabase.channel('dash-notif-reviews-v2').on('postgres_changes', { event: '*', schema: 'public', table: 'form_reviews' }, () => { setTimeout(fetchAllJikaTerlihat, 400); }).subscribe();
    const ch5 = supabase.channel(`dash-notif-personal-${currentUser.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, () => { setTimeout(fetchAllJikaTerlihat, 400); }).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); supabase.removeChannel(ch4); supabase.removeChannel(ch5); };
  }, [fetchAll]);

  /*
    Alarm suara: dibunyikan begitu MUNCUL id notifikasi baru yang sebelumnya
    tidak ada di salah satu dari 5 daftar ini - bukan sekadar "totalCount
    berubah", karena total yang turun (item ditandai selesai/dibaca orang
    lain) tidak boleh ikut berbunyi.

    prevIdsRef sengaja mulai dari `null` (bukan Set kosong) supaya alarm
    TIDAK bunyi pada pemuatan pertama halaman - tanpa ini, siapa pun yang
    login dan langsung punya beberapa notifikasi lama akan disambut alarm,
    padahal tidak ada satu pun yang baru.

    Dicek sekali per fetchAll yang SELESAI (putaranMuat), bukan tiap kali
    salah satu daftar berubah: kelima daftar terisi bergantian di antara
    await, jadi dulu patokan awalnya terpasang saat semua masih kosong lalu
    tiap daftar yang datang dianggap "baru" - alarm berbunyi sampai 5x
    begitu aplikasi dibuka. Rentetan bunyi berdekatan juga diredam di
    useNotifSoundAlarm (sekali per jeda), walau notifikasinya banyak.
  */
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
    // Daftar dibaca dari render yang sama dengan putaranMuat (diset bersamaan); sengaja tidak jadi dependensi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [putaranMuat]);

  const handleClick = (item: NotificationItem) => {
    // Mark personal notification as read if it came from the `notifications` table
    if (personalNotifs.find(n => n.id === item.id)) {
      //  Promise.resolve: builder supabase-js kini PromiseLike (tanpa .catch).
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
      // Gagal di server - kembalikan tanda supaya tidak terlihat "sudah dibaca"
      // padahal masih tersimpan belum-dibaca di database.
      setPersonalNotifs(sebelum);
    });
  };

  /*
    C1 (docs/UX-WORKFLOW-AUDIT.md): personalNotifs (tabel `notifications` -
    peringatan KPI, "user baru menunggu approval", dst.) dulu di-fetch tapi
    TIDAK PERNAH dirender - tidak ada lonceng, tidak ada dropdown. Sekarang
    ikut render sebagai lonceng seperti Ticket/Require/Reminder/Review, dan
    ikut dihitung ke totalCount (badge merah ringkasan) - alasan lama
    mengeluarkannya ("tak punya chip") sudah tidak berlaku karena sekarang
    chip-nya ada.
  */
  const totalCount = ticketNotifs.length + requireNotifs.length + reminderNotifs.length + reviewNotifs.length + personalNotifs.length;

  // Personal bell is shown to ALL users regardless of team type
  // Other bells still respect team-type gating
  const hasAnyBell = true; // personal notif bell always renders

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
      {/* Total count badge — di depan (kiri). Bisa diketuk: membuka rincian
          per bagian (di HP inilah satu-satunya jalan melihat rinciannya). */}
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
      {/* Satu saklar notifikasi (suara + push HP jadi satu aksi, bukan dua
          ikon terpisah). soundMuted = sumber kebenaran status; push HP
          ikut nyala/mati mengikutinya kalau peramban mendukung & izinnya
          belum ditolak (lihat toggleNotifAlerts di atas). Status & alarm
          suara sendiri tetap per-browser (localStorage), bukan per-akun. */}
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
      {/* Separator — hidden on small mobile */}
      <div className="hidden sm:block w-px h-5 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.09)' }} />
      {/* Individual bells — hidden on small mobile (summary badge is enough) */}
      <div className="hidden sm:flex items-center gap-1">
        {/* Ticket */}
        {bolehTiket && (
          <NotifBell icon={IconTicket} label="Ticket" count={ticketNotifs.length} color="#be123c" bgColor="rgba(254,205,211,0.6)" borderColor="#fda4af" dotColor="#e11d48" items={ticketNotifs} onItemClick={handleClick} />
        )}
        {/* Require */}
        {bolehRequire && (
          <NotifBell icon={IconBriefcase} label="Require" count={requireNotifs.length} color="#7e22ce" bgColor="rgba(233,213,255,0.6)" borderColor="#c4b5fd" dotColor="#9333ea" items={requireNotifs} onItemClick={handleClick} />
        )}
        {/* Reminder — semua Team PTS (IVP/UMP/MVI), bukan cuma IVP, supaya Supervisor
            tim mana pun tetap dapat badge "perlu di-assign" (routing pipeline). */}
        {bolehJadwal && (
          <NotifBell icon={IconCalendar} label="Reminder" count={reminderNotifs.length} color="#0e7490" bgColor="rgba(207,250,254,0.6)" borderColor="#67e8f9" dotColor="#0891b2" items={reminderNotifs} onItemClick={handleClick} />
        )}
        {/* Review */}
        {bolehReview && (
          <NotifBell icon={IconStar} label="Review" count={reviewNotifs.length} color="#b45309" bgColor="rgba(254,243,199,0.6)" borderColor="#fcd34d" dotColor="#d97706" items={reviewNotifs} onItemClick={handleClick} />
        )}
        {/* Notifikasi personal (tabel `notifications`) - peringatan KPI, dst.
            Ditampilkan untuk SEMUA role, tidak digerbangi bolehLonceng seperti
            4 lonceng di atas karena isinya memang personal per akun. */}
        <NotifBell icon={IconBell} label="Notifikasi" count={personalNotifs.length} color="#4338ca" bgColor="rgba(224,231,255,0.6)" borderColor="#a5b4fc" dotColor="#4f46e5" items={personalNotifs} onItemClick={handleClick} onMarkAllRead={handleMarkAllPersonalRead} />
      </div>
    </div>
    </>
  );
}
export * from './modal-notifikasi-lonceng';
export * from './modal-notifikasi-panel';
