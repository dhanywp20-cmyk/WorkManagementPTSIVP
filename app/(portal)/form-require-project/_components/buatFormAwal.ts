'use client';

import { User } from './shared';
import { InitialFormType } from './Modals';

export interface KonteksBuatFormAwal {
  isPTS: boolean;
  currentUser: User;
}

export function buatFormAwal(k: KonteksBuatFormAwal) {
  const { isPTS, currentUser } = k;
  const initialForm: InitialFormType = {
    project_name: '', room_name: '', project_location: '',
    sales_name: !isPTS ? (currentUser.full_name || '') : '',
    sales_division: !isPTS ? (currentUser.sales_division?.trim() || '') : '',
    kebutuhan: [], kebutuhan_other: '',
    solution_product: [], solution_other: '',
    layout_signage: [], jaringan_cms: [],
    jumlah_input: '', jumlah_output: '',
    source: [], source_other: '',
    camera_conference: 'No', camera_jumlah: '', camera_tracking: [],
    audio_system: 'No', audio_mixer: '', audio_detail: [],
    wallplate_input: 'No', wallplate_jumlah: '',
    tabletop_input: 'No', tabletop_jumlah: '',
    wireless_presentation: 'No', wireless_mode: [], wireless_dongle: 'No',
    controller_automation: 'No', controller_type: [],
    ukuran_ruangan: '', suggest_tampilan: '', keterangan_lain: '',
    brand_display: '', brand_display_pic_id: '', brand_display_pic_name: '',
  brand_display_2: '', brand_display_2_pic_id: '', brand_display_2_pic_name: '',
    brand_middleware: '', brand_middleware_pic_id: '', brand_middleware_pic_name: '',
    source_laptop_qty: '', source_pc_qty: '',
  };
  return { initialForm };
}
