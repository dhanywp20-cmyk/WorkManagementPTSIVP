'use client';
import { TombolSalin } from '../../bersama/ui';
import { RuangKoneksi } from '../koneksi/RuangKoneksi';
import { BarSub } from './BarSub';
import { KartuLayar } from './KartuLayar';
import { ModalBersama } from './ModalBersama';
import type { AlatLED } from './alat';

export function TampilanKoneksi({ a }: { a: AlatLED }) {
  const { layarKoneksi, pisahKartu, setPisahKartu, ubahKoneksiLayar } = a.K;
  const { cetakKoneksi, namaFile, pngKoneksi, teksKoneksi } = a.E;
  return (
    <>
      <div className="space-y-4">
        <BarSub a={a} />
        <KartuLayar a={a} judul="Screen Connection"><TombolSalin key="salin" teks={teksKoneksi} onCetak={cetakKoneksi} onPng={pngKoneksi} /></KartuLayar>
        <RuangKoneksi layar={layarKoneksi} onUbah={ubahKoneksiLayar} pisahKartu={pisahKartu} onPisahKartu={setPisahKartu} namaFile={namaFile} />
        <ModalBersama a={a} />
      </div>
    </>
  );
}
