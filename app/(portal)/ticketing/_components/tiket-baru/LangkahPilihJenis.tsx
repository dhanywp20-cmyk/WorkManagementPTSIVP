'use client';

/** LangkahPilihJenis - dipecah dari app/(portal)/ticketing/_components/NewTicketModal.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon } from '@/components/shared/Ikon';
import { Modal, TombolModal } from '@/components/shared';

export interface LangkahPilihJenisProps {
  onClose: () => void;
  setLangkah: import("react").Dispatch<import("react").SetStateAction<"pilih" | "cari" | "form">>;
  switchProjectType: (type: "new" | "existing") => void;
}

export function LangkahPilihJenis({ onClose, setLangkah, switchProjectType }: LangkahPilihJenisProps) {
  return (
    <Modal buka onTutup={onClose} judul="Ticket Troubleshooting Baru" keterangan="Project-nya sudah pernah dikerjakan, atau baru?"
      footer={<TombolModal onClick={onClose}>Batal</TombolModal>}>
          <div className="space-y-2.5">
            <button type="button"
              onClick={() => { switchProjectType('existing'); setLangkah('cari'); }}
              className="w-full text-left p-3.5 rounded-xl border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all">
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
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
                <span className="text-2xl shrink-0"><Ikon nama="✏" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
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
    </Modal>
  );
}
