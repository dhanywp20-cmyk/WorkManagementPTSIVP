'use client';

/** KartuKategoriDetail - dipecah dari app/(portal)/form-require-project/_components/ModalDetailRequest.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';

export interface KartuKategoriDetailProps {
  ChipDisplay: ({ items }: { items: (string | undefined)[]; }) => import("react").JSX.Element;
  dr: { room_name: string; kebutuhan: string[]; kebutuhan_other: string; solution_product: string[]; solution_other: string; layout_signage: string[]; jaringan_cms: string[]; jumlah_input: string; jumlah_output: string; source: string[]; source_other: string; camera_conference: string; camera_jumlah: string; camera_tracking: string[]; audio_system: string; audio_mixer: string; audio_detail: string[]; wallplate_input: string; wallplate_jumlah: string; tabletop_input: string; tabletop_jumlah: string; wireless_presentation: string; wireless_mode: string[]; wireless_dongle: string; controller_automation: string; controller_type: string[]; ukuran_ruangan: string; suggest_tampilan: string; keterangan_lain: string; brand_display: string | undefined; brand_display_pic_name: string | undefined; brand_display_2: string | undefined; brand_display_2_pic_name: string | undefined; brand_middleware: string | undefined; brand_middleware_pic_name: string | undefined; };
}

export function KartuKategoriDetail({ ChipDisplay, dr }: KartuKategoriDetailProps) {
  return (
    <>
      <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 shrink-0 bg-teal-600 text-white rounded-lg flex items-center justify-center text-xs shadow"><Ikon nama="🎯" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
          Kategori Kebutuhan & Solution
        </h3>
        <div className="space-y-4">
          <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kebutuhan</label><ChipDisplay items={[...(dr.kebutuhan||[]), dr.kebutuhan_other]} /></div>
          <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Solution Product</label><ChipDisplay items={[...(dr.solution_product||[]), dr.solution_other]} /></div>
          {(dr.brand_display || dr.brand_display_2) && <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {dr.brand_display && <div><label className="block text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-1"><IkonTeks nama="🖥" />Brand Display</label><p className="text-sm font-semibold text-gray-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{dr.brand_display}{dr.brand_display_pic_name && <span className="text-[11px] text-amber-700 ml-2">· PIC: {dr.brand_display_pic_name}</span>}</p></div>}
            {dr.brand_display_2 && <div><label className="block text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-1"><IkonTeks nama="🖥" />Brand Display 2</label><p className="text-sm font-semibold text-gray-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{dr.brand_display_2}{dr.brand_display_2_pic_name && <span className="text-[11px] text-amber-700 ml-2">· PIC: {dr.brand_display_2_pic_name}</span>}</p></div>}
            {dr.brand_middleware && <div><label className="block text-[11px] font-bold text-violet-600 uppercase tracking-widest mb-1"><IkonTeks nama="🔌" />Brand Middleware</label><p className="text-sm font-semibold text-gray-800 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">{dr.brand_middleware}{dr.brand_middleware_pic_name && <span className="text-[11px] text-violet-600 ml-2">· PIC: {dr.brand_middleware_pic_name}</span>}</p></div>}
          </div>}
        </div>
      </div>
    </>
  );
}
