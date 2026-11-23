'use client';
import { BarSub } from './led/panel/BarSub';
import { ModalBersama } from './led/panel/ModalBersama';
import { TampilanDaya } from './led/panel/TampilanDaya';
import { TampilanKoneksi } from './led/panel/TampilanKoneksi';
import { TampilanBanding } from './led/banding/TampilanBanding';
import { TampilanKonten } from './led/konten/TampilanKonten';
import { PanelLangkah } from './led/panel/PanelLangkah';
import { PanggungLED } from './led/panggung/PanggungLED';
import { KartuHasil } from './led/panel/KartuHasil';
import { KartuHardware } from './led/panel/KartuHardware';
import { KartuBom } from './led/panel/KartuBom';
import { CatatanLED } from './led/panel/CatatanLED';
import { useKeadaanLED } from './led/useKeadaanLED';
import { useEksporLED } from './led/useEksporLED';
import type { AlatLED } from './led/panel/alat';
import { useDrafLokal } from './bersama/penjagaKerja';
import type { SubLED } from './led/panel/BarSub';

export type { SubLED };

export function KalkulatorLED({ subAwal = 'led', onSub }: { subAwal?: SubLED; onSub?: (sub: SubLED) => void }) {
  const K = useKeadaanLED({ subAwal, onSub });
  useDrafLokal('wm_led_draf', K.isian, d => { K.terapkan(d); K.riwayat.mulaiBaru(d); });
  const E = useEksporLED(K);
  const a: AlatLED = { K, E };

  if (K.tampilan === 'daya') return <TampilanDaya a={a} />;
  if (K.tampilan === 'koneksi') return <TampilanKoneksi a={a} />;
  if (K.tampilan === 'banding') return <TampilanBanding a={a} />;
  if (K.tampilan === 'konten') return <TampilanKonten a={a} />;

  return (
    <div className="space-y-4">
      <BarSub a={a} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px] items-start">
        <div className="min-w-0 xl:col-start-1 xl:row-start-1"><PanggungLED a={a} /></div>
        <div className="min-w-0 xl:col-start-2 xl:row-start-1 xl:row-span-2 xl:self-stretch">
          <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto rounded-2xl"><PanelLangkah a={a} /></div>
        </div>
        <div className="space-y-4 min-w-0 xl:col-start-1 xl:row-start-2">
          <KartuHasil a={a} />
          <KartuHardware a={a} />
          <KartuBom a={a} />
          <CatatanLED a={a} />
        </div>
        <ModalBersama a={a} />
      </div>
    </div>
  );
}
