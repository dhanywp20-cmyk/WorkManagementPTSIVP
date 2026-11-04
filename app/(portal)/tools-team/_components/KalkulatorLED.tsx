'use client';
import { BarSub } from './led/panel/BarSub';
import { ModalBersama } from './led/panel/ModalBersama';
import { TampilanDaya } from './led/panel/TampilanDaya';
import { TampilanKoneksi } from './led/panel/TampilanKoneksi';
import { TampilanBanding } from './led/banding/TampilanBanding';
import { TampilanKonten } from './led/konten/TampilanKonten';
import { KartuProject } from './led/panel/KartuProject';
import { KartuSpesifikasi } from './led/panel/KartuSpesifikasi';
import { KartuHasil } from './led/panel/KartuHasil';
import { KartuHardware } from './led/panel/KartuHardware';
import { KartuBom } from './led/panel/KartuBom';
import { CatatanLED } from './led/panel/CatatanLED';
import { useKeadaanLED } from './led/useKeadaanLED';
import { useEksporLED } from './led/useEksporLED';
import type { AlatLED } from './led/panel/alat';
import type { SubLED } from './led/panel/BarSub';

export type { SubLED };

export function KalkulatorLED({ subAwal = 'led', onSub }: { subAwal?: SubLED; onSub?: (sub: SubLED) => void }) {
  const K = useKeadaanLED({ subAwal, onSub });
  const E = useEksporLED(K);
  const a: AlatLED = { K, E };

  if (K.tampilan === 'daya') return <TampilanDaya a={a} />;
  if (K.tampilan === 'koneksi') return <TampilanKoneksi a={a} />;
  if (K.tampilan === 'banding') return <TampilanBanding a={a} />;
  if (K.tampilan === 'konten') return <TampilanKonten a={a} />;

  return (
    <div className="space-y-4">
      <BarSub a={a} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
        <div className="space-y-4 min-w-0">
          <KartuProject a={a} />
          <KartuSpesifikasi a={a} />
        </div>
        <div className="space-y-4 min-w-0">
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
