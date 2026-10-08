'use client';
/** Sub menu Power Connection. */
import { bukaCetak, namaBerkas, unduhLembarPNG } from '../../bersama/cetak';
import { TombolSalin } from '../../bersama/ui';
import { RuangDaya } from '../daya/RuangDaya';
import { BarSub } from './BarSub';
import { KartuLayar } from './KartuLayar';
import { ModalBersama } from './ModalBersama';
import type { AlatLED } from './alat';

export function TampilanDaya({ a }: { a: AlatLED }) {
  const { customer, dataDaya, dayaLED, labelLED, project, setDayaLED } = a.K;
  const { lembarDaya, namaFile, teksDaya } = a.E;
  return (
    <>
      <div className="space-y-4">
        <BarSub a={a} />
        <KartuLayar a={a} judul="Power Connection"><TombolSalin key="salin" teks={teksDaya} onCetak={() => bukaCetak(lembarDaya())}
          onPng={() => unduhLembarPNG(lembarDaya(), namaBerkas('Power Connection', labelLED, project, customer))} /></KartuLayar>
        <RuangDaya d={dataDaya} s={dayaLED} onUbah={setDayaLED} namaFile={namaFile} />
        <ModalBersama a={a} />
      </div>
    </>
  );
}
