'use client';

/**
 * Admin Panel -> Integrations. Mengatur kanal notifikasi (In-App, WhatsApp,
 * Telegram) dan event mana lewat kanal mana.
 *
 * TOKEN DIATUR DI SINI, tapi TIDAK LEWAT app_settings.
 *
 * app_settings dibaca lewat PostgREST memakai anon key, dan anon key ikut
 * ter-bundle ke setiap peramban - siapa pun bisa mengambilnya dari DevTools
 * lalu membaca tabelnya langsung, tanpa lewat halaman ini dan tanpa perlu
 * jadi admin. Menu yang disembunyikan tidak menghalangi apa pun. Persis
 * begitulah token WhatsApp sebelumnya terbaca.
 *
 * Karena itu token tinggal di tabel rahasia_integrasi, yang RLS-nya menyala
 * TANPA policy sama sekali - anon ditolak seluruhnya, hanya service_role di
 * sisi server yang bisa masuk (sql/rahasia-integrasi.sql). Halaman ini
 * menyentuhnya lewat /api/integrasi/rahasia, yang memeriksa cookie sesi
 * pemanggil ke tabel user_sessions sebelum melakukan apa pun.
 *
 * Akibatnya yang penting: nilai token TIDAK PERNAH dikirim balik ke peramban.
 * Yang tampil di layar cuma penanda seperti "…4f2a". Membuka DevTools,
 * memeriksa Network, atau membaca state React tidak akan menemukan tokennya -
 * memang tidak pernah sampai ke sana.
 */

import { useEffect, useState } from 'react';
import {
  KANAL, bacaPengaturan, simpanPengaturan, kanalUntuk,
  type Kanal, type PengaturanNotifikasi,
} from '@/lib/notifikasi/pengaturan';
import { ambilPengaturanAI, simpanPengaturanAI, AI_BAWAAN, type PengaturanAI,
  ambilPengaturanPenilai, simpanPengaturanPenilai, PENILAI_BAWAAN, type PengaturanPenilai } from '@/lib/ai-pengaturan';
import { KATALOG_EVENT, EVENT_TERSAMBUNG, eventTersambung, type KategoriEvent } from '@/lib/notifikasi/katalog';
import { PENYEDIA_WA, penyediaWA } from '@/lib/notifikasi/penyedia-wa';
import { supabase } from '@/lib/supabase';
import { ConfirmDialog, type ConfirmState } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { SeksiAI } from './integrasi/SeksiAI';
import { SeksiTim } from './integrasi/SeksiTim';
import { SeksiPush } from './integrasi/SeksiPush';
import { SeksiTelegram } from './integrasi/SeksiTelegram';
import { SeksiWhatsApp } from './integrasi/SeksiWhatsApp';
import { SeksiKanal } from './integrasi/SeksiKanal';

export const JUDUL_KATEGORI: Record<KategoriEvent, string> = {
  ticket: 'Ticket', approval: 'Approval', assignment: 'Assignment',
  reminder: 'Reminder', schedule: 'Jadwal', project: 'Project', system: 'Sistem',
};

