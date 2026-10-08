'use client';

/** KartuLayoutDetail - dipecah dari app/(portal)/form-require-project/_components/ModalDetailRequest.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */


export interface KartuLayoutDetailProps {
  ChipDisplay: ({ items }: { items: (string | undefined)[]; }) => import("react").JSX.Element;
  dr: { room_name: string; kebutuhan: string[]; kebutuhan_other: string; solution_product: string[]; solution_other: string; layout_signage: string[]; jaringan_cms: string[]; jumlah_input: string; jumlah_output: string; source: string[]; source_other: string; camera_conference: string; camera_jumlah: string; camera_tracking: string[]; audio_system: string; audio_mixer: string; audio_detail: string[]; wallplate_input: string; wallplate_jumlah: string; tabletop_input: string; tabletop_jumlah: string; wireless_presentation: string; wireless_mode: string[]; wireless_dongle: string; controller_automation: string; controller_type: string[]; ukuran_ruangan: string; suggest_tampilan: string; keterangan_lain: string; brand_display: string | undefined; brand_display_pic_name: string | undefined; brand_display_2: string | undefined; brand_display_2_pic_name: string | undefined; brand_middleware: string | undefined; brand_middleware_pic_name: string | undefined; };
}

export function KartuLayoutDetail({ ChipDisplay, dr }: KartuLayoutDetailProps) {
  return (
    <>
      <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 shrink-0 bg-teal-600 text-white rounded-lg flex items-center justify-center text-xs shadow">📺</span>
          Layout Konten & Jaringan
        </h3>
        <div className="space-y-4">
          <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Layout Signage</label><ChipDisplay items={dr.layout_signage||[]} /></div>
          <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Jaringan / CMS</label><ChipDisplay items={dr.jaringan_cms||[]} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Input</label><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.jumlah_input||'—'}</p></div>
            <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Output</label><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.jumlah_output||'—'}</p></div>
          </div>
        </div>
      </div>
    </>
  );
}
