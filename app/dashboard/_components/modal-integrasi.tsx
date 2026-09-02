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
import { KATALOG_EVENT, type KategoriEvent } from '@/lib/notifikasi/katalog';
import { PENYEDIA_WA, penyediaWA } from '@/lib/notifikasi/penyedia-wa';

const JUDUL_KATEGORI: Record<KategoriEvent, string> = {
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
function PilihModel({ nilai, profil, onGanti, warna }: {
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

  if (memuat) return <p className="text-[11px] text-slate-400 py-2">Memuat daftar model…</p>;

  if (daftar.length === 0) {
    return (
      <>
        <input value={nilai} onChange={e => onGanti(e.target.value)}
          aria-label="Nama model AI"
          className={`w-full text-xs px-2.5 py-2 rounded-lg border border-amber-300 focus:outline-none ${fokus}`} />
        <p className="text-[9px] text-amber-700 mt-1 leading-relaxed">
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
      <p className="text-[9px] text-slate-400 mt-1">
        {daftar.length} model tersedia untuk token ini — dibaca langsung dari Google, jadi tidak pernah basi.
      </p>
    </>
  );
}

function Saklar({ aktif, onKlik, warna }: { aktif: boolean; onKlik: () => void; warna: string }) {
  return (
    <button type="button" onClick={onKlik} role="switch" aria-checked={aktif}
      className="relative w-9 h-5 rounded-full transition-colors flex-shrink-0"
      style={{ background: aktif ? warna : '#cbd5e1' }}>
      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
        style={{ left: aktif ? 18 : 2 }} />
    </button>
  );
}

interface StatusRahasia {
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
type StatusKoneksi =
  | { keadaan: 'memuat' }
  | { keadaan: 'terhubung'; info: string }
  | { keadaan: 'putus'; alasan: string };

type PesanKotak = { tipe: 'ok' | 'gagal'; teks: string };

function LencanaStatus({ status }: { status: StatusKoneksi }) {
  const gaya = status.keadaan === 'terhubung'
    ? { bg: '#dcfce7', fg: '#15803d', titik: '#22c55e', teks: 'Terhubung' }
    : status.keadaan === 'memuat'
      ? { bg: '#f1f5f9', fg: '#64748b', titik: '#94a3b8', teks: 'Mengecek…' }
      : { bg: '#fef3c7', fg: '#b45309', titik: '#f59e0b', teks: 'Belum Terhubung' };
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
      style={{ background: gaya.bg, color: gaya.fg }}
      title={status.keadaan === 'putus' ? status.alasan
             : status.keadaan === 'terhubung' ? status.info : 'Sedang memeriksa koneksi…'}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: gaya.titik }} />
      {gaya.teks}
    </span>
  );
}

/** Kartu satu kanal: kepala berikon + lencana status, badan bebas. */
function KartuKanal({ ikon, judul, warna, status, anak }: {
  ikon: string; judul: string; warna: string;
  status?: StatusKoneksi; anak: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
        <span className="text-sm leading-none flex-shrink-0" style={{ color: warna }}>{ikon}</span>
        <span className="text-[11px] font-bold uppercase tracking-wide flex-1 min-w-0 truncate"
          style={{ color: warna }}>{judul}</span>
        {status && <LencanaStatus status={status} />}
      </div>
      <div className="p-3">{anak}</div>
    </div>
  );
}

/** Kotak petunjuk biru - langkah-langkah yang perlu dibaca sambil mengisi. */
function KotakPetunjuk({ judul, anak }: { judul: string; anak: React.ReactNode }) {
  return (
    <div className="rounded-lg px-3 py-2.5 h-full"
      style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
      <div className="text-[11px] font-bold text-sky-700 mb-1.5">{judul}</div>
      <div className="text-[10px] text-sky-900/80 leading-relaxed space-y-1">{anak}</div>
    </div>
  );
}

/**
 * Hasil sebuah tombol, ditampilkan tepat di bawah tombolnya.
 *
 * Ini yang paling menentukan: umpan balik yang benar tapi berada di luar
 * layar sama tidak bergunanya dengan tidak ada umpan balik sama sekali.
 */
function PesanKotak({ pesan }: { pesan: PesanKotak | null }) {
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
      <span className={`text-[10px] font-semibold leading-relaxed ${ok ? 'text-green-700' : 'text-red-600'}`}>
        {pesan.teks}
      </span>
    </div>
  );
}