/*
  Pemilih model - daftarnya DITANYAKAN ke Google, tidak ditulis di kode.

  Sebelumnya ini isian teks bebas. Nama model yang salah tidak gagal saat
  disimpan; ia gagal nanti, saat seseorang menekan tombol AI, dengan pesan 404
  yang tidak menyebut nama mana yang keliru. Daftar model juga berbeda antar
  kunci dan antar wilayah, jadi daftar tertutup di kode pun akan menawarkan
  nama yang tidak ada pada kunci ini.

  Isian teks tetap ada, tapi hanya bila daftarnya tidak bisa dibaca - tanpa
  jalan apa pun, token yang bermasalah membuat modelnya terkunci.
*/
export function PilihModel({ nilai, profil, onGanti, warna }: {
  nilai: string;
  profil?: 'penilai';
  onGanti: (m: string) => void;
  warna: 'sky' | 'violet';
}) {
  const [daftar, setDaftar] = useState<{ id: string; nama: string }[]>([]);
  const [galat, setGalat] = useState('');
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    let batal = false;
    fetch(`/api/ai/model${profil ? `?profil=${profil}` : ''}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error?.message ?? 'Gagal membaca daftar model.');
        return d;
      })
      .then(d => { if (!batal) { setDaftar(d?.model ?? []); setGalat(''); } })
      .catch(e => { if (!batal) setGalat(e instanceof Error ? e.message : 'Gagal membaca daftar model.'); })
      .finally(() => { if (!batal) setMemuat(false); });
    return () => { batal = true; };
  }, [profil]);

  const fokus = warna === 'violet' ? 'focus:border-violet-400' : 'focus:border-sky-400';

  if (memuat) return <p className="text-[11px] text-slate-500 py-2">Memuat daftar model…</p>;

  if (daftar.length === 0) {
    return (
      <>
        <input value={nilai} onChange={e => onGanti(e.target.value)}
          aria-label="Nama model AI"
          className={`w-full text-xs px-2.5 py-2 rounded-lg border border-amber-300 focus:outline-none ${fokus}`} />
        <p className="text-[10px] text-amber-700 mt-1 leading-relaxed">
          Daftar model tidak bisa dibaca{galat ? ` (${galat})` : ''} — ketik nama modelnya.
          Periksa tokennya lebih dulu; nama yang salah baru ketahuan saat AI dipakai.
        </p>
      </>
    );
  }

  return (
    <>
      <select value={nilai} onChange={e => onGanti(e.target.value)}
        aria-label="Model AI"
        className={`w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none ${fokus}`}>
        {/* Model tersimpan yang tidak ada di daftar tetap ditampilkan - kalau
            tidak, ia diam-diam tergantikan baris pertama dan pemakainya
            mengira itulah yang selama ini terpakai. */}
        {nilai && !daftar.some(m => m.id === nilai) && (
          <option value={nilai}>{nilai} — tidak ada di daftar</option>
        )}
        {daftar.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
      </select>
      <p className="text-[10px] text-slate-500 mt-1">
        {daftar.length} model tersedia untuk token ini — dibaca langsung dari Google, jadi tidak pernah basi.
      </p>
    </>
  );
}

export function Saklar({ aktif, onKlik, warna }: { aktif: boolean; onKlik: () => void; warna: string }) {
  return (
    <button type="button" onClick={onKlik} role="switch" aria-checked={aktif}
      className="relative w-9 h-5 rounded-full transition-colors flex-shrink-0"
      style={{ background: aktif ? warna : '#cbd5e1' }}>
      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
        style={{ left: aktif ? 18 : 2 }} />
    </button>
  );
}

export interface StatusRahasia {
  terisi: boolean; penanda?: string; diperbarui?: string; oleh?: string;
  /** true = nilainya masih berasal dari variabel lingkungan, belum dari Admin Panel. */
  dariEnv?: boolean;
}

/*
  ── STATUS KONEKSI SEBAGAI KEADAAN YANG TERLIHAT ────────────────────────────

  Sebelum ini satu-satunya cara mengetahui sebuah kanal hidup atau tidak adalah
  menekan "Tes Koneksi" lalu membaca kalimat yang muncul di DASAR panel - jauh
  di bawah tombolnya, sering di luar layar. Menekan tombol dan tidak melihat
  apa pun berubah tidak bisa dibedakan dari tombol yang rusak, dan itulah yang
  dirasakan: "klik test pun tidak ada notif apa-apa".

  Sekarang keadaannya dibaca sendiri saat panel dibuka dan ditampilkan sebagai
  lencana di kepala tiap kartu, dan hasil tiap tombol muncul DI KARTU ITU
  JUGA - di tempat mata sedang menatap.
*/
export type StatusKoneksi =
  | { keadaan: 'memuat' }
  | { keadaan: 'terhubung'; info: string }
  | { keadaan: 'putus'; alasan: string };

export type PesanKotak = { tipe: 'ok' | 'gagal'; teks: string };

export function LencanaStatus({ status }: { status: StatusKoneksi }) {
  const gaya = status.keadaan === 'terhubung'
    ? { bg: '#dcfce7', fg: '#15803d', titik: '#22c55e', teks: 'Terhubung' }
    : status.keadaan === 'memuat'
      ? { bg: '#f1f5f9', fg: '#64748b', titik: '#94a3b8', teks: 'Mengecek…' }
      : { bg: '#fef3c7', fg: '#b45309', titik: '#f59e0b', teks: 'Belum Terhubung' };
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
      style={{ background: gaya.bg, color: gaya.fg }}
      title={status.keadaan === 'putus' ? status.alasan
             : status.keadaan === 'terhubung' ? status.info : 'Sedang memeriksa koneksi…'}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: gaya.titik }} />
      {gaya.teks}
    </span>
  );
}

/**
 * Hasil sebuah tombol, ditampilkan tepat di bawah tombolnya.
 *
 * Ini yang paling menentukan: umpan balik yang benar tapi berada di luar
 * layar sama tidak bergunanya dengan tidak ada umpan balik sama sekali.
 */
export function PesanKotak({ pesan }: { pesan: PesanKotak | null }) {
  if (!pesan) return null;
  const ok = pesan.tipe === 'ok';
  return (
    <div className="mt-2 rounded-lg px-2.5 py-2 flex items-start gap-1.5"
      role="status" aria-live="polite"
      style={{
        background: ok ? '#f0fdf4' : '#fef2f2',
        border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
      }}>
      <span className="text-[11px] leading-none mt-px flex-shrink-0">{ok ? '✅' : '⚠️'}</span>
      <span className={`text-[11px] font-semibold leading-relaxed ${ok ? 'text-green-700' : 'text-red-600'}`}>
        {pesan.teks}
      </span>
    </div>
  );
}

/** Penanda bisa/tidak dijangkau di tabel Jangkauan Tim. */
export function Cek({ ya }: { ya?: boolean }) {
  return (
    <span className={`inline-grid place-items-center w-[19px] h-[19px] rounded-full text-[11px] font-black ${
      ya ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
      {ya ? '✓' : '✕'}
    </span>
  );
}

/**
 * Satu blok pengaturan token. Kolom isiannya SELALU berangkat kosong - yang
 * tersimpan diwakili penanda di sebelahnya. Menampilkan nilai tersimpan di
 * kolom isian berarti mengirimkannya ke peramban, dan itu membatalkan seluruh
 * maksud tabel rahasia_integrasi.
 */
export function BlokToken({
  judul, kunci, status, petunjuk, onSimpan, onHapus,
}: {
  judul: string; kunci: string; status?: StatusRahasia; petunjuk: React.ReactNode;
  onSimpan: (nilai: string) => Promise<void>; onHapus: () => Promise<void>;
}) {
  const [nilai, setNilai] = useState('');
  const [sibuk, setSibuk] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50/60">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[11px] font-bold text-slate-600 flex-1">{judul}</span>
        {/* Tiga keadaan, bukan dua. Token yang masih berasal dari variabel
            lingkungan itu AKTIF - menampilkannya sebagai "belum diisi" membuat
            admin mengira fiturnya mati, lalu mengisi ulang token baru padahal
            yang lama masih dipakai dan sah. */}
        {status?.terisi && status.dariEnv ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700"
            title="Nilai bawaan dari variabel lingkungan server. Sudah aktif — isi di sini hanya bila ingin menggantinya.">
            bawaan {status.penanda}
          </span>
        ) : status?.terisi ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
            terisi {status.penanda}
          </span>
        ) : (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">belum diisi</span>
        )}
      </div>
      <div className="flex gap-1.5">
        <input
          type="password" value={nilai} onChange={e => setNilai(e.target.value)}
          placeholder={status?.dariEnv ? 'pakai bawaan server — isi untuk menggantinya…'
                       : status?.terisi ? 'isi untuk mengganti…' : 'tempel token di sini'}
          autoComplete="new-password"
          className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-sky-400" />
        <button type="button" disabled={sibuk || !nilai.trim()}
          onClick={async () => { setSibuk(true); await onSimpan(nilai.trim()); setNilai(''); setSibuk(false); }}
          className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-40 flex-shrink-0">
          Simpan
        </button>
        {/* Hapus hanya untuk nilai yang memang TERSIMPAN di basis data.
            Token bawaan dari variabel lingkungan tidak bisa dihapus dari sini -
            tombolnya akan tampak berhasil lalu tokennya tetap ada, dan itu
            jenis kebohongan kecil yang membuat orang berhenti percaya layar. */}
        {status?.terisi && !status.dariEnv && (
          <button type="button" disabled={sibuk}
            onClick={async () => { setSibuk(true); await onHapus(); setSibuk(false); }}
            className="text-[11px] font-bold px-2 py-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40 flex-shrink-0">
            Hapus
          </button>
        )}
      </div>
      {status?.terisi && status.diperbarui && (
        <div className="text-[10px] text-slate-500 mt-1">
          Diperbarui {new Date(status.diperbarui).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          {status.oleh ? ` oleh ${status.oleh}` : ''}
        </div>
      )}
      <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{petunjuk}</p>
    </div>
  );
}

