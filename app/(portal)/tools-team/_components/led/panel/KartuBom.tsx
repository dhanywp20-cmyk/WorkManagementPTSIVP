'use client';
/** Kartu daftar material (BOM) & penawaran dengan harga satuan. */
import { bukaCetak, namaBerkas, unduhLembarPNG } from '../../bersama/cetak';
import { Angka, Catatan, Kartu, TombolSalin } from '../../bersama/ui';
import { TabelBom } from '../../bersama/TabelBom';
import type { AlatLED } from './alat';

export function KartuBom({ a }: { a: AlatLED }) {
  const { adaHarga, barisBom, bom, customer, hanyaLihat, harga, labelLED, namaUnit, nilaiPenawaran, project, satuan, setBom, setHarga } = a.K;
  const { lembarBom, teksBom } = a.E;
  return (
    <>
      <Kartu judul={adaHarga ? 'Daftar material & penawaran' : 'Daftar material (BOM)'}
        aksi={<TombolSalin teks={teksBom} onCetak={() => bukaCetak(lembarBom())} onPng={() => unduhLembarPNG(lembarBom(), namaBerkas(adaHarga ? 'Penawaran LED' : 'BOM LED', labelLED, project, customer))} />}>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-3">
          <Angka label={`Spare ${namaUnit}`} nilai={bom.cadanganUnit} satuan="%" step={0.5} onUbah={v => v >= 0 && v <= 50 && setBom({ ...bom, cadanganUnit: v })} />
          <Angka label="Spare RC & PSU" nilai={bom.cadanganRC} satuan="%" step={0.5} onUbah={v => v >= 0 && v <= 50 && setBom({ ...bom, cadanganRC: v })} />
          {satuan === 'modul' && namaUnit === 'modul' && <Angka label="Power supply" nilai={bom.psuW} satuan="W" step={10} onUbah={v => v >= 50 && v <= 1000 && setBom({ ...bom, psuW: v })} />}
          <Angka label="Kabel LAN ke layar" nilai={bom.panjangLAN} satuan="m" onUbah={v => v >= 1 && setBom({ ...bom, panjangLAN: v })} />
          <Angka label="PPN" nilai={bom.ppn} satuan="%" onUbah={v => v >= 0 && v <= 30 && setBom({ ...bom, ppn: v })} />
        </div>
        <TabelBom baris={barisBom} harga={harga} setHarga={setHarga} ppn={bom.ppn} nilai={nilaiPenawaran} />
        <Catatan>Receiving card & port dari Screen Connection, sirkuit & MCB dari Power Connection. Isi harga satuan untuk membuat lembar penawaran (harga ikut tersimpan bersama hitungan{hanyaLihat ? '' : ' saat Simpan'}).</Catatan>
      </Kartu>
    </>
  );
}
