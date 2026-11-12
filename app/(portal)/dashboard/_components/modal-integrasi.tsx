'use client';

import { useState } from 'react';
import { simpanPengaturan, type Kanal, type PengaturanNotifikasi } from '@/lib/notifikasi/pengaturan';
import { simpanPengaturanAI, simpanPengaturanPenilai } from '@/lib/ai-pengaturan';
import { KATALOG_EVENT, type KategoriEvent } from '@/lib/notifikasi/katalog';
import { penyediaWA } from '@/lib/notifikasi/penyedia-wa';
import { ConfirmDialog } from '@/components/shared';
import { SeksiAI } from './integrasi/SeksiAI';
import { SeksiTim } from './integrasi/SeksiTim';
import { SeksiPush } from './integrasi/SeksiPush';
import { SeksiTelegram } from './integrasi/SeksiTelegram';
import { SeksiWhatsApp } from './integrasi/SeksiWhatsApp';
import { SeksiKanal } from './integrasi/SeksiKanal';
import { useIntegrasi } from './useIntegrasi';
import { StatusRahasia, PesanKotak } from './integrasi-bagian';
export { PilihModel, Saklar, PesanKotak, LencanaStatus, Cek } from './integrasi-bagian';
export type { StatusRahasia, StatusKoneksi } from './integrasi-bagian';

export const JUDUL_KATEGORI: Record<KategoriEvent, string> = {
  ticket: 'Ticket', approval: 'Approval', assignment: 'Assignment',
  reminder: 'Reminder', schedule: 'Jadwal', project: 'Project', system: 'Sistem',
};

export function BlokToken({
  judul, status, petunjuk, onSimpan, onHapus,
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
          className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-hidden focus:border-sky-400" />
        <button type="button" disabled={sibuk || !nilai.trim()}
          onClick={async () => { setSibuk(true); await onSimpan(nilai.trim()); setNilai(''); setSibuk(false); }}
          className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-40 shrink-0">
          Simpan
        </button>
        {status?.terisi && !status.dariEnv && (
          <button type="button" disabled={sibuk}
            onClick={async () => { setSibuk(true); await onHapus(); setSibuk(false); }}
            className="text-[11px] font-bold px-2 py-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40 shrink-0">
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
  const {
    p, setP, setPesan, setSimpan, ai, penilai, setUjiJalan, setPesanKanal,
    waTujuan, setKoneksi, cekKoneksi, setDeteksiJalan, setChatTerdeteksi, cariEvent, tim, seksi,
    koneksi, pushInfo, setSeksi, setCariEvent, hapusRahasia, pesanKanal, rahasia, setWaTujuan,
    simpanRahasia, ujiJalan, chatTerdeteksi, deteksiJalan, aktifkanPushServer, pushMemuat, pushPesan, setConfirmState,
    setAi, setPenilai, pesan, simpan, confirmState,
  } = useIntegrasi();

  if (!p) return <div className="text-xs text-slate-500 py-8 text-center">Memuat…</div>;

  const ubah = (f: (x: PengaturanNotifikasi) => PengaturanNotifikasi) => {
    setP(f({ ...p, aktif: { ...p.aktif }, perEvent: { ...p.perEvent } }));
    setPesan(null);
  };

  const toggleEvent = (key: string, k: Kanal) => ubah(x => {
    const kini = x.perEvent[key] ?? (KATALOG_EVENT.find(e => e.key === key)?.bawaanKanal as Kanal[]) ?? [];
    const baru = kini.includes(k) ? kini.filter(v => v !== k) : [...kini, k];
    return { ...x, perEvent: { ...x.perEvent, [key]: baru } };
  });

  const simpanSekarang = async () => {
    setSimpan(true);
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
      setPesanKanal(s => ({ ...s, [kanal]: hasil }));
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
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: warna }} />
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

        <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible md:sticky md:top-0 pb-1 md:pb-0">
          {RAIL.map(r => {
            const aktif = seksi === r.key;
            return (
              <button key={r.key} type="button" onClick={() => setSeksi(r.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left whitespace-nowrap transition-colors border ${
                  aktif ? 'bg-white border-slate-200 shadow-xs text-slate-800 font-bold'
                        : 'border-transparent text-slate-500 hover:bg-slate-100 font-semibold'}`}>
                <span className="text-xs flex-1">{r.label}</span>
                {r.hitung && (
                  <span className={`text-[11px] font-bold ${aktif ? 'text-cyan-700' : 'text-slate-500'}`}>{r.hitung}</span>
                )}
                {r.tanda && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="min-w-0">

          <SeksiKanal
            cariEvent={cariEvent} cocokCari={cocokCari} kategori={kategori} p={p} seksi={seksi} setCariEvent={setCariEvent} spWA={spWA} timTG={timTG} timWA={timWA} toggleEvent={toggleEvent} totalTim={totalTim} ubah={ubah}
          />

          <SeksiWhatsApp
            hapusRahasia={hapusRahasia} koneksi={koneksi} p={p} pesanKanal={pesanKanal} rahasia={rahasia} seksi={seksi} setWaTujuan={setWaTujuan} simpanRahasia={simpanRahasia} spWA={spWA} ubah={ubah} uji={uji} ujiJalan={ujiJalan} waTujuan={waTujuan}
          />

          <SeksiTelegram
            belumTG={belumTG} chatTerdeteksi={chatTerdeteksi} deteksiChat={deteksiChat} deteksiJalan={deteksiJalan} hapusRahasia={hapusRahasia} koneksi={koneksi} p={p} pesanKanal={pesanKanal} rahasia={rahasia} seksi={seksi} setSeksi={setSeksi} simpanRahasia={simpanRahasia} ubah={ubah} uji={uji} ujiJalan={ujiJalan}
          />

          <SeksiPush
            aktifkanPushServer={aktifkanPushServer} hapusRahasia={hapusRahasia} pushInfo={pushInfo} pushMemuat={pushMemuat} pushPesan={pushPesan} rahasia={rahasia} seksi={seksi} setConfirmState={setConfirmState} simpanRahasia={simpanRahasia}
          />

          <SeksiTim
            belumTG={belumTG} seksi={seksi} tim={tim}
          />

          <SeksiAI
            ai={ai} hapusRahasia={hapusRahasia} penilai={penilai} rahasia={rahasia} seksi={seksi} setAi={setAi} setPenilai={setPenilai} simpanRahasia={simpanRahasia}
          />

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
                className="tombol-utama text-xs font-bold px-4 py-2 rounded-kontrol disabled:opacity-50 shrink-0">
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