export function IntegrasiInline() {
  const [p, setP] = useState<PengaturanNotifikasi | null>(null);
  const [simpan, setSimpan] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'gagal'; teks: string } | null>(null);
  const [ujiJalan, setUjiJalan] = useState<string | null>(null);
  const [rahasia, setRahasia] = useState<Record<string, StatusRahasia>>({});
  const [waTujuan, setWaTujuan] = useState('');
  /** Status koneksi per kanal, dibaca sendiri saat panel dibuka. */
  const [koneksi, setKoneksi] = useState<Record<'telegram' | 'whatsapp', StatusKoneksi>>({
    telegram: { keadaan: 'memuat' }, whatsapp: { keadaan: 'memuat' },
  });
  /** Pesan hasil tombol, per kartu - supaya muncul di tempat tombolnya. */
  const [pesanKanal, setPesanKanal] = useState<Record<string, PesanKotak | null>>({});
  /** Percakapan yang terdeteksi menyapa bot - hasil tombol "Deteksi Chat ID". */
  const [chatTerdeteksi, setChatTerdeteksi] = useState<{ id: string; nama: string; jenis: string }[] | null>(null);
  const [deteksiJalan, setDeteksiJalan] = useState(false);
  /**
   * Bagian yang sedang dibuka.
   *
   * Dulu seluruh isi layar ini satu gulungan panjang: saklar kanal, WhatsApp,
   * Telegram, lalu pengaturan AI Learning Center yang sama sekali bukan urusan
   * notifikasi. Akibatnya hal yang paling sering disentuh terdorong jauh ke
   * bawah, dan tombol Simpan-nya lebih jauh lagi.
   */
  const [seksi, setSeksi] = useState<'kanal' | 'wa' | 'tg' | 'push' | 'tim' | 'ai'>('kanal');
  /** Push notification asli (aplikasi/PWA) - status kunci VAPID + jumlah perangkat terdaftar. */
  const [pushInfo, setPushInfo] = useState<{ aktif: boolean; jumlahPerangkat: number } | null>(null);
  const [pushMemuat, setPushMemuat] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [pushPesan, setPushPesan] = useState<{ tipe: 'ok' | 'gagal'; teks: string } | null>(null);
  /** Siapa yang benar-benar bisa dijangkau lewat kanal apa. */
  const [tim, setTim] = useState<{ nama: string; tim: string; jabatan: string; wa: boolean; tg: boolean }[]>([]);
  /** Penyaring matriks - 22 baris terlalu banyak untuk dipindai dengan mata. */
  const [cariEvent, setCariEvent] = useState('');
  /* Pengaturan pembuat soal AI - lihat lib/ai-pengaturan.ts. */
  const [ai, setAi] = useState<PengaturanAI>(AI_BAWAAN);
  const [penilai, setPenilai] = useState<PengaturanPenilai>(PENILAI_BAWAAN);

  const muatPushInfo = async () => {
    try {
      const r = await fetch('/api/push/setup', { credentials: 'include' });
      const j = await r.json() as { ok?: boolean; aktif?: boolean; jumlahPerangkat?: number };
      if (j?.ok) setPushInfo({ aktif: !!j.aktif, jumlahPerangkat: j.jumlahPerangkat ?? 0 });
    } catch { /* diam - kartu akan tampil "belum diketahui" */ }
  };

  /** aktifkan=true untuk penyalaan pertama, false untuk "Generate Ulang Kunci" (force). */
  const aktifkanPushServer = async (paksa: boolean) => {
    setPushMemuat(true);
    setPushPesan(null);
    try {
      const r = await fetch(`/api/push/setup${paksa ? '?force=1' : ''}`, { method: 'POST', credentials: 'include' });
      const j = await r.json() as { ok?: boolean; alasan?: string };
      if (j?.ok) {
        setPushPesan({ tipe: 'ok', teks: paksa ? 'Kunci baru dibuat. Semua perangkat lama perlu mendaftar ulang.' : 'Push notification aktif!' });
        await muatPushInfo();
      } else {
        setPushPesan({ tipe: 'gagal', teks: j?.alasan ?? 'Gagal mengaktifkan.' });
      }
    } catch {
      setPushPesan({ tipe: 'gagal', teks: 'Tidak bisa menghubungi server.' });
    } finally {
      setPushMemuat(false);
    }
  };

  const muatRahasia = async () => {
    try {
      const r = await fetch('/api/integrasi/rahasia', { credentials: 'include' });
      const j = await r.json() as { ok?: boolean; status?: Record<string, StatusRahasia> };
      if (j?.ok && j.status) setRahasia(j.status);
    } catch { /* diam - blok token akan tampil "belum diisi" */ }
  };

  /**
   * Membaca keadaan sebuah kanal tanpa mengirim pesan ke siapa pun.
   *
   * Dipanggil saat panel dibuka dan setiap kali tokennya berubah, supaya
   * lencana di kepala kartu selalu menggambarkan keadaan sekarang - bukan
   * keadaan saat terakhir kali seseorang ingat menekan Tes Koneksi.
   */
  const cekKoneksi = async (kanal: 'telegram' | 'whatsapp') => {
    setKoneksi(s => ({ ...s, [kanal]: { keadaan: 'memuat' } }));
    try {
      const r = await fetch(`/api/notifikasi/${kanal}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aksi: 'cek' }),
      });
      const j = await r.json() as { ok?: boolean; alasan?: string; bot?: string; perangkat?: string };
      setKoneksi(s => ({
        ...s,
        [kanal]: j?.ok
          ? { keadaan: 'terhubung', info: kanal === 'telegram' ? (j.bot ?? '') : (j.perangkat ?? '') }
          : { keadaan: 'putus', alasan: j?.alasan ?? 'Tidak diketahui.' },
      }));
    } catch {
      setKoneksi(s => ({ ...s, [kanal]: { keadaan: 'putus', alasan: 'Tidak bisa menghubungi server.' } }));
    }
  };

  /**
   * Jangkauan tim: siapa punya nomor WA, siapa sudah menghubungkan Telegram.
   *
   * Ini yang sebelumnya tidak terjawab di mana pun - "kenapa si anu tidak
   * dapat notifikasi" hanya bisa dijawab dengan membuka Supabase.
   */
  const muatTim = async () => {
    const { data } = await supabase.from('users')
      .select('full_name, team_type, jabatan, phone_number, telegram_chat_id')
      .eq('role', 'team')
      .order('full_name');
    setTim((data ?? []).map((u: {
      full_name: string; team_type: string | null; jabatan: string | null;
      phone_number: string | null; telegram_chat_id: string | null;
    }) => ({
      nama: u.full_name,
      tim: u.team_type ?? '-',
      jabatan: u.jabatan ?? 'Staff',
      wa: !!(u.phone_number ?? '').trim(),
      tg: !!u.telegram_chat_id,
    })));
  };

  useEffect(() => {
    bacaPengaturan(true).then(setP);
    muatRahasia();
    ambilPengaturanAI().then(setAi);
    ambilPengaturanPenilai().then(setPenilai);
    void muatTim();
    void cekKoneksi('telegram');
    void cekKoneksi('whatsapp');
    void muatPushInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const simpanRahasia = async (kunci: string, nilai: string) => {
    try {
      const r = await fetch('/api/integrasi/rahasia', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kunci, nilai }),
      });
      const j = await r.json() as { ok?: boolean; alasan?: string };
      setPesan(j?.ok ? { tipe: 'ok', teks: 'Token tersimpan.' }
                     : { tipe: 'gagal', teks: j?.alasan ?? 'Gagal menyimpan token.' });
      if (j?.ok) {
        await muatRahasia();
        // Token baru = keadaan koneksi berubah. Tanpa ini lencananya masih
        // menunjukkan hasil pengecekan token yang LAMA.
        await segarkanKoneksiUntuk(kunci);
      }
    } catch { setPesan({ tipe: 'gagal', teks: 'Tidak bisa menghubungi server.' }); }
  };

  /** Kunci rahasia mana milik kanal mana - dipakai untuk menyegarkan lencana. */
  const segarkanKoneksiUntuk = async (kunci: string) => {
    if (kunci.startsWith('telegram.')) await cekKoneksi('telegram');
    else if (kunci.startsWith('whatsapp.')) await cekKoneksi('whatsapp');
  };

  const hapusRahasia = async (kunci: string) => {
    try {
      const r = await fetch(`/api/integrasi/rahasia?kunci=${encodeURIComponent(kunci)}`,
        { method: 'DELETE', credentials: 'include' });
      const j = await r.json() as { ok?: boolean; alasan?: string };
      setPesan(j?.ok ? { tipe: 'ok', teks: 'Token dihapus.' }
                     : { tipe: 'gagal', teks: j?.alasan ?? 'Gagal menghapus.' });
      if (j?.ok) { await muatRahasia(); await segarkanKoneksiUntuk(kunci); }
    } catch { setPesan({ tipe: 'gagal', teks: 'Tidak bisa menghubungi server.' }); }
  };

  if (!p) return <div className="text-xs text-slate-500 py-8 text-center">Memuat…</div>;

  const ubah = (f: (x: PengaturanNotifikasi) => PengaturanNotifikasi) => {
    setP(f({ ...p, aktif: { ...p.aktif }, perEvent: { ...p.perEvent } }));
    setPesan(null);
  };

  const toggleEvent = (key: string, k: Kanal) => ubah(x => {
    //  Nilai awal diambil dari kanal yang BERLAKU sekarang (termasuk bawaan),
    //  bukan dari x.perEvent yang mungkin masih kosong. Tanpa ini, klik
    //  pertama pada event yang belum pernah disunting akan menghapus seluruh
    //  kanal bawaannya alih-alih mengubah satu.
    const kini = x.perEvent[key] ?? (KATALOG_EVENT.find(e => e.key === key)?.bawaanKanal as Kanal[]) ?? [];
    const baru = kini.includes(k) ? kini.filter(v => v !== k) : [...kini, k];
    return { ...x, perEvent: { ...x.perEvent, [key]: baru } };
  });

  const simpanSekarang = async () => {
    setSimpan(true);
    // Keduanya disimpan sekaligus. Tombol Simpan yang hanya menyimpan sebagian
    // isi layar adalah cara paling mudah kehilangan pengaturan tanpa sadar.
    const [r, rAi] = await Promise.all([simpanPengaturan(p), simpanPengaturanAI(ai), simpanPengaturanPenilai(penilai)]);
    setSimpan(false);
    const gagal = !r.ok ? r.pesan : !rAi.ok ? rAi.pesan : null;
    setPesan(gagal ? { tipe: 'gagal', teks: gagal }
                   : { tipe: 'ok', teks: 'Pengaturan tersimpan.' });
  };

  const uji = async (kanal: 'telegram' | 'whatsapp', aksi: 'cek' | 'kirim') => {
    const tanda = `${kanal}-${aksi}`;
    setUjiJalan(tanda);
    setPesan(null);
    setPesanKanal(s => ({ ...s, [kanal]: null }));
    try {
      const isi = kanal === 'telegram'
        ? (aksi === 'cek' ? { aksi: 'cek' }
           : { chatId: p.telegramChatId, pesan: '✅ Tes dari Work Management — integrasi Telegram berhasil.' })
        : (aksi === 'cek' ? { aksi: 'cek' }
           : { target: waTujuan, pesan: '✅ Tes dari Work Management — integrasi WhatsApp berhasil.' });
      const r = await fetch(`/api/notifikasi/${kanal}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isi),
      });
      const j = await r.json() as { ok?: boolean; alasan?: string; bot?: string; perangkat?: string };
      const berhasil = aksi === 'cek'
        ? (kanal === 'telegram' ? `Bot tersambung: @${j.bot}` : `Perangkat tersambung: ${j.perangkat}`)
        : kanal === 'telegram'
          ? `Pesan tes terkirim ke chat ${p.telegramChatId}. Cek Telegram Anda.`
          : `Pesan tes terkirim ke ${waTujuan}. Cek WhatsApp-nya.`;
      const hasil: PesanKotak = j?.ok
        ? { tipe: 'ok', teks: berhasil }
        : { tipe: 'gagal', teks: j?.alasan ?? 'Gagal, tanpa keterangan dari server.' };
      //  Ditaruh di kartunya, BUKAN hanya di dasar panel: tombolnya ada di
      //  tengah daftar yang panjang, jadi jawaban di dasar panel sering tidak
      //  terlihat sama sekali dan tombolnya terasa seperti tidak berfungsi.
      setPesanKanal(s => ({ ...s, [kanal]: hasil }));
      // 'cek' otomatis memperbarui lencana; 'kirim' yang berhasil juga
      // membuktikan kanalnya hidup.
      if (aksi === 'cek') {
        setKoneksi(s => ({
          ...s,
          [kanal]: j?.ok
            ? { keadaan: 'terhubung', info: kanal === 'telegram' ? (j.bot ?? '') : (j.perangkat ?? '') }
            : { keadaan: 'putus', alasan: j?.alasan ?? 'Tidak diketahui.' },
        }));
      } else if (j?.ok) {
        void cekKoneksi(kanal);
      }
    } catch {
      setPesanKanal(s => ({ ...s, [kanal]: { tipe: 'gagal', teks: 'Tidak bisa menghubungi server.' } }));
    }
    setUjiJalan(null);
  };

  /**
   * Membacakan percakapan yang sudah menyapa bot, beserta id-nya.
   *
   * Menggantikan petunjuk "kirim /id ke bot": bot BotFather tidak menjawab
   * perintah apa pun sampai ada yang menuliskan pemrosesnya, dan platform ini
   * tidak punya. Lihat catatan panjang di app/api/notifikasi/telegram/route.ts.
   */
  const deteksiChat = async () => {
    setDeteksiJalan(true);
    setPesanKanal(s => ({ ...s, telegram: null }));
    try {
      const r = await fetch('/api/notifikasi/telegram', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aksi: 'chat' }),
      });
      const j = await r.json() as { ok?: boolean; alasan?: string; chat?: { id: string; nama: string; jenis: string }[] };
      if (j?.ok && j.chat?.length) {
        setChatTerdeteksi(j.chat);
        setPesanKanal(s => ({
          ...s,
          telegram: { tipe: 'ok', teks: `${j.chat!.length} percakapan terbaca — pilih salah satu di bawah.` },
        }));
      } else {
        setChatTerdeteksi(null);
        setPesanKanal(s => ({ ...s, telegram: { tipe: 'gagal', teks: j?.alasan ?? 'Tidak ada percakapan terbaca.' } }));
      }
    } catch {
      setPesanKanal(s => ({ ...s, telegram: { tipe: 'gagal', teks: 'Tidak bisa menghubungi server.' } }));
    }
    setDeteksiJalan(false);
  };

  const kategori = Array.from(new Set(KATALOG_EVENT.map(e => e.kategori)));
  const spWA = penyediaWA(p.waPenyedia);

  const cocokCari = (label: string, kunci: string) => {
    const q = cariEvent.trim().toLowerCase();
    return !q || `${label} ${kunci}`.toLowerCase().includes(q);
  };

  /*
    ── SUSUNAN LAYAR ───────────────────────────────────────────────────────

    Sebelumnya satu gulungan panjang: saklar kanal, kartu WhatsApp, kartu
    Telegram, lalu dua blok pengaturan AI Learning Center - yang sama sekali
    bukan urusan notifikasi tapi ikut menumpuk di sini. Tombol Simpan ada di
    dasar semuanya, dan hasil tombol uji ditulis di sebelahnya, jadi menekan
    "Tes Koneksi" di tengah layar tidak terlihat menghasilkan apa pun.

    Sekarang: satu strip kesehatan di atas (menjawab "tim saya bisa dijangkau
    tidak?" sebelum satu pun setelan dibuka), lalu rail bagian di kiri dan
    isinya di kanan. Matriks Event -> Kanal - satu-satunya bagian yang memang
    sudah enak dipakai - dipertahankan modelnya, hanya dikeluarkan dari panel
    geser supaya tidak perlu dibuka dulu. Bilah Simpan menempel di bawah.
  */

  const totalTim = tim.length;
  const timWA = tim.filter(t => t.wa).length;
  const timTG = tim.filter(t => t.tg).length;
  const belumTG = totalTim - timTG;
  const tanpaWA = tim.filter(t => !t.wa).map(t => t.nama);

  const RAIL: { key: typeof seksi; label: string; hitung?: string; tanda?: boolean }[] = [
    { key: 'kanal', label: 'Kanal & Event', hitung: String(KATALOG_EVENT.length) },
    { key: 'wa',    label: 'WhatsApp' },
    { key: 'tg',    label: 'Telegram', tanda: p.aktif.telegram && koneksi.telegram.keadaan === 'putus' },
    { key: 'push',  label: 'Push Notifikasi (App)', hitung: pushInfo?.aktif ? String(pushInfo.jumlahPerangkat) : undefined, tanda: pushInfo !== null && !pushInfo.aktif },
    { key: 'tim',   label: 'Jangkauan Tim', hitung: totalTim ? String(totalTim) : undefined },
    { key: 'ai',    label: 'AI Learning Center' },
  ];

  const Ubin = ({ warna, nama, nilai, lencana, jenis, ket }: {
    warna: string; nama: string; nilai: string;
    lencana: string; jenis: 'ok' | 'warn' | 'diam'; ket: string;
  }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-3 relative overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: warna }} />
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: warna }} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">{nama}</span>
      </div>
      <div className="text-[17px] font-bold text-slate-800 leading-tight">{nilai}</div>
      <span className={`inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
        jenis === 'ok' ? 'bg-green-100 text-green-700'
        : jenis === 'warn' ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-100 text-slate-500'}`}>{lencana}</span>
      <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">{ket}</p>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Strip kesehatan ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {Ubin({ warna: "#0891b2", nama: "Dalam Aplikasi", nilai: totalTim ? `${totalTim} dari ${totalTim}` : '—', lencana: "Selalu aktif", jenis: "ok", ket: "Lonceng & banner di portal. Tidak perlu disiapkan." })}
        {Ubin({ warna: "#16a34a", nama: "WhatsApp", nilai: totalTim ? `${timWA} dari ${totalTim}` : '—', lencana: !p.aktif.whatsapp ? 'Kanal masih mati'
                   : koneksi.whatsapp.keadaan === 'terhubung' ? `${spWA.label} tersambung`
                   : koneksi.whatsapp.keadaan === 'memuat' ? 'Mengecek…' : 'Belum tersambung', jenis: !p.aktif.whatsapp ? 'warn'
                 : koneksi.whatsapp.keadaan === 'terhubung' ? 'ok' : koneksi.whatsapp.keadaan === 'memuat' ? 'diam' : 'warn', ket: !p.aktif.whatsapp ? 'Saklar kanalnya belum dinyalakan.'
               : tanpaWA.length ? `Belum punya nomor: ${tanpaWA.slice(0, 2).join(', ')}${tanpaWA.length > 2 ? ` +${tanpaWA.length - 2}` : ''}.`
                                : 'Semua anggota punya nomor.' })}
        {Ubin({ warna: "#0088cc", nama: "Telegram", nilai: totalTim ? `${timTG} dari ${totalTim}` : '—', lencana: !p.aktif.telegram ? 'Kanal masih mati'
                   : koneksi.telegram.keadaan === 'terhubung' ? `@${koneksi.telegram.info}`
                   : koneksi.telegram.keadaan === 'memuat' ? 'Mengecek…' : 'Bot belum siap', jenis: !p.aktif.telegram || koneksi.telegram.keadaan === 'putus' ? 'warn'
                 : koneksi.telegram.keadaan === 'memuat' ? 'diam' : 'ok', ket: !p.aktif.telegram ? 'Saklar kanalnya belum dinyalakan.' : 'Tiap orang menghubungkan akunnya sendiri.' })}
        {Ubin({ warna: "#e11d48", nama: "Push Notifikasi", nilai: pushInfo === null ? '—' : pushInfo.aktif ? `${pushInfo.jumlahPerangkat} perangkat` : 'Belum aktif', lencana: pushInfo?.aktif ? 'Aktif' : 'Perlu diaktifkan', jenis: pushInfo?.aktif ? 'ok' : 'warn', ket: pushInfo?.aktif ? 'Bunyi + notifikasi sistem walau app HP tertutup.' : 'Aktifkan sekali - berlaku untuk semua orang.' })}
        {Ubin({ warna: belumTG > 0 ? '#f59e0b' : '#16a34a', nama: "Perlu tindakan", nilai: belumTG > 0 ? `${belumTG} anggota` : 'Tidak ada', lencana: belumTG > 0 ? 'Belum hubungkan Telegram' : 'Semua siap', jenis: belumTG > 0 ? 'warn' : 'ok', ket: belumTG > 0 ? 'Telegram wajib dihubungkan sendiri oleh tiap orang.' : 'Seluruh tim bisa dijangkau.' })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[190px_1fr] gap-3 items-start">

        {/* ── Rail bagian ── */}
        <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible md:sticky md:top-0 pb-1 md:pb-0">
          {RAIL.map(r => {
            const aktif = seksi === r.key;
            return (
              <button key={r.key} type="button" onClick={() => setSeksi(r.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left whitespace-nowrap transition-colors border ${
                  aktif ? 'bg-white border-slate-200 shadow-sm text-slate-800 font-bold'
                        : 'border-transparent text-slate-500 hover:bg-slate-100 font-semibold'}`}>
                <span className="text-xs flex-1">{r.label}</span>
                {r.hitung && (
                  <span className={`text-[11px] font-bold ${aktif ? 'text-cyan-700' : 'text-slate-500'}`}>{r.hitung}</span>
                )}
                {r.tanda && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="min-w-0">

          {/* ══ KANAL & EVENT ══ */}
          <SeksiKanal
            cariEvent={cariEvent} cocokCari={cocokCari} kategori={kategori} p={p} seksi={seksi} setCariEvent={setCariEvent} spWA={spWA} timTG={timTG} timWA={timWA} toggleEvent={toggleEvent} totalTim={totalTim} ubah={ubah}
          />

          {/* ══ WHATSAPP ══ */}
          <SeksiWhatsApp
            hapusRahasia={hapusRahasia} koneksi={koneksi} p={p} pesanKanal={pesanKanal} rahasia={rahasia} seksi={seksi} setWaTujuan={setWaTujuan} simpanRahasia={simpanRahasia} spWA={spWA} ubah={ubah} uji={uji} ujiJalan={ujiJalan} waTujuan={waTujuan}
          />

          {/* ══ TELEGRAM ══ */}
          <SeksiTelegram
            belumTG={belumTG} chatTerdeteksi={chatTerdeteksi} deteksiChat={deteksiChat} deteksiJalan={deteksiJalan} hapusRahasia={hapusRahasia} koneksi={koneksi} p={p} pesanKanal={pesanKanal} rahasia={rahasia} seksi={seksi} setSeksi={setSeksi} simpanRahasia={simpanRahasia} ubah={ubah} uji={uji} ujiJalan={ujiJalan}
          />

          {/* ══ PUSH NOTIFIKASI (APP/PWA) ══ */}
          <SeksiPush
            aktifkanPushServer={aktifkanPushServer} hapusRahasia={hapusRahasia} pushInfo={pushInfo} pushMemuat={pushMemuat} pushPesan={pushPesan} rahasia={rahasia} seksi={seksi} setConfirmState={setConfirmState} simpanRahasia={simpanRahasia}
          />

          {/* ══ JANGKAUAN TIM ══ */}
          <SeksiTim
            belumTG={belumTG} seksi={seksi} tim={tim}
          />

          {/* ══ AI LEARNING CENTER ══
              Dipindah ke bagiannya sendiri. Sebelumnya menumpuk di bawah kartu
              Telegram di halaman yang sama - padahal ia sama sekali bukan kanal
              notifikasi, dan justru itulah yang membuat layar ini terasa penuh. */}
          <SeksiAI
            ai={ai} hapusRahasia={hapusRahasia} penilai={penilai} rahasia={rahasia} seksi={seksi} setAi={setAi} setPenilai={setPenilai} simpanRahasia={simpanRahasia}
          />

          {/* ── Bilah Simpan: menempel di bawah, selalu terlihat ──
              Dulu ia berada di dasar seluruh gulungan, jadi sesudah mengubah
              saklar di bagian atas orang harus menggulir jauh untuk menemukannya
              - dan sering mengira perubahannya sudah tersimpan sendiri. */}
          {seksi !== 'tim' && (
            <div className="sticky bottom-0 mt-3 px-3.5 py-2.5 rounded-xl border border-slate-200 flex items-center gap-3 flex-wrap"
              style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(8px)', boxShadow: '0 -2px 16px -8px rgba(15,23,42,0.25)' }}>
              <span className="text-[11.5px] text-slate-500 flex-1 min-w-0">
                Perubahan pada halaman ini baru berlaku setelah disimpan.
              </span>
              {pesan && (
                <span className={`text-[11px] font-bold ${pesan.tipe === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                  {pesan.tipe === 'ok' ? '✅' : '⚠️'} {pesan.teks}
                </span>
              )}
              <button type="button" onClick={simpanSekarang} disabled={simpan}
                className="text-xs font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50 flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)' }}>
                {simpan ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
    </div>
  );
}
