

export interface MasukanBOM {
  satuan: 'modul' | 'cabinet'; namaLED: string;
   unit: number; screen: number;
   cadanganUnit: number;
   receivingCard: number; namaRC: string;  cadanganRC: number;
   controller: { nama: string; qty: number }[];
   controllerCadangan: boolean;
   dayaMaksW: number; psuW: number;
   port: number; portCadangan: number; panjangLAN: number;
   sirkuit: number; mcb: number; panjangPower: number;
   lebarM: number; tinggiM: number; baris: number;
}

export interface BarisBOM { kunci: string; item: string; qty: number; satuan: string; ket: string }

export const cadangan = (jumlah: number, persen: number) => (persen > 0 && jumlah > 0 ? Math.max(1, Math.ceil((jumlah * persen) / 100)) : 0);

export function bomLED(m: MasukanBOM): BarisBOM[] {
  const n = Math.max(1, m.screen);
  const modul = m.satuan === 'modul';
  const nmUnit = modul ? 'Modul' : 'Cabinet';
  const psu = modul ? Math.ceil(m.dayaMaksW / Math.max(1, m.psuW * 0.8)) : 0;
  const tiang = modul ? 0.6 : 1;
  const rangkaM = ((m.baris + 1) * m.lebarM + (Math.ceil(m.lebarM / tiang) + 1) * m.tinggiM) * n * 1.1;
  const nLAN = m.port + m.portCadangan;
  const b: BarisBOM[] = [
    { kunci: 'unit', item: `${nmUnit} LED ${m.namaLED}`.trim(), qty: m.unit, satuan: 'pcs', ket: n > 1 ? `${n} screen` : '' },
    { kunci: 'unit-cadangan', item: `${nmUnit} cadangan (spare)`, qty: cadangan(m.unit, m.cadanganUnit), satuan: 'pcs', ket: `${m.cadanganUnit}% dari ${m.unit}` },
    { kunci: 'rc', item: `Receiving card ${m.namaRC}`.trim(), qty: m.receivingCard, satuan: 'pcs', ket: '' },
    { kunci: 'rc-cadangan', item: 'Receiving card cadangan', qty: cadangan(m.receivingCard, m.cadanganRC), satuan: 'pcs', ket: `${m.cadanganRC}%` },
    ...m.controller.filter(c => c.qty > 0).map((c, i) => ({
      kunci: `ctrl-${i}`, item: c.nama, qty: c.qty * n * (m.controllerCadangan ? 2 : 1), satuan: 'unit',
      ket: m.controllerCadangan ? 'termasuk controller cadangan (hot backup)' : n > 1 ? `${c.qty} / screen` : '',
    })),
    ...(modul ? [
      { kunci: 'psu', item: `Power supply LED 5 V ${m.psuW} W`, qty: psu, satuan: 'pcs', ket: 'beban 80%' },
      { kunci: 'psu-cadangan', item: 'Power supply cadangan', qty: cadangan(psu, m.cadanganRC), satuan: 'pcs', ket: `${m.cadanganRC}%` },
    ] : []),
    { kunci: 'lan-jumper', item: 'Kabel LAN jumper antar receiving card', qty: Math.max(0, m.receivingCard - m.port), satuan: 'pcs', ket: 'pendek, CAT6' },
    { kunci: 'lan-utama', item: 'Kabel LAN controller ke layar', qty: nLAN, satuan: 'pcs',
      ket: `@ ${m.panjangLAN} m = ${Math.round(nLAN * m.panjangLAN)} m${m.portCadangan ? `, termasuk ${m.portCadangan} kabel cadangan` : ''}` },
    { kunci: 'power-jumper', item: modul ? 'Kabel power AC antar power supply' : 'Kabel power jumper antar cabinet', qty: modul ? psu : m.unit, satuan: 'pcs', ket: '' },
    { kunci: 'power-utama', item: 'Kabel power sirkuit ke panel', qty: m.sirkuit, satuan: 'jalur', ket: `@ ${m.panjangPower} m = ${Math.round(m.sirkuit * m.panjangPower)} m` },
    { kunci: 'mcb', item: `MCB ${m.mcb} A per sirkuit`, qty: m.sirkuit, satuan: 'pcs', ket: '' },
    { kunci: 'rangka', item: 'Rangka besi hollow 40×40', qty: Math.ceil(rangkaM / 6), satuan: 'batang 6 m', ket: `±${Math.round(rangkaM)} m (estimasi)` },
  ];
  return b.filter(x => x.qty > 0);
}

export function totalPenawaran(baris: { kunci: string; qty: number }[], harga: Record<string, number>, ppnPersen: number) {
  const subtotal = baris.reduce((a, x) => a + x.qty * Math.max(0, harga[x.kunci] ?? 0), 0);
  const ppn = Math.round((subtotal * Math.max(0, ppnPersen)) / 100);
  return { subtotal, ppn, total: subtotal + ppn };
}
