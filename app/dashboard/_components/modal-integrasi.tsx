'use client';

/**
 * Admin Panel -> Integrations. Mengatur kanal notifikasi (In-App, WhatsApp,
 * Telegram) dan event mana lewat kanal mana.
 *
 * TOKEN TIDAK DIATUR DI SINI, dan itu disengaja. app_settings punya trigger
 * yang MENOLAK kunci bernama token/secret/api_key/password/credential
 * (sql/pengaturan-merek.sql) - dipasang setelah token gateway WhatsApp
 * ditemukan tersimpan di sana dalam bentuk terbaca, di tabel yang bisa dibaca
 * siapa pun pemegang anon key. Jadi halaman ini hanya mengatur hal yang tidak
 * memberi akses kalau bocor; tokennya tetap di secret server, dan halaman ini
 * menunjukkan tempatnya alih-alih menyediakan kolom isian palsu.
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

export function IntegrasiInline() {
  const [p, setP] = useState<PengaturanNotifikasi | null>(null);
  const [simpan, setSimpan] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'gagal'; teks: string } | null>(null);
  const [ujiJalan, setUjiJalan] = useState<'cek' | 'kirim' | null>(null);

  useEffect(() => { bacaPengaturan(true).then(setP); }, []);

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

  const ujiTelegram = async (aksi: 'cek' | 'kirim') => {
    setUjiJalan(aksi); setPesan(null);
    try {
      const r = await fetch('/api/notifikasi/telegram', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aksi === 'cek'
          ? { aksi: 'cek' }
          : { chatId: p.telegramChatId, pesan: '✅ Tes dari Work Management — integrasi Telegram berhasil.' }),
      });
      const j = await r.json() as { ok?: boolean; alasan?: string; bot?: string };
      setPesan(j?.ok
        ? { tipe: 'ok', teks: aksi === 'cek' ? `Bot tersambung: @${j.bot}` : 'Pesan tes terkirim.' }
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
        </p>
      </div>

      {/* ── Telegram ── */}
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Telegram</div>
        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Chat ID tujuan bawaan</label>
        <input value={p.telegramChatId} placeholder="mis. -1001234567890"
          onChange={e => ubah(x => ({ ...x, telegramChatId: e.target.value }))}
          className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-sky-400" />
        <div className="flex flex-wrap gap-2 mt-2">
          <button type="button" onClick={() => ujiTelegram('cek')} disabled={ujiJalan !== null}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50">
            {ujiJalan === 'cek' ? 'Mengecek…' : 'Tes Koneksi'}
          </button>
          <button type="button" onClick={() => ujiTelegram('kirim')} disabled={ujiJalan !== null || !p.telegramChatId.trim()}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-white disabled:opacity-50"
            style={{ background: '#0088cc' }}>
            {ujiJalan === 'kirim' ? 'Mengirim…' : 'Kirim Pesan Tes'}
          </button>
        </div>
        {/*
          Kolom token sengaja TIDAK disediakan - lihat catatan di kepala berkas.
          Menyediakannya akan mengundang admin menyimpan rahasia di tabel yang
          terbaca publik, dan trigger basis data akan menolaknya - jadi kolom
          itu hanya akan jadi kolom yang selalu gagal.
        */}
        <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
          Token bot <b>tidak diatur di sini</b>. Ia rahasia, dan tabel pengaturan platform ini
          terbaca oleh siapa pun yang membuka halaman — karena itu basis datanya menolak
          menyimpan rahasia. Isi <code className="bg-slate-100 px-1 rounded">TELEGRAM_BOT_TOKEN</code> di
          Vercel → Settings → Environment Variables, lalu deploy ulang. Setelah itu tombol
          Tes Koneksi di atas akan menjawab nama bot-nya.
        </p>
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