/**
 * Satu blok pengaturan token. Kolom isiannya SELALU berangkat kosong - yang
 * tersimpan diwakili penanda di sebelahnya. Menampilkan nilai tersimpan di
 * kolom isian berarti mengirimkannya ke peramban, dan itu membatalkan seluruh
 * maksud tabel rahasia_integrasi.
 */
function BlokToken({
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
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700"
            title="Nilai bawaan dari variabel lingkungan server. Sudah aktif — isi di sini hanya bila ingin menggantinya.">
            bawaan {status.penanda}
          </span>
        ) : status?.terisi ? (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
            terisi {status.penanda}
          </span>
        ) : (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">belum diisi</span>
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
        <div className="text-[9px] text-slate-400 mt-1">
          Diperbarui {new Date(status.diperbarui).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          {status.oleh ? ` oleh ${status.oleh}` : ''}
        </div>
      )}
      <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">{petunjuk}</p>
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
  /** Panel geser Event -> Kanal. Tertutup secara bawaan - lihat catatan di dekat panelnya. */
  const [bukaMatriks, setBukaMatriks] = useState(false);
  /* Pengaturan pembuat soal AI - lihat lib/ai-pengaturan.ts. */
  const [ai, setAi] = useState<PengaturanAI>(AI_BAWAAN);
  const [penilai, setPenilai] = useState<PengaturanPenilai>(PENILAI_BAWAAN);

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

  useEffect(() => {
    bacaPengaturan(true).then(setP);
    muatRahasia();
    ambilPengaturanAI().then(setAi);
    ambilPengaturanPenilai().then(setPenilai);
    void cekKoneksi('telegram');
    void cekKoneksi('whatsapp');
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

  if (!p) return <div className="text-xs text-slate-400 py-8 text-center">Memuat…</div>;

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

  return (
    <div className="space-y-4">
      {/* ── Saklar induk per kanal ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Kanal</div>
          {/* Pintu ke pengaturan per kejadian, ditaruh berdampingan dengan
              saklar induknya - di situlah orang sedang memikirkan kanal, jadi
              di situ pula pertanyaan "kejadian mana saja?" muncul. */}
          <button type="button" onClick={() => setBukaMatriks(true)}
            className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 whitespace-nowrap">
            ⚙️ Atur Event → Kanal ({KATALOG_EVENT.length})
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {KANAL.map(k => (
            <div key={k.key} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: k.warna }} />
              <span className="text-xs font-bold text-slate-700 flex-1">{k.label}</span>
              <Saklar aktif={p.aktif[k.key]} warna={k.warna}
                onKlik={() => ubah(x => ({ ...x, aktif: { ...x.aktif, [k.key]: !x.aktif[k.key] } }))} />
            </div>
          ))}
        </div>
      </div>

      {/* ── WhatsApp: penyedia bisa dipilih, tidak terpaku satu gateway ── */}
      <KartuKanal ikon="✆" judul="Integrasi Notifikasi WhatsApp" warna="#16a34a"
        status={spWA.bisaCek ? koneksi.whatsapp : undefined}
        anak={<>

        {/*
          Pemilih penyedia. Formulir di bawahnya dibangun dari definisi di
          lib/notifikasi/penyedia-wa.ts, jadi menambah penyedia baru cukup
          menambah satu entri di sana - tidak ada kolom yang ditulis tangan
          di berkas ini.
        */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          {PENYEDIA_WA.map(sp => {
            const dipilih = p.waPenyedia === sp.key;
            return (
              <button key={sp.key} type="button"
                onClick={() => ubah(x => ({ ...x, waPenyedia: sp.key }))}
                className="text-left rounded-xl border-2 px-2.5 py-2 transition-colors"
                style={{
                  borderColor: dipilih ? '#16a34a' : '#e2e8f0',
                  background: dipilih ? '#16a34a0d' : 'transparent',
                }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: dipilih ? '#16a34a' : '#cbd5e1' }} />
                  <span className="text-[11px] font-bold text-slate-700 leading-tight">{sp.label}</span>
                  {sp.resmi && (
                    <span className="text-[8px] font-black px-1 py-px rounded bg-sky-100 text-sky-700 flex-shrink-0">RESMI</span>
                  )}
                </div>
                <p className="text-[9px] text-slate-400 leading-snug">{sp.ringkas}</p>
              </button>
            );
          })}
        </div>

        {/*
          Catatan penyedia hanya muncul kalau ada, dan sengaja ditaruh SEBELUM
          kolom isiannya: batasan seperti jendela 24 jam Cloud API menentukan
          apakah penyedia itu cocok sama sekali, jadi admin harus membacanya
          sebelum menghabiskan waktu menempel token.
        */}
        {spWA.catatan && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 mb-2">
            <p className="text-[10px] text-amber-800 leading-relaxed">{spWA.catatan}</p>
          </div>
        )}

        <div className="space-y-2">
          {spWA.kolom.map(kol => kol.rahasia ? (
            <BlokToken key={kol.kunci}
              judul={kol.label} kunci={kol.kunci} status={rahasia[kol.kunci]}
              onSimpan={n => simpanRahasia(kol.kunci, n)}
              onHapus={() => hapusRahasia(kol.kunci)}
              petunjuk={<>{kol.petunjuk} Tersimpan di sisi server dan tidak pernah dikirim balik ke peramban.</>} />
          ) : (
            <div key={kol.kunci}>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">{kol.label}</label>
              <input
                value={p.waConfig[kol.kunci] ?? ''} placeholder={kol.placeholder}
                onChange={e => ubah(x => ({ ...x, waConfig: { ...x.waConfig, [kol.kunci]: e.target.value } }))}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-green-400" />
              <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">{kol.petunjuk}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
              Nomor tujuan untuk pesan tes
            </label>
            <input value={waTujuan} onChange={e => setWaTujuan(e.target.value)} placeholder="contoh: 6281234567890"
              className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-green-400" />
            <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">
              Nomor ini hanya dipakai tombol tes di bawah — tidak ikut tersimpan sebagai tujuan notifikasi.
            </p>
          </div>

          <KotakPetunjuk judul="✆ Format nomor:" anak={<>
            <div>1. Pakai kode negara, tanpa tanda <span className="font-mono">+</span> dan tanpa spasi.</div>
            <div>2. Awalan <span className="font-mono">08…</span> ditulis <span className="font-mono">628…</span></div>
            <div>3. Contoh: <span className="font-mono font-bold">6281234567890</span></div>
            <div className="pt-1 text-sky-900/60">
              Pastikan nomornya sudah pernah chat dengan perangkat/gateway-nya.
            </div>
          </>} />
        </div>

        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
          {/*
            Tes Koneksi disembunyikan untuk penyedia yang memang tidak
            punya cara mengeceknya (webhook kustom) - menampilkan tombol yang
            pasti menjawab "tidak didukung" hanya membuang waktu admin.
          */}
          {spWA.bisaCek && (
            <button type="button" onClick={() => uji('whatsapp', 'cek')} disabled={ujiJalan !== null}
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50">
              {ujiJalan === 'whatsapp-cek' ? 'Mengecek…' : 'Tes Koneksi'}
            </button>
          )}
          <button type="button" onClick={() => uji('whatsapp', 'kirim')} disabled={ujiJalan !== null || !waTujuan.trim()}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-white disabled:opacity-50"
            style={{ background: '#16a34a' }}>
            {ujiJalan === 'whatsapp-kirim' ? 'Mengirim…' : 'Kirim Pesan Tes'}
          </button>
        </div>
        {/*
          Perpindahan penyedia baru berlaku sesudah Simpan: route servernya
          membaca app_settings, bukan state layar ini. Tanpa keterangan ini
          admin akan menekan Tes Koneksi lebih dulu dan mengira penyedia
          barunya rusak, padahal yang diuji masih penyedia yang lama.
        */}
        <PesanKotak pesan={pesanKanal.whatsapp ?? null} />
        <p className="text-[9px] text-slate-400 mt-1.5">
          Tekan <b>Simpan</b> di bawah dulu setelah berpindah penyedia — tes memakai penyedia yang tersimpan.
        </p>

        {!p.aktif.whatsapp && (
          <div className="mt-2 rounded-lg px-2.5 py-2 flex items-start gap-1.5"
            style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
            <span className="text-[11px] leading-none mt-px">⚠️</span>
            <span className="text-[10px] font-semibold text-amber-800 leading-relaxed">
              Kanal WhatsApp masih <b>mati</b> di saklar Kanal di atas — tes di sini tetap jalan,
              tapi notifikasi asli tidak akan terkirim sampai saklarnya dinyalakan dan disimpan.
            </span>
          </div>
        )}
        </>} />

      {/* ── Telegram ── */}
      <KartuKanal ikon="➤" judul="Integrasi Notifikasi Telegram" warna="#0088cc"
        status={koneksi.telegram}
        anak={<>
          <BlokToken
            judul="Token bot" kunci="telegram.bot_token" status={rahasia['telegram.bot_token']}
            onSimpan={n => simpanRahasia('telegram.bot_token', n)}
            onHapus={() => hapusRahasia('telegram.bot_token')}
            petunjuk={<>Buat bot lewat @BotFather di Telegram, lalu tempel token yang diberikannya. Jangan lupa undang bot itu ke grup tujuan.</>} />

          {/*
            Isian dan petunjuknya berdampingan. Petunjuk yang ditaruh di bawah
            kolom isian dibaca SESUDAH orang terlanjur menebak isinya - padahal
            "dari mana angka ini?" justru pertanyaan pertama.
          */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                Telegram Chat ID
              </label>
              <input value={p.telegramChatId} placeholder="contoh: 123456789"
                onChange={e => ubah(x => ({ ...x, telegramChatId: e.target.value }))}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-sky-400" />
              <button type="button" onClick={deteksiChat}
                disabled={deteksiJalan || koneksi.telegram.keadaan !== 'terhubung'}
                title={koneksi.telegram.keadaan !== 'terhubung'
                  ? 'Isi token bot dulu — deteksi memakai bot yang tersambung.' : undefined}
                className="mt-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-white disabled:opacity-40"
                style={{ background: '#0088cc' }}>
                {deteksiJalan ? 'Mendeteksi…' : '🔎 Deteksi Chat ID'}
              </button>
              <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">
                Tujuan bawaan untuk notifikasi. Untuk grup, angkanya diawali tanda minus
                (mis. <span className="font-mono">-1001234567890</span>).
              </p>

              {chatTerdeteksi && chatTerdeteksi.length > 0 && (
                <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden">
                  <div className="px-2.5 py-1 bg-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                    Percakapan terbaca — klik untuk memakai
                  </div>
                  {chatTerdeteksi.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => ubah(x => ({ ...x, telegramChatId: c.id }))}
                      className="w-full text-left px-2.5 py-1.5 border-t border-slate-100 hover:bg-sky-50 transition-colors flex items-center gap-2">
                      <span className="text-[11px] flex-shrink-0">{c.jenis === 'private' ? '👤' : '👥'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold text-slate-700 truncate">{c.nama}</span>
                        <span className="block text-[9px] font-mono text-slate-400">{c.id}</span>
                      </span>
                      {p.telegramChatId === c.id && (
                        <span className="text-[9px] font-bold text-sky-600 flex-shrink-0">dipakai</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <KotakPetunjuk judul="➤ Cara Cek ID:" anak={<>
              {/*
                Nama botnya TIDAK ditulis di kode - ia datang dari jawaban
                getMe atas token yang benar-benar terpasang. Menuliskannya di
                sini berarti setiap perusahaan yang memakai platform ini
                diarahkan ke bot milik perusahaan lain.
              */}
              <div>
                1. Buka bot{' '}
                {koneksi.telegram.keadaan === 'terhubung' && koneksi.telegram.info ? (
                  <a href={`https://t.me/${koneksi.telegram.info}`} target="_blank" rel="noopener noreferrer"
                    className="font-bold text-sky-700 underline decoration-sky-300 hover:decoration-sky-600">
                    @{koneksi.telegram.info} ↗
                  </a>
                ) : (
                  <span className="text-sky-900/50">
                    (isi token bot dulu — namanya muncul di sini otomatis)
                  </span>
                )}
              </div>
              <div>2. Kirim <b>satu pesan apa pun</b> ke bot itu (untuk grup: undang botnya ke grup, lalu kirim satu pesan di sana).</div>
              <div>3. Tekan <b>Deteksi Chat ID</b> di bawah — angkanya diisikan sendiri.</div>
              {/*
                Sengaja TIDAK menyuruh "kirim /id lalu salin balasannya": bot
                BotFather tidak menjawab perintah apa pun sampai ada yang
                menulis pemrosesnya, dan platform ini tidak punya. Petunjuk
                seperti itu berakhir dengan admin menunggu balasan yang tidak
                akan pernah datang - persis jenis kebuntuan yang membuat layar
                ini terasa rusak.
              */}
              <div className="pt-1 text-sky-900/60">
                Telegram hanya menyimpan pesan yang belum terbaca selama 24 jam — kirim pesannya
                sesaat sebelum menekan tombol deteksi.
              </div>
            </>} />
          </div>

          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => uji('telegram', 'cek')} disabled={ujiJalan !== null}
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50">
              {ujiJalan === 'telegram-cek' ? 'Mengecek…' : 'Tes Koneksi'}
            </button>
            <button type="button" onClick={() => uji('telegram', 'kirim')} disabled={ujiJalan !== null || !p.telegramChatId.trim()}
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ background: '#0088cc' }}>
              {ujiJalan === 'telegram-kirim' ? 'Mengirim…' : 'Kirim Pesan Tes'}
            </button>
            {/* Chat ID ikut tersimpan lewat tombol Simpan di dasar panel -
                dikatakan di sini supaya tidak ada yang mengira mengetik saja
                sudah cukup. */}
            {!p.telegramChatId.trim() && (
              <span className="text-[9px] text-slate-400 self-center">
                Isi Chat ID dulu untuk bisa mengirim pesan tes.
              </span>
            )}
          </div>
          <PesanKotak pesan={pesanKanal.telegram ?? null} />

          {/* Saklar induk yang mati membuat seluruh pengaturan di kartu ini
              tidak berpengaruh - itu harus terbaca di sini, bukan hanya di
              deretan saklar yang letaknya jauh di atas. */}
          {!p.aktif.telegram && (
            <div className="mt-2 rounded-lg px-2.5 py-2 flex items-start gap-1.5"
              style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
              <span className="text-[11px] leading-none mt-px">⚠️</span>
              <span className="text-[10px] font-semibold text-amber-800 leading-relaxed">
                Kanal Telegram masih <b>mati</b> di saklar Kanal di atas — tes di sini tetap jalan,
                tapi notifikasi asli tidak akan terkirim sampai saklarnya dinyalakan dan disimpan.
              </span>
            </div>
          )}
        </>} />

      {/* ── Pembuat Soal AI (Learning Center) ── */}
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">
          Pembuat Soal AI · Learning Center
        </div>
        <BlokToken
          judul="Token AI" kunci="ai.gemini_token" status={rahasia['ai.gemini_token']}
          onSimpan={n => simpanRahasia('ai.gemini_token', n)}
          onHapus={() => hapusRahasia('ai.gemini_token')}
          petunjuk={<>Ambil dari Google AI Studio (aistudio.google.com → Get API key). Token disimpan di server dan tidak pernah dikirim ke peramban.</>} />

        <label className="block text-[11px] font-semibold text-slate-600 mt-2 mb-1">Model</label>
        <PilihModel nilai={ai.model} warna="sky" onGanti={m => setAi(x => ({ ...x, model: m }))} />

        <label className="block text-[11px] font-semibold text-slate-600 mt-2 mb-1">
          Arahan topik untuk AI <span className="font-normal text-slate-400">(opsional)</span>
        </label>
        <textarea value={ai.arahan} rows={4}
          onChange={e => setAi(x => ({ ...x, arahan: e.target.value }))}
          placeholder={'Contoh:\nUtamakan topik konfigurasi videowall, kalibrasi warna, dan troubleshooting sinyal HDMI/HDBaseT.\nHindari pertanyaan tentang sejarah merek atau harga.\nGunakan istilah teknis yang dipakai di lapangan.'}
          className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-sky-400 leading-relaxed" />
        <p className="text-[9px] text-slate-400 mt-1">
          Ditambahkan pada instruksi AI, bukan menggantinya — aturan bentuk soal tetap dipegang platform,
          jadi arahan yang keliru tidak bisa merusak hasilnya.
        </p>

        <label className="block text-[11px] font-semibold text-slate-600 mt-2 mb-1">
          Variasi soal <span className="font-normal text-slate-400">({ai.suhu.toFixed(1)})</span>
        </label>
        <input type="range" min={0} max={2} step={0.1} value={ai.suhu}
          aria-label="Variasi soal"
          onChange={e => setAi(x => ({ ...x, suhu: Number(e.target.value) }))}
          className="w-full accent-sky-500" />
        <div className="flex justify-between text-[9px] text-slate-400">
          <span>0 — taat pada materi</span><span>2 — banyak variasi</span>
        </div>
      </div>

      {/* ── Penilai Jawaban Essay ──────────────────────────────────────────
          Terpisah dari pembuat soal karena bentuk pemakaiannya berbeda jauh.
          Membuat soal dijalankan sesekali - satu panggilan menghasilkan 10
          soal. Menilai dijalankan sekali untuk tiap jawaban tiap peserta: satu
          sesi berisi 30 peserta dan 5 soal essay sudah 150 panggilan, sementara
          jatah harian gratis hanya puluhan permintaan. Dengan satu token
          bersama, penilaian yang boros mematikan pembuat soal juga. */}
      <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3">
        <div className="text-[10px] font-bold text-violet-500 uppercase tracking-wide mb-2">
          Penilai Jawaban Essay · Learning Center
        </div>
        <BlokToken
          judul="Token AI Koreksi" kunci="ai.gemini_token_koreksi" status={rahasia['ai.gemini_token_koreksi']}
          onSimpan={n => simpanRahasia('ai.gemini_token_koreksi', n)}
          onHapus={() => hapusRahasia('ai.gemini_token_koreksi')}
          petunjuk={<>Kosongkan untuk memakai Token AI pembuat soal. Isi dengan kunci dari <b>proyek Google terpisah</b> supaya penilaian borongan tidak menghabiskan jatah pembuat soal.</>} />

        <label className="block text-[11px] font-semibold text-slate-600 mt-2 mb-1">Model penilai</label>
        <PilihModel nilai={penilai.model} profil="penilai" warna="violet"
          onGanti={m => setPenilai(x => ({ ...x, model: m }))} />
        <p className="text-[9px] text-slate-400 mt-1">
          Boleh berbeda dari model pembuat soal — untuk menilai, model kelas ringan berjatah besar
          sudah memadai, karena hasilnya hanya saran yang tetap dikoreksi penilai.
          Bisa juga diganti langsung dari layar penilaian.
        </p>

        <label className="block text-[11px] font-semibold text-slate-600 mt-2 mb-1">
          Arahan penilaian <span className="font-normal text-slate-400">(opsional)</span>
        </label>
        <textarea value={penilai.arahan} rows={3}
          onChange={e => setPenilai(x => ({ ...x, arahan: e.target.value }))}
          placeholder={'Contoh:\nHargai jawaban yang benar secara konsep walau istilahnya tidak baku.\nJangan mengurangi nilai karena ejaan atau tanda baca.\nJawaban singkat yang tepat sasaran tetap bernilai penuh.'}
          className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-violet-400 leading-relaxed" />

        <label className="block text-[11px] font-semibold text-slate-600 mt-2 mb-1">
          Ketaatan pada kunci <span className="font-normal text-slate-400">({penilai.suhu.toFixed(1)})</span>
        </label>
        <input type="range" min={0} max={2} step={0.1} value={penilai.suhu}
          aria-label="Ketaatan penilaian pada kunci referensi"
          onChange={e => setPenilai(x => ({ ...x, suhu: Number(e.target.value) }))}
          className="w-full accent-violet-500" />
        <div className="flex justify-between text-[9px] text-slate-400">
          <span>0 — taat pada kunci</span><span>2 — longgar</span>
        </div>

        <label className="flex items-start gap-2 mt-3 cursor-pointer">
          <input type="checkbox" checked={penilai.otomatis}
            onChange={e => setPenilai(x => ({ ...x, otomatis: e.target.checked }))}
            className="mt-0.5 w-4 h-4 rounded accent-violet-600 flex-shrink-0" />
          <span className="text-[11px] leading-snug text-slate-600">
            <b>Nilai otomatis saat halaman penilaian dibuka</b>
            <span className="block text-[9px] text-slate-400 mt-0.5">
              Mati secara bawaan. Bila dinyalakan, sekadar <em>membuka</em> jawaban seorang peserta
              sudah memakai jatah — termasuk saat penilai hanya ingin membacanya. Dengan jatah harian
              yang terbatas, beberapa kali buka-tutup halaman sudah cukup menghabiskannya.
              Tombol <b>Nilai Semua Essay</b> di layar penilaian tetap tersedia kapan pun.
            </span>
          </span>
        </label>
      </div>

      {/* ── Matriks event x kanal - panel geser ────────────────────────────
          Dipindah keluar dari alur utama. Dua puluh dua baris tabel di tengah
          layar pengaturan membuat hal yang paling sering disentuh - token dan
          saklar kanal - terdorong jauh ke atas, dan yang jarang disentuh
          justru menguasai layar. Sekarang ia muncul dari kanan hanya saat
          diminta, dan layar di belakangnya tetap terbaca. */}
      {bukaMatriks && (
        <div className="fixed inset-0 z-[210] flex justify-end"
          style={{ background: 'rgba(15,23,42,0.45)' }}
          onClick={() => setBukaMatriks(false)}>
          <div onClick={ev => ev.stopPropagation()} role="dialog" aria-modal="true"
            aria-label="Pengaturan Event ke Kanal"
            className="h-full w-full max-w-[520px] bg-white shadow-2xl flex flex-col animate-slide-in-right">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 flex-shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-700">Event → Kanal</h3>
                <p className="text-[11px] text-slate-500">
                  {KATALOG_EVENT.length} kejadian · centang kanal yang dipakai tiap kejadian
                </p>
              </div>
              <button type="button" onClick={() => setBukaMatriks(false)} aria-label="Tutup"
                className="ml-auto w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
                ✕
              </button>
            </div>
            {/*
              Tiga lapis flex dengan min-h-0 di tiap lapisnya, supaya daftarnya
              memakai SELURUH tinggi panel dan menggulir sendiri.

              min-h-0 bukan hiasan: anak flex bawaannya min-height:auto, artinya
              ia menolak menyusut lebih kecil dari isinya. Tanpa itu, lapis yang
              di dalam tidak pernah dapat tinggi terbatas, jadi tidak pernah
              menggulir - dan pembatas tingginya terpaksa ditulis sebagai angka
              tetap. Itulah yang dulu terjadi di sini: max-h-[320px], yang
              berarti daftarnya berhenti di sepertiga layar sementara dua per
              tiga sisanya kosong, berapa pun tinggi layarnya.
            */}
            <div className="flex-1 min-h-0 p-4 flex flex-col">
            {/* ── Matriks event x kanal ── */}
            <div className="flex flex-col min-h-0 flex-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex-shrink-0">
                Event → Kanal ({KATALOG_EVENT.length})
              </div>
              <div className="rounded-xl border border-slate-200 overflow-hidden flex flex-col min-h-0 flex-1">
                <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex-shrink-0">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Kejadian</span>
                  <span className="flex gap-3">
                    {KANAL.map(k => (
                      <span key={k.key} className="text-[9px] font-bold uppercase w-[52px] text-center" style={{ color: k.warna }}>{k.label}</span>
                    ))}
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {kategori.map(kat => (
                    <div key={kat}>
                      <div className="px-3 py-1 bg-slate-50/70 text-[9px] font-bold text-slate-400 uppercase tracking-wide sticky top-0">
                        {JUDUL_KATEGORI[kat]}
                      </div>
                      {KATALOG_EVENT.filter(e => e.kategori === kat).map(e => {
                        const berlaku = kanalUntuk(e.key, p);
                        const dipilih = p.perEvent[e.key] ?? (e.bawaanKanal as Kanal[]);
                        return (
                          <div key={e.key} className="grid grid-cols-[1fr_auto] gap-2 items-center px-3 py-1.5 border-b border-slate-100 last:border-0">
                            <div className="min-w-0">
                              <div className="text-[11px] font-semibold text-slate-700 truncate">{e.label}</div>
                              {/*
                                Kalau sebuah event mencentang kanal yang saklar
                                induknya mati, centangnya tetap tersimpan tapi tidak
                                berlaku. Tanpa keterangan ini admin akan mengira
                                notifikasinya terkirim padahal tidak.
                              */}
                              {dipilih.length > 0 && berlaku.length === 0 && (
                                <div className="text-[9px] text-amber-600 font-semibold">kanalnya dimatikan di atas — tidak terkirim</div>
                              )}
                            </div>
                            <span className="flex gap-3">
                              {KANAL.map(k => {
                                const on = dipilih.includes(k.key);
                                return (
                                  <button key={k.key} type="button" onClick={() => toggleEvent(e.key, k.key)}
                                    className="w-[52px] flex justify-center" aria-label={`${e.label} - ${k.label}`}>
                                    <span className="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
                                      style={{
                                        borderColor: on ? k.warna : '#cbd5e1',
                                        background: on ? k.warna : 'transparent',
                                        opacity: on && !p.aktif[k.key] ? 0.4 : 1,
                                      }}>
                                      {on && <span className="text-white text-[9px] font-black leading-none">✓</span>}
                                    </span>
                                  </button>
                                );
                              })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex-shrink-0">
              {/* Tombol Simpan yang sama, bukan tombol kedua: pengaturan ini
                  ikut tersimpan bersama sisanya, jadi dua tombol berbeda hanya
                  akan membuat orang menebak mana yang berlaku. */}
              <button type="button" onClick={async () => { await simpanSekarang(); setBukaMatriks(false); }}
                disabled={simpan}
                className="w-full text-xs font-bold px-4 py-2.5 rounded-lg text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)' }}>
                {simpan ? 'Menyimpan…' : 'Simpan & Tutup'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={simpanSekarang} disabled={simpan}
          className="text-xs font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#0891b2,#0e7490)' }}>
          {simpan ? 'Menyimpan…' : 'Simpan'}
        </button>
        {pesan && (
          <span className={`text-[11px] font-semibold ${pesan.tipe === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
            {pesan.teks}
          </span>
        )}
      </div>
    </div>
  );
}
