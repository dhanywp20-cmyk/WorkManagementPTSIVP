'use client';

/** SeksiKanal - dipecah dari app/(portal)/dashboard/_components/modal-integrasi.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { KANAL, kanalUntuk, type Kanal, type PengaturanNotifikasi } from '@/lib/notifikasi/pengaturan';
import { KATALOG_EVENT, EVENT_TERSAMBUNG, eventTersambung, type KategoriEvent } from '@/lib/notifikasi/katalog';
import { JUDUL_KATEGORI, Saklar } from '../modal-integrasi';

export interface SeksiKanalProps {
  cariEvent: string;
  cocokCari: (label: string, kunci: string) => boolean;
  kategori: KategoriEvent[];
  p: PengaturanNotifikasi;
  seksi: "kanal" | "wa" | "tg" | "push" | "tim" | "ai";
  setCariEvent: import("react").Dispatch<import("react").SetStateAction<string>>;
  spWA: import("@/lib/notifikasi/penyedia-wa").DefinisiPenyedia;
  timTG: number;
  timWA: number;
  toggleEvent: (key: string, k: Kanal) => void;
  totalTim: number;
  ubah: (f: (x: PengaturanNotifikasi) => PengaturanNotifikasi) => void;
}

export function SeksiKanal({ cariEvent, cocokCari, kategori, p, seksi, setCariEvent, spWA, timTG, timWA, toggleEvent, totalTim, ubah }: SeksiKanalProps) {
  return (
    <>
      {seksi === 'kanal' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-700">Kanal pengiriman</h3>
              <p className="text-[11.5px] text-slate-500 mt-0.5">
                Saklar induk. Yang dimatikan di sini tidak mengirim apa pun, seberapa pun lengkap centang di bawah.
              </p>
            </div>
            <div className="p-3">
              <div className="rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {KANAL.map(k => {
                  const hidup = p.aktif[k.key];
                  const sub = k.key === 'in_app' ? 'Lonceng & banner di portal'
                    : k.key === 'whatsapp' ? `Lewat ${spWA.label} · ${timWA} nomor terdaftar`
                    : `Bot pribadi · ${timTG} dari ${totalTim} anggota terhubung`;
                  return (
                    <div key={k.key} className="flex items-center gap-3 px-3.5 py-3 bg-white">
                      <span className="w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 text-sm"
                        style={{ background: `${k.warna}1a`, color: k.warna }}>
                        {k.key === 'in_app' ? '🔔' : k.key === 'whatsapp' ? '✆' : '➤'}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={`block text-[13px] font-bold ${hidup ? 'text-slate-700' : 'text-slate-500'}`}>{k.label}</span>
                        <span className="block text-[11px] text-slate-500 mt-px">{sub}</span>
                      </span>
                      <Saklar aktif={hidup} warna={k.warna}
                        onKlik={() => ubah(x => ({ ...x, aktif: { ...x.aktif, [k.key]: !x.aktif[k.key] } }))} />
                    </div>
                  );
                })}
              </div>
              {!p.aktif.whatsapp && timWA > 0 && (
                <div className="mt-2.5 rounded-lg px-3 py-2.5 text-[11.5px] leading-relaxed"
                  style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
                  <b>WhatsApp masih mati.</b> {timWA} anggota sudah punya nomor terdaftar, tapi selama saklar ini
                  mati tidak ada pesan WhatsApp yang benar-benar terkirim.
                </div>
              )}
              {!p.aktif.telegram && timTG > 0 && (
                <div className="mt-2.5 rounded-lg px-3 py-2.5 text-[11.5px] leading-relaxed"
                  style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
                  <b>Telegram masih mati.</b> {timTG} anggota sudah menghubungkan akunnya, tapi selama saklar ini
                  mati tidak ada pesan Telegram yang benar-benar terkirim.
                </div>
              )}
            </div>
          </div>

          {/*
            Matriks Event -> Kanal. Modelnya dipertahankan apa adanya -
            inilah bagian yang memang sudah enak dipakai. Yang berubah:
            ia tidak lagi disembunyikan di panel geser yang harus dibuka
            dulu, dan dapat kolom pencarian karena 22 baris terlalu banyak
            untuk dipindai dengan mata.
          */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-700">Kejadian → kanal</h3>
                <p className="text-[11.5px] text-slate-500 mt-0.5">
                  {KATALOG_EVENT.length} kejadian · centang lewat kanal mana masing-masing dikabarkan.
                </p>
              </div>
              <div className="ml-auto flex gap-3 flex-shrink-0">
                {KANAL.map(k => (
                  <span key={k.key} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: k.warna }} />
                    {k.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-3">
              {/*
                Pemberitahuan ini sengaja ada dan sengaja tidak dihaluskan.
                Setelan per-kejadian baru berlaku untuk titik pengiriman
                yang sudah menyebutkan kunci event-nya; sisanya cuma
                tunduk pada saklar induk kanal di atas. Tanpa disebut,
                admin mematikan sebuah kejadian, centangnya tersimpan,
                lalu pesannya tetap terkirim - dan tidak ada satu pun
                petunjuk kenapa.
              */}
              {EVENT_TERSAMBUNG.size < KATALOG_EVENT.length && (
                <div className="rounded-lg px-3 py-2.5 mb-2.5 text-[11px] leading-relaxed"
                  style={{ background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.35)', color: '#92400e' }}>
                  <span className="font-bold">Baru {EVENT_TERSAMBUNG.size} dari {KATALOG_EVENT.length} kejadian yang saklarnya berlaku.</span>{' '}
                  Kejadian bertanda <span className="font-bold">belum aktif</span> masih memakai jalur pengiriman lama:
                  centangnya tersimpan, tapi yang menentukan terkirim atau tidak hanya saklar induk kanal di atas.
                  Sisanya menyusul saat tiap titik pengiriman dipindahkan.
                </div>
              )}
              <input value={cariEvent} onChange={e => setCariEvent(e.target.value)}
                placeholder="Cari kejadian…" aria-label="Cari kejadian"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-cyan-400 mb-2.5" />
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-[1fr_46px_46px_46px] px-3.5 py-1.5 bg-slate-50 border-b border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Kejadian</span>
                  {KANAL.map(k => (
                    <span key={k.key} className="text-[10px] font-bold uppercase text-center" style={{ color: k.warna }}>
                      {k.label === 'WhatsApp' ? 'WA' : k.label === 'Telegram' ? 'TG' : 'App'}
                    </span>
                  ))}
                </div>
                <div className="max-h-[420px] overflow-y-auto">
                  {kategori.map(kat => {
                    const isi = KATALOG_EVENT.filter(e => e.kategori === kat && cocokCari(e.label, e.key));
                    if (isi.length === 0) return null;
                    return (
                      <div key={kat}>
                        <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-700 border-y border-slate-100"
                          style={{ background: 'rgba(8,145,178,0.06)' }}>
                          {JUDUL_KATEGORI[kat]}
                        </div>
                        {isi.map(e => {
                          const dipilih = p.perEvent[e.key] ?? (e.bawaanKanal as Kanal[]);
                          const berlaku = kanalUntuk(e.key, p);
                          return (
                            <div key={e.key} className="grid grid-cols-[1fr_46px_46px_46px] items-center px-3.5 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50">
                              <div className="min-w-0 pr-2">
                                <div className="text-[12.5px] text-slate-700 truncate flex items-center gap-1.5">
                                  <span className="truncate">{e.label}</span>
                                  {!eventTersambung(e.key) && (
                                    <span title="Titik pengirimannya belum menyebutkan kunci event ini — centang di baris ini belum berpengaruh, yang berlaku hanya saklar induk kanal di atas."
                                      className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                                      style={{ background: 'rgba(245,158,11,0.14)', color: '#b45309' }}>
                                      belum aktif
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono truncate">{e.key}</div>
                                {dipilih.length > 0 && berlaku.length === 0 && (
                                  <div className="text-[11px] text-amber-700 font-semibold mt-0.5">
                                    kanalnya dimatikan di atas — tidak terkirim
                                  </div>
                                )}
                              </div>
                              {KANAL.map(k => {
                                const on = dipilih.includes(k.key);
                                return (
                                  <button key={k.key} type="button" onClick={() => toggleEvent(e.key, k.key)}
                                    aria-label={`${e.label} — ${k.label}`} aria-pressed={on}
                                    className="flex justify-center">
                                    <span className="w-[18px] h-[18px] rounded-[5px] border-2 flex items-center justify-center transition-colors"
                                      style={{
                                        borderColor: on ? k.warna : '#cbd5e1',
                                        background: on ? k.warna : 'transparent',
                                        opacity: on && !p.aktif[k.key] ? 0.35 : 1,
                                      }}>
                                      {on && <span className="text-white text-[10px] font-black leading-none">✓</span>}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
