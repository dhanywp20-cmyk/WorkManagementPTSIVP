'use client';

/** SeksiTelegram - dipecah dari app/(portal)/dashboard/_components/modal-integrasi.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { type StatusRahasia, type StatusKoneksi } from '../modal-integrasi';
import { IkonTeks } from '@/components/shared/Ikon';
import { type PengaturanNotifikasi } from '@/lib/notifikasi/pengaturan';
import { BlokToken, LencanaStatus, PesanKotak } from '../modal-integrasi';

export interface SeksiTelegramProps {
  belumTG: number;
  chatTerdeteksi: { id: string; nama: string; jenis: string; }[] | null;
  deteksiChat: () => Promise<void>;
  deteksiJalan: boolean;
  hapusRahasia: (kunci: string) => Promise<void>;
  koneksi: Record<"telegram" | "whatsapp", StatusKoneksi>;
  p: PengaturanNotifikasi;
  pesanKanal: Record<string, PesanKotak | null>;
  rahasia: Record<string, StatusRahasia>;
  seksi: "kanal" | "wa" | "tg" | "push" | "tim" | "ai";
  setSeksi: import("react").Dispatch<import("react").SetStateAction<"kanal" | "wa" | "tg" | "push" | "tim" | "ai">>;
  simpanRahasia: (kunci: string, nilai: string) => Promise<void>;
  ubah: (f: (x: PengaturanNotifikasi) => PengaturanNotifikasi) => void;
  uji: (kanal: "telegram" | "whatsapp", aksi: "cek" | "kirim") => Promise<void>;
  ujiJalan: string | null;
}

export function SeksiTelegram({ belumTG, chatTerdeteksi, deteksiChat, deteksiJalan, hapusRahasia, koneksi, p, pesanKanal, rahasia, seksi, setSeksi, simpanRahasia, ubah, uji, ujiJalan }: SeksiTelegramProps) {
  return (
    <>
      {seksi === 'tg' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-3 items-start">
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-700">Bot Telegram</h3>
                  <p className="text-[11.5px] text-slate-500 mt-0.5">Satu bot melayani seluruh notifikasi platform.</p>
                </div>
                <span className="ml-auto flex-shrink-0"><LencanaStatus status={koneksi.telegram} /></span>
              </div>
              <div className="p-3 space-y-3">
                <BlokToken
                  judul="Token bot" kunci="telegram.bot_token" status={rahasia['telegram.bot_token']}
                  onSimpan={n => simpanRahasia('telegram.bot_token', n)}
                  onHapus={() => hapusRahasia('telegram.bot_token')}
                  petunjuk={<>Dari @BotFather. Bentuknya <span className="font-mono">8333710505:AAF…</span> — salin seluruh
                    baris termasuk angka sebelum titik dua (klik dua kali di Telegram sering hanya memilih separuhnya).</>} />

                <div>
                  <label htmlFor="f-dashboard-components-modal-integrasi-2" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Tujuan bawaan <span className="normal-case tracking-normal font-normal text-slate-400">— opsional</span>
                  </label>
                  <input id="f-dashboard-components-modal-integrasi-2" value={p.telegramChatId} placeholder="mis. -1001234567890"
                    onChange={e => ubah(x => ({ ...x, telegramChatId: e.target.value }))}
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-sky-400 font-mono" />
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button type="button" onClick={deteksiChat}
                      disabled={deteksiJalan || koneksi.telegram.keadaan !== 'terhubung'}
                      title={koneksi.telegram.keadaan !== 'terhubung' ? 'Isi token bot dulu.' : undefined}
                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-white disabled:opacity-40"
                      style={{ background: '#0088cc' }}>
                      {deteksiJalan ? 'Mendeteksi…' : '🔎 Deteksi Chat ID'}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    Untuk pemberitahuan yang tidak ditujukan ke orang tertentu (mis. ringkasan harian).
                    Notifikasi assign selalu masuk ke Telegram pribadi masing-masing, bukan ke sini.
                  </p>

                  {chatTerdeteksi && chatTerdeteksi.length > 0 && (
                    <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden">
                      <div className="px-2.5 py-1 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Percakapan terbaca — klik untuk memakai
                      </div>
                      {chatTerdeteksi.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => ubah(x => ({ ...x, telegramChatId: c.id }))}
                          className="w-full text-left px-2.5 py-1.5 border-t border-slate-100 hover:bg-sky-50 transition-colors flex items-center gap-2">
                          <span className="text-[11px] flex-shrink-0">{c.jenis === 'private' ? '👤' : '👥'}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[11px] font-semibold text-slate-700 truncate">{c.nama}</span>
                            <span className="block text-[10px] font-mono text-slate-500">{c.id}</span>
                          </span>
                          {p.telegramChatId === c.id && (
                            <span className="text-[10px] font-bold text-sky-700 flex-shrink-0">dipakai</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-700">Cara anggota terhubung</h3>
                <p className="text-[11.5px] text-slate-500 mt-0.5">
                  Telegram tidak bisa dikirim ke nomor HP — tiap orang menghubungkan akunnya sendiri, sekali saja.
                </p>
              </div>
              <div className="p-3">
                <div className="rounded-lg px-3 py-2.5 text-[11.5px] leading-relaxed"
                  style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
                  Anggota membuka <b>Profil → Notifikasi Telegram</b>, menekan <b>Buka Bot</b>, lalu <b>Start</b> di
                  Telegram. Chat ID-nya terisi sendiri setelah itu — tidak ada yang perlu diketik manual, dan tidak
                  perlu diulang.
                </div>
                <button type="button" onClick={() => setSeksi('tim')}
                  className="mt-2.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200">
                  Lihat siapa yang belum ({belumTG})
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3.5" style={{ background: '#f8fafc' }}>
            <h4 className="text-[13px] font-bold text-slate-700">Uji pengiriman</h4>
            <p className="text-[11.5px] text-slate-500 mt-0.5 mb-3 leading-relaxed">
              Memakai bot dan tujuan bawaan yang tersimpan sekarang.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => uji('telegram', 'cek')} disabled={ujiJalan !== null}
                className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                {ujiJalan === 'telegram-cek' ? 'Mengecek…' : 'Tes Koneksi'}
              </button>
              <button type="button" onClick={() => uji('telegram', 'kirim')} disabled={ujiJalan !== null || !p.telegramChatId.trim()}
                className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: '#0088cc' }}>
                {ujiJalan === 'telegram-kirim' ? 'Mengirim…' : 'Kirim Pesan Tes'}
              </button>
            </div>
            {!p.telegramChatId.trim() && (
              <p className="text-[11px] text-slate-500 mt-2">Isi tujuan bawaan dulu untuk bisa mengirim pesan tes.</p>
            )}
            <PesanKotak pesan={pesanKanal.telegram ?? null} />
            {!p.aktif.telegram && (
              <div className="mt-2 rounded-lg px-2.5 py-2 text-[11px] font-semibold leading-relaxed"
                style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
                <IkonTeks nama="⚠" />Kanal Telegram masih mati di <b>Kanal &amp; Event</b>. Tes di sini tetap jalan, tapi notifikasi
                asli belum akan terkirim.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
