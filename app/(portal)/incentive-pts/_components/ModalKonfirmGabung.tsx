'use client';

/** ModalKonfirmGabung - dipecah dari app/(portal)/incentive-pts/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { type KandidatGabung } from './calc';

export interface ModalKonfirmGabungProps {
  jalankanGabung: () => Promise<void>;
  konfirmGabung: KandidatGabung | null;
  menggabung: boolean;
  setKonfirmGabung: import("react").Dispatch<import("react").SetStateAction<KandidatGabung | null>>;
}

export function ModalKonfirmGabung({ jalankanGabung, konfirmGabung, menggabung, setKonfirmGabung }: ModalKonfirmGabungProps) {
  return (
    <>
      {konfirmGabung && (
        <ModalPortal>
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.55)' }} onClick={() => !menggabung && setKonfirmGabung(null)}>
            <div onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
              <div className="px-5 py-3.5 bg-amber-600 text-white">
                <h3 className="font-bold text-base">Gabungkan jadi satu proyek?</h3>
              </div>
              <div className="p-5 space-y-3 text-[13px] leading-relaxed">
                <p className="font-bold text-slate-800">{konfirmGabung.nama}</p>
                <div className="rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-200">
                  {konfirmGabung.anggota.map((a, i) => (
                    <div key={i} className="px-3 py-2 flex justify-between gap-3">
                      <span className="text-slate-700">{a.category ?? '-'}</span>
                      <span className="text-slate-500 text-right">{a.assign_name ?? '-'} · {a.due_date}</span>
                    </div>
                  ))}
                </div>
                <p className="text-slate-700">
                  Setelah digabung, keduanya dihitung <b>satu proyek dengan satu pool nominal</b>.
                </p>
                <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Bila penangannya berbeda, yang satu menjadi <b>PIC</b> dan yang lain masuk sebagai{' '}
                  <b>Support</b> — bagiannya mengecil, tapi tidak hilang. Yang hilang adalah pool
                  kedua yang memang seharusnya tidak ada.
                </p>
                <p className="text-slate-500 text-[12px]">
                  Kalau ini sebenarnya dua kontrak berbeda, tekan Batal dan biarkan terpisah.
                </p>
              </div>
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                <button onClick={() => setKonfirmGabung(null)} disabled={menggabung}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50">
                  Batal
                </button>
                <button onClick={jalankanGabung} disabled={menggabung}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2">
                  {menggabung && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Ya, Gabungkan
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
