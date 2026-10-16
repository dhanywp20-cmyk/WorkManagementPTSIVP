'use client';

/** LangkahPilihJenis - dipecah dari app/(portal)/ticketing/_components/NewTicketModal.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';

export interface LangkahPilihJenisProps {
  onClose: () => void;
  setLangkah: import("react").Dispatch<import("react").SetStateAction<"pilih" | "cari" | "form">>;
  switchProjectType: (type: "new" | "existing") => void;
}

export function LangkahPilihJenis({ onClose, setLangkah, switchProjectType }: LangkahPilihJenisProps) {
  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)' }}>
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
          role="dialog" aria-modal="true" aria-labelledby="judul-tipe-project">
          <div className="px-5 py-4 text-white" style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)' }}>
            <h3 id="judul-tipe-project" className="font-bold text-base"><IkonTeks nama="🎫" />Ticket Troubleshooting Baru</h3>
            <p className="text-[12px] text-white/80 mt-0.5">Project-nya sudah pernah dikerjakan, atau baru?</p>
          </div>
          <div className="p-4 space-y-2.5">
            <button type="button"
              onClick={() => { switchProjectType('existing'); setLangkah('cari'); }}
              className="w-full text-left p-3.5 rounded-xl border-2 border-slate-200 hover:border-red-400 hover:bg-red-50/50 transition-all">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">Project yang sudah ada</p>
                  <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">
                    Pernah dikonfigurasi atau di-training dan tercatat di Request Schedule.
                    Cari namanya — alamat, PIC, produk, dan sales otomatis terisi.
                  </p>
                  <p className="text-[11px] font-semibold text-emerald-700 mt-1.5">
                    ✓ Disarankan — ticket tertaut ke jadwal aslinya
                  </p>
                </div>
              </div>
            </button>
            <button type="button"
              onClick={() => { switchProjectType('new'); setLangkah('form'); }}
              className="w-full text-left p-3.5 rounded-xl border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0"><Ikon nama="✏" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">Project baru</p>
                  <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">
                    Belum pernah masuk Request Schedule. Seluruh detailnya diisi manual,
                    tanpa referensi.
                  </p>
                </div>
              </div>
            </button>
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100">
              Batal
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
