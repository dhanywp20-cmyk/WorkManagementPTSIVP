'use client';
import { DialogBerkas } from '../../bersama/berkas/DialogBerkas';
import { useBukaDariTautan } from '../useBukaDariTautan';
import { EditorReferensiLED } from '../referensi/EditorReferensiLED';
import type { AlatLED } from './alat';

export function ModalBersama({ a }: { a: AlatLED }) {
  const { berkas, bukaRef, refLED, setBukaRef } = a.K;
  useBukaDariTautan(berkas);
  return (
    <>
      <EditorReferensiLED {...refLED} buka={bukaRef} onTutup={() => setBukaRef(false)} />
      <DialogBerkas b={berkas} />
    </>
  );
}
