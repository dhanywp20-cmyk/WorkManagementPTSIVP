'use client';

/** KartuRuanganDetail - dipecah dari app/(portal)/form-require-project/_components/ModalDetailRequest.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon } from '@/components/shared/Ikon';

export interface KartuRuanganDetailProps {
  dr: { room_name: string; kebutuhan: string[]; kebutuhan_other: string; solution_product: string[]; solution_other: string; layout_signage: string[]; jaringan_cms: string[]; jumlah_input: string; jumlah_output: string; source: string[]; source_other: string; camera_conference: string; camera_jumlah: string; camera_tracking: string[]; audio_system: string; audio_mixer: string; audio_detail: string[]; wallplate_input: string; wallplate_jumlah: string; tabletop_input: string; tabletop_jumlah: string; wireless_presentation: string; wireless_mode: string[]; wireless_dongle: string; controller_automation: string; controller_type: string[]; ukuran_ruangan: string; suggest_tampilan: string; keterangan_lain: string; brand_display: string | undefined; brand_display_pic_name: string | undefined; brand_display_2: string | undefined; brand_display_2_pic_name: string | undefined; brand_middleware: string | undefined; brand_middleware_pic_name: string | undefined; };
}

export function KartuRuanganDetail({ dr }: KartuRuanganDetailProps) {
  return (
    <>
      <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 shrink-0 bg-teal-600 text-white rounded-lg flex items-center justify-center text-xs shadow"><Ikon nama="📐" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
          Ruangan & Informasi Lainnya
        </h3>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Ukuran Ruangan (P × L × T)</label><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.ukuran_ruangan||'—'}</p></div>
            <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Suggest Tampilan (W × H)</label><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.suggest_tampilan||'—'}</p></div>
          </div>
          {dr.keterangan_lain && <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Keterangan Lain</label><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 whitespace-pre-wrap">{dr.keterangan_lain}</p></div>}
        </div>
      </div>
    </>
  );
}
