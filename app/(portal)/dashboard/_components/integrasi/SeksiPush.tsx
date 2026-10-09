'use client';

/** SeksiPush - dipecah dari app/(portal)/dashboard/_components/modal-integrasi.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { type StatusRahasia } from '../modal-integrasi';
import { Ikon } from '@/components/shared/Ikon';
import { type ConfirmState } from '@/components/shared';
import { BlokToken, PesanKotak } from '../modal-integrasi';

export interface SeksiPushProps {
  aktifkanPushServer: (paksa: boolean) => Promise<void>;
  hapusRahasia: (kunci: string) => Promise<void>;
  pushInfo: { aktif: boolean; jumlahPerangkat: number; } | null;
  pushMemuat: boolean;
  pushPesan: { tipe: "ok" | "gagal"; teks: string; } | null;
  rahasia: Record<string, StatusRahasia>;
  seksi: "kanal" | "wa" | "tg" | "push" | "tim" | "ai";
  setConfirmState: import("react").Dispatch<import("react").SetStateAction<ConfirmState | null>>;
  simpanRahasia: (kunci: string, nilai: string) => Promise<void>;
}

export function SeksiPush({ aktifkanPushServer, hapusRahasia, pushInfo, pushMemuat, pushPesan, rahasia, seksi, setConfirmState, simpanRahasia }: SeksiPushProps) {
  return (
    <>
      {seksi === 'push' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-3 items-start">
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-700">Push Notification Aplikasi</h3>
                  <p className="text-[11.5px] text-slate-500 mt-0.5">
                    Notifikasi sistem asli + bunyi di HP, walau aplikasi/tab sedang tertutup - seperti WhatsApp.
                  </p>
                </div>
                <span className={`ml-auto flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  pushInfo?.aktif ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {pushInfo === null ? 'Memuat…' : pushInfo.aktif ? 'Aktif' : 'Belum aktif'}
                </span>
              </div>
              <div className="p-3 space-y-3">
                {!pushInfo?.aktif ? (
                  <>
                    <p className="text-[11.5px] text-slate-500 leading-relaxed">
                      Sekali diaktifkan, siapa pun di tim yang menekan tombol 🔔 di lonceng notifikasi dashboard
                      bisa mendaftarkan HP-nya sendiri untuk menerima notifikasi ini - tidak perlu diatur admin
                      per-orang.
                    </p>
                    <button type="button" onClick={() => aktifkanPushServer(false)} disabled={pushMemuat}
                      className="text-[12px] font-bold px-3 py-2 rounded-lg text-white disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#e11d48,#be123c)' }}>
                      {pushMemuat ? 'Mengaktifkan…' : '📲 Aktifkan Push Notification'}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[11.5px] text-slate-500 leading-relaxed">
                      <b>{pushInfo.jumlahPerangkat}</b> perangkat terdaftar saat ini.
                    </p>
                    <button type="button" onClick={() => setConfirmState({ message: 'Buat ulang kunci push?', description: 'SEMUA perangkat yang sudah terdaftar akan terputus dan harus mendaftar ulang.', danger: true, confirmLabel: 'Ya, buat ulang', onConfirm: () => aktifkanPushServer(true) })}
                      disabled={pushMemuat}
                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                      {pushMemuat ? 'Memproses…' : '🔁 Generate Ulang Kunci'}
                    </button>
                  </>
                )}
                <PesanKotak pesan={pushPesan} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-700">Aplikasi Android (Firebase)</h3>
                <p className="text-[11.5px] text-slate-500 mt-0.5">
                  Notifikasi + bunyi di aplikasi Android walau aplikasinya ditutup. Terpisah dari push browser di atas.
                </p>
              </div>
              <div className="p-3">
                <BlokToken
                  judul="Service account JSON" kunci="push.fcm_service_account" status={rahasia['push.fcm_service_account']}
                  onSimpan={n => simpanRahasia('push.fcm_service_account', n)}
                  onHapus={() => hapusRahasia('push.fcm_service_account')}
                  petunjuk={<>Firebase Console → Project settings → Service accounts → <b>Generate new private key</b>.
                    Tempel seluruh isi berkas JSON-nya.</>} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3.5" style={{ background: '#f8fafc' }}>
            <h4 className="text-[13px] font-bold text-slate-700">Cara anggota mengaktifkan</h4>
            <p className="text-[11.5px] text-slate-500 mt-1.5 leading-relaxed">
              Buka Dashboard di HP → tekan ikon <b><Ikon nama="📲" ukuran="1em" className="inline-block align-[-0.12em]" /></b> di sebelah lonceng notifikasi → izinkan saat diminta.
              Sekali per HP/browser, tidak perlu diulang.
            </p>
            <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">
              Di iPhone, notifikasi push HANYA berjalan setelah platform ini dipasang lewat &quot;Tambah ke Layar
              Utama&quot; (Safari) - batasan dari Apple, bukan platform ini.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
