'use client';

/** SeksiWhatsApp - dipecah dari app/(portal)/dashboard/_components/modal-integrasi.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { type StatusRahasia, type StatusKoneksi } from '../modal-integrasi';
import { PENYEDIA_WA } from '@/lib/notifikasi/penyedia-wa';
import { IkonTeks } from '@/components/shared/Ikon';
import { type PengaturanNotifikasi } from '@/lib/notifikasi/pengaturan';
import { BlokToken, LencanaStatus, PesanKotak } from '../modal-integrasi';

export interface SeksiWhatsAppProps {
  hapusRahasia: (kunci: string) => Promise<void>;
  koneksi: Record<"telegram" | "whatsapp", StatusKoneksi>;
  p: PengaturanNotifikasi;
  pesanKanal: Record<string, PesanKotak | null>;
  rahasia: Record<string, StatusRahasia>;
  seksi: "kanal" | "wa" | "tg" | "push" | "tim" | "ai";
  setWaTujuan: import("react").Dispatch<import("react").SetStateAction<string>>;
  simpanRahasia: (kunci: string, nilai: string) => Promise<void>;
  spWA: import("@/lib/notifikasi/penyedia-wa").DefinisiPenyedia;
  ubah: (f: (x: PengaturanNotifikasi) => PengaturanNotifikasi) => void;
  uji: (kanal: "telegram" | "whatsapp", aksi: "cek" | "kirim") => Promise<void>;
  ujiJalan: string | null;
  waTujuan: string;
}

export function SeksiWhatsApp({ hapusRahasia, koneksi, p, pesanKanal, rahasia, seksi, setWaTujuan, simpanRahasia, spWA, ubah, uji, ujiJalan, waTujuan }: SeksiWhatsAppProps) {
  return (
    <>
      {seksi === 'wa' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-3 items-start">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Gateway WhatsApp</h3>
                <p className="text-[11.5px] text-slate-500 mt-0.5">Penyedia yang mengantar pesan ke nomor tim.</p>
              </div>
              <span className="ml-auto flex-shrink-0"><LencanaStatus status={spWA.bisaCek ? koneksi.whatsapp : { keadaan: 'terhubung', info: spWA.label }} /></span>
            </div>
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-1 formulir:grid-cols-3 gap-2">
                {PENYEDIA_WA.map(sp => {
                  const dipilih = p.waPenyedia === sp.key;
                  return (
                    <button key={sp.key} type="button" aria-pressed={dipilih}
                      onClick={() => ubah(x => ({ ...x, waPenyedia: sp.key }))}
                      className="text-left rounded-lg border-2 px-2.5 py-2 transition-colors"
                      style={{ borderColor: dipilih ? '#16a34a' : '#e2e8f0', background: dipilih ? '#16a34a0d' : 'transparent' }}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[11.5px] font-bold text-slate-700 leading-tight">{sp.label}</span>
                        {sp.resmi && <span className="text-[10px] font-black px-1 py-px rounded bg-sky-100 text-sky-700 flex-shrink-0">RESMI</span>}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">{sp.ringkas}</p>
                    </button>
                  );
                })}
              </div>

              {spWA.catatan && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <p className="text-[11px] text-amber-800 leading-relaxed">{spWA.catatan}</p>
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
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">{kol.label}</label>
                    <input value={p.waConfig[kol.kunci] ?? ''} placeholder={kol.placeholder}
                      onChange={e => ubah(x => ({ ...x, waConfig: { ...x.waConfig, [kol.kunci]: e.target.value } }))}
                      className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-green-400" />
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{kol.petunjuk}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Panel uji: di SEBELAH barang yang diuji, bukan di dasar halaman. */}
          <div className="rounded-xl border border-slate-200 p-3.5" style={{ background: '#f8fafc' }}>
            <h4 className="text-[13px] font-bold text-slate-700">Uji pengiriman</h4>
            <p className="text-[11.5px] text-slate-500 mt-0.5 mb-3 leading-relaxed">
              Kirim satu pesan nyata untuk memastikan gateway benar-benar jalan.
            </p>
            <label htmlFor="f-dashboard-components-modal-integrasi-1" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Nomor tujuan</label>
            <input id="f-dashboard-components-modal-integrasi-1" value={waTujuan} onChange={e => setWaTujuan(e.target.value)} placeholder="contoh: 6281234567890"
              className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-green-400" />
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Kode negara tanpa <span className="font-mono">+</span>. Awalan <span className="font-mono">08…</span> ditulis <span className="font-mono">628…</span>
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {spWA.bisaCek && (
                <button type="button" onClick={() => uji('whatsapp', 'cek')} disabled={ujiJalan !== null}
                  className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                  {ujiJalan === 'whatsapp-cek' ? 'Mengecek…' : 'Tes Koneksi'}
                </button>
              )}
              <button type="button" onClick={() => uji('whatsapp', 'kirim')} disabled={ujiJalan !== null || !waTujuan.trim()}
                className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: '#16a34a' }}>
                {ujiJalan === 'whatsapp-kirim' ? 'Mengirim…' : 'Kirim Pesan Tes'}
              </button>
            </div>
            <PesanKotak pesan={pesanKanal.whatsapp ?? null} />
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              Tekan <b>Simpan</b> dulu setelah berpindah penyedia — tes memakai penyedia yang tersimpan.
            </p>
            {!p.aktif.whatsapp && (
              <div className="mt-2 rounded-lg px-2.5 py-2 text-[11px] font-semibold leading-relaxed"
                style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
                <IkonTeks nama="⚠" />Kanal WhatsApp masih mati di <b>Kanal &amp; Event</b>. Tes di sini tetap jalan, tapi notifikasi
                asli belum akan terkirim.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
