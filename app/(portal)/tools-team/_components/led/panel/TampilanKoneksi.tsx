'use client';
/** Sub menu Screen Connection. */
import { TombolSalin } from '../../bersama/ui';
import { RuangKoneksi } from '../koneksi/RuangKoneksi';
import { BarSub } from './BarSub';
import { KartuLayar } from './KartuLayar';
import { ModalBersama } from './ModalBersama';
import type { AlatLED } from './alat';

export function TampilanKoneksi({ a }: { a: AlatLED }) {
  const { dataKoneksi, koneksi, setKoneksi } = a.K;
  const { cetakKoneksi, namaFile, pngKoneksi, teksKoneksi } = a.E;
  return (
    <>
      <div className="space-y-4">
        <BarSub a={a} />
        <KartuLayar a={a} judul="Screen Connection"><TombolSalin key="salin" teks={teksKoneksi} onCetak={cetakKoneksi} onPng={pngKoneksi} /></KartuLayar>
        <RuangKoneksi d={dataKoneksi} s={koneksi} onUbah={setKoneksi} namaFile={namaFile} />
        <ModalBersama a={a} />
      </div>
    </>
  );
}
