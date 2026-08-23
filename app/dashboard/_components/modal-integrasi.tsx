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
import { KATALOG_EVENT, type KategoriEvent } from '@/lib/notifikasi/katalog';

const JUDUL_KATEGORI: Record<KategoriEvent, string> = {
  ticket: 'Ticket', approval: 'Approval', assignment: 'Assignment',
  reminder: 'Reminder', schedule: 'Jadwal', project: 'Project', system: 'Sistem',
};

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
        {status?.terisi ? (
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
          placeholder={status?.terisi ? 'isi untuk mengganti…' : 'tempel token di sini'}
          autoComplete="new-password"
          className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-sky-400" />
        <button type="button" disabled={sibuk || !nilai.trim()}
          onClick={async () => { setSibuk(true); await onSimpan(nilai.trim()); setNilai(''); setSibuk(false); }}
          className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-40 flex-shrink-0">
          Simpan
        </button>
        {status?.terisi && (
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

  const muatRahasia = async () => {
    try {
      const r = await fetch('/api/integrasi/rahasia', { credentials: 'include' });
      const j = await r.json() as { ok?: boolean; status?: Record<string, StatusRahasia> };
      if (j?.ok && j.status) setRahasia(j.status);
    } catch { /* diam - blok token akan tampil "belum diisi" */ }
  };

  useEffect(() => { bacaPengaturan(true).then(setP); muatRahasia(); }, []);

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
      if (j?.ok) await muatRahasia();
    } catch { setPesan({ tipe: 'gagal', teks: 'Tidak bisa menghubungi server.' }); }
  };

  const hapusRahasia = async (kunci: string) => {
    try {
      const r = await fetch(`/api/integrasi/rahasia?kunci=${encodeURIComponent(kunci)}`,
        { method: 'DELETE', credentials: 'include' });
      const j = await r.json() as { ok?: boolean; alasan?: string };
      setPesan(j?.ok ? { tipe: 'ok', teks: 'Token dihapus.' }
                     : { tipe: 'gagal', teks: j?.alasan ?? 'Gagal menghapus.' });
      if (j?.ok) await muatRahasia();
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
    const r = await simpanPengaturan(p);
    setSimpan(false);
    setPesan(r.ok ? { tipe: 'ok', teks: 'Pengaturan tersimpan.' }
                  : { tipe: 'gagal', teks: r.pesan ?? 'Gagal menyimpan.' });
  };

  const uji = async (kanal: 'telegram' | 'whatsapp', aksi: 'cek' | 'kirim') => {
    const tanda = `${kanal}-${aksi}`;
    setUjiJalan(tanda); setPesan(null);
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
        : 'Pesan tes terkirim.';
      setPesan(j?.ok ? { tipe: 'ok', teks: berhasil }
                     : { tipe: 'gagal', teks: j?.alasan ?? 'Gagal.' });
    } catch {
      setPesan({ tipe: 'gagal', teks: 'Tidak bisa menghubungi server.' });
    }
    setUjiJalan(null);
  };

  const kategori = Array.from(new Set(KATALOG_EVENT.map(e => e.kategori)));

  return (
    <div className="space-y-4">
      {/* ── Saklar induk per kanal ── */}
      <div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Kanal</div>
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
        <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
          Saklar di sini berlaku menyeluruh: kanal yang dimatikan tidak akan dipakai event mana pun,
          berapa pun centang di tabel bawah.
          {' '}<b>In-App</b> = lonceng notifikasi di dalam platform ini sendiri — pemberitahuan yang
          muncul saat orangnya membuka Work Management, tanpa keluar ke WhatsApp atau Telegram.
          Ia tidak butuh token apa pun.
        </p>
        {/*
          Keterangan ini ada karena tanpa ia, halaman ini berbohong: admin
          mematikan centang WhatsApp untuk satu event, tidak terjadi apa-apa,
          dan tidak ada yang menjelaskan kenapa. Lebih baik menyebutkan
          batasnya daripada membiarkan saklar yang tidak menyambung ke mana-mana.
        */}
        <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2">
          <p className="text-[10px] text-amber-800 leading-relaxed">
            <b>Yang sudah berlaku &amp; yang belum.</b> Saklar induk <b>WhatsApp</b> di atas berlaku
            untuk <b>seluruh</b> pengiriman WA di platform (48 titik) — dimatikan berarti benar-benar
            berhenti. Sedangkan centang <b>per-event</b> di tabel bawah baru berlaku untuk event yang
            pengirimannya sudah dipindah ke notification engine; sisanya masih mengikuti saklar induk
            saja. Pemindahannya bertahap dan disengaja: 48 titik itu dipakai tim setiap hari, dan satu
            yang diam-diam salah berarti seseorang tidak tahu ada tiket untuknya.
          </p>
        </div>
      </div>

      {/* ── WhatsApp ── */}
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">WhatsApp (Fonnte)</div>
        <BlokToken
          judul="Token Fonnte" kunci="whatsapp.token" status={rahasia['whatsapp.token']}
          onSimpan={n => simpanRahasia('whatsapp.token', n)}
          onHapus={() => hapusRahasia('whatsapp.token')}
          petunjuk={<>Ambil di dashboard Fonnte → Device → Token. Tersimpan terenkripsi di sisi server dan tidak pernah dikirim balik ke peramban.</>} />
        <label className="block text-[11px] font-semibold text-slate-600 mt-2 mb-1">Nomor tujuan untuk pesan tes</label>
        <input value={waTujuan} onChange={e => setWaTujuan(e.target.value)} placeholder="mis. 6281234567890"
          className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-green-400" />
        <div className="flex flex-wrap gap-2 mt-2">
          <button type="button" onClick={() => uji('whatsapp', 'cek')} disabled={ujiJalan !== null}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50">
            {ujiJalan === 'whatsapp-cek' ? 'Mengecek…' : 'Tes Koneksi'}
          </button>
          <button type="button" onClick={() => uji('whatsapp', 'kirim')} disabled={ujiJalan !== null || !waTujuan.trim()}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-white disabled:opacity-50"
            style={{ background: '#16a34a' }}>
            {ujiJalan === 'whatsapp-kirim' ? 'Mengirim…' : 'Kirim Pesan Tes'}
          </button>
        </div>
      </div>

      {/* ── Telegram ── */}
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Telegram</div>
        <BlokToken
          judul="Token bot" kunci="telegram.bot_token" status={rahasia['telegram.bot_token']}
          onSimpan={n => simpanRahasia('telegram.bot_token', n)}
          onHapus={() => hapusRahasia('telegram.bot_token')}
          petunjuk={<>Buat bot lewat @BotFather di Telegram, lalu tempel token yang diberikannya. Jangan lupa undang bot itu ke grup tujuan.</>} />
        <label className="block text-[11px] font-semibold text-slate-600 mt-2 mb-1">Chat ID tujuan bawaan</label>
        <input value={p.telegramChatId} placeholder="mis. -1001234567890"
          onChange={e => ubah(x => ({ ...x, telegramChatId: e.target.value }))}
          className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-sky-400" />
        <div className="flex flex-wrap gap-2 mt-2">
          <button type="button" onClick={() => uji('telegram', 'cek')} disabled={ujiJalan !== null}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50">
            {ujiJalan === 'telegram-cek' ? 'Mengecek…' : 'Tes Koneksi'}
          </button>
          <button type="button" onClick={() => uji('telegram', 'kirim')} disabled={ujiJalan !== null || !p.telegramChatId.trim()}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-white disabled:opacity-50"
            style={{ background: '#0088cc' }}>
            {ujiJalan === 'telegram-kirim' ? 'Mengirim…' : 'Kirim Pesan Tes'}
          </button>
        </div>
      </div>

      {/* ── Matriks event x kanal ── */}
      <div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">
          Event → Kanal ({KATALOG_EVENT.length})
        </div>
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-200">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Kejadian</span>
            <span className="flex gap-3">
              {KANAL.map(k => (
                <span key={k.key} className="text-[9px] font-bold uppercase w-[52px] text-center" style={{ color: k.warna }}>{k.label}</span>
              ))}
            </span>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
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
