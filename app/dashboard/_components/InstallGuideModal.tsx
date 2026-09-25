'use client';
import { ModalPortal } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';

/**
 * Panduan pasang aplikasi ke HP - langkah MANUAL lewat menu peramban, bukan
 * mengandalkan banner otomatis (PwaBootstrap) yang punya syarat kemunculan
 * sendiri di Chrome (butuh sinyal keterlibatan tertentu, bisa jadi tidak
 * pernah tampil untuk sebagian orang) dan TIDAK PERNAH tampil di Safari
 * (iOS tidak punya event install sama sekali).
 *
 * Ditaruh sebagai tautan yang SELALU ada di layar login - bukan cuma
 * menunggu banner muncul sendiri - supaya sales/tim yang bukan admin punya
 * satu tempat pasti untuk mencari tahu caranya, kapan pun mereka butuh,
 * tanpa perlu diajari admin satu-satu.
 */
export function InstallGuideModal({ warnaUtama, onClose }: { warnaUtama: string; onClose: () => void }) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" aria-label="Panduan pasang aplikasi"
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto"
          style={{ animation: 'scale-in 0.2s ease-out' }}>
          <div className="px-6 py-5 rounded-t-2xl text-white relative" style={{ background: `linear-gradient(135deg, ${warnaUtama}, #881337)` }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">Tanpa file, tanpa admin</p>
            <h2 className="text-lg font-black"><IkonTeks nama="📲" />Pasang Aplikasi di HP</h2>
            <p className="text-white/75 text-xs mt-1">Cukup 1-2 ketuk lewat menu browser - tidak perlu download file .apk atau izin admin.</p>
            <button aria-label="Tutup" onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center font-bold text-sm">✕</button>
          </div>

          <div className="p-6 space-y-6">
            {/* Android */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm font-black flex-shrink-0" style={{ background: '#16a34a' }}>A</div>
                <h3 className="font-bold text-slate-800 text-sm">Android (Chrome)</h3>
              </div>
              <ol className="space-y-2.5 pl-1">
                {[
                  'Buka link platform ini di Chrome.',
                  'Ketuk titik tiga (⋮) di kanan atas.',
                  'Pilih "Install app" atau "Tambahkan ke layar Utama".',
                  'Ketuk "Install" / "Tambahkan" - selesai. Ikonnya langsung muncul di HP.',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 mt-0.5" style={{ background: '#16a34a' }}>{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* iPhone */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm font-black flex-shrink-0" style={{ background: '#1f2937' }}></div>
                <h3 className="font-bold text-slate-800 text-sm">iPhone (Safari)</h3>
              </div>
              <ol className="space-y-2.5 pl-1">
                {[
                  'Buka link platform ini di Safari (bukan Chrome - iPhone hanya bisa lewat Safari).',
                  'Ketuk ikon Share (kotak dengan panah ke atas) di bagian bawah layar.',
                  'Gulir lalu pilih "Tambah ke Layar Utama".',
                  'Ketuk "Tambah" - selesai. Ikonnya muncul di layar utama seperti aplikasi biasa.',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 mt-0.5" style={{ background: '#1f2937' }}>{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-xl px-4 py-3 text-xs text-slate-500 leading-relaxed" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              Sesudah terpasang, notifikasi ticket/jadwal baru bisa bunyi dan muncul langsung di HP walau aplikasinya tertutup - tinggal ketuk ikon 📲 di sebelah lonceng notifikasi dashboard untuk mengaktifkannya.
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
