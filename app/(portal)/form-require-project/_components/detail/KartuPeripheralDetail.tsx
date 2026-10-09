'use client';

/** KartuPeripheralDetail - dipecah dari app/(portal)/form-require-project/_components/ModalDetailRequest.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon } from '@/components/shared/Ikon';

export interface KartuPeripheralDetailProps {
  ChipDisplay: ({ items }: { items: (string | undefined)[]; }) => import("react").JSX.Element;
  YNDisplay: ({ value, label }: { value: string; label: string; }) => import("react").JSX.Element;
  dr: { room_name: string; kebutuhan: string[]; kebutuhan_other: string; solution_product: string[]; solution_other: string; layout_signage: string[]; jaringan_cms: string[]; jumlah_input: string; jumlah_output: string; source: string[]; source_other: string; camera_conference: string; camera_jumlah: string; camera_tracking: string[]; audio_system: string; audio_mixer: string; audio_detail: string[]; wallplate_input: string; wallplate_jumlah: string; tabletop_input: string; tabletop_jumlah: string; wireless_presentation: string; wireless_mode: string[]; wireless_dongle: string; controller_automation: string; controller_type: string[]; ukuran_ruangan: string; suggest_tampilan: string; keterangan_lain: string; brand_display: string | undefined; brand_display_pic_name: string | undefined; brand_display_2: string | undefined; brand_display_2_pic_name: string | undefined; brand_middleware: string | undefined; brand_middleware_pic_name: string | undefined; };
}

export function KartuPeripheralDetail({ ChipDisplay, YNDisplay, dr }: KartuPeripheralDetailProps) {
  return (
    <>
      <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 shrink-0 bg-teal-600 text-white rounded-lg flex items-center justify-center text-xs shadow"><Ikon nama="🔌" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
          Source & Peripheral
        </h3>
        <div className="space-y-4">
          <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Source</label><ChipDisplay items={[...(dr.source||[]), dr.source_other]} /></div>

          {/* Enam pilihan Yes/No dalam SATU grid dua kolom.
              Sebelumnya sebagian menumpuk penuh dan hanya Wallplate +
              Tabletop yang dua kolom, sehingga Tabletop berdiri
              sendirian di kanan sementara kirinya berderet penuh -
              terbaca seperti ada isian yang hilang, padahal tidak.
              items-start supaya kartu yang punya rincian lanjutan
              tidak menarik tinggi pasangannya. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 items-start">
          {/* Camera */}
          <div>
            <YNDisplay value={dr.camera_conference||'No'} label="Camera Conference" />
            {dr.camera_conference === 'Yes' && (
              <div className="ml-4 pl-4 border-l-2 border-teal-200 space-y-2 mt-2">
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Camera</label><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.camera_jumlah||'—'}</p></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Camera Tracking</label><ChipDisplay items={dr.camera_tracking||[]} /></div>
              </div>
            )}
          </div>

          {/* Audio */}
          <div>
            <YNDisplay value={dr.audio_system||'No'} label="Audio System" />
            {dr.audio_system === 'Yes' && (
              <div className="ml-4 pl-4 border-l-2 border-teal-200 space-y-2 mt-2">
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Mixer / DSP</label><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.audio_mixer||'—'}</p></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Audio Detail</label><ChipDisplay items={dr.audio_detail||[]} /></div>
              </div>
            )}
          </div>

          {/* Wallplate */}
          <div>
            <YNDisplay value={dr.wallplate_input||'No'} label="Wallplate Input" />
            {dr.wallplate_input === 'Yes' && <div className="ml-4 pl-4 border-l-2 border-teal-200 mt-1"><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.wallplate_jumlah||'—'}</p></div>}
          </div>

          {/* Tabletop */}
          <div>
            <YNDisplay value={dr.tabletop_input||'No'} label="Tabletop Input" />
            {dr.tabletop_input === 'Yes' && <div className="ml-4 pl-4 border-l-2 border-teal-200 mt-1"><p className="text-sm font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{dr.tabletop_jumlah||'—'}</p></div>}
          </div>

          {/* Wireless */}
          <div>
            <YNDisplay value={dr.wireless_presentation||'No'} label="Wireless Presentation" />
            {dr.wireless_presentation === 'Yes' && (
              <div className="ml-4 pl-4 border-l-2 border-teal-200 space-y-2 mt-2">
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Wireless Mode</label><ChipDisplay items={dr.wireless_mode||[]} /></div>
                <div><YNDisplay value={dr.wireless_dongle||'No'} label="Dongle" /></div>
              </div>
            )}
          </div>

          {/* Controller */}
          <div>
            <YNDisplay value={dr.controller_automation||'No'} label="Controller / Automation" />
            {dr.controller_automation === 'Yes' && (
              <div className="ml-4 pl-4 border-l-2 border-teal-200 mt-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Controller Type</label><ChipDisplay items={dr.controller_type||[]} />
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </>
  );
}
