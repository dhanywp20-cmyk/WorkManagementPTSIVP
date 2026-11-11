import { blokBaru, kabelBaru, perangkatBaru, ujungBaru } from './dok';
import type { DokSLD, Kabel, Perangkat } from './tipe';

type IsiP = Partial<Perangkat> & { k: string; x: number; y: number };

export function contohVoiceKamar(dibuat = ''): DokSLD {
  const p = (i: IsiP) => perangkatBaru(i.k, i.x, i.y, i);
  const halo = p({ k: 'speakerphone', x: 44, y: 34, w: 58, h: 37, no: '1', nama: 'Speakerphone HALO 80', peran: 'Mic perintah + speaker balasan', kategori: 'Audio (Mic + Speaker)',
    model: 'WyreStorm HALO 80', subGambar: 'WyreStorm · mic + speaker', ket: 'WyreStorm · 4 mic omni 360° (±5 m)\nLetakkan dekat kepala kasur\nDaya: adaptor 12 V' });
  const pc = p({ k: 'minipc', x: 140, y: 34, w: 60, h: 37, no: '2', nama: 'Mini PC Windows 11', peran: 'Server Voice Command', kategori: 'Server Voice Command',
    model: 'Mini PC Windows 11 (sesuai pengadaan)', subGambar: 'sesuai pengadaan', ket: 'CUE Voice Offline · VoiceBridge · IP tetap\ni5/i7 gen-12+ · RAM 16 GB · SSD 512 GB' });
  const panel = p({ k: 'panel', x: 42, y: 164, w: 62, h: 40, no: '5', nama: 'Touch Panel 10"', peran: 'UI kontrol kamar (cadangan selain suara)', kategori: 'User Interface',
    model: 'Panel sentuh 10" Android', ket: 'lampu 3 group · tirai · gorden · AC · TV\nDaya: PoE+ dari switch' });
  const sw = p({ k: 'switch', x: 150, y: 152.5, w: 56, h: 26.7, no: '7', nama: 'Switch Gigabit 8 Port PoE+', kategori: 'Jaringan',
    model: 'Switch Gigabit 8 port, min. 2 port PoE+', subGambar: 'sesuai pengadaan', ket: 'min. 2 port PoE+ · budget PoE ≥ 30 W' });
  const ctl = p({ k: 'controller', x: 236, y: 150, w: 64, h: 40, no: '3', nama: 'Prosesor kontrol', peran: 'Prosesor kontrol', kategori: 'Control Automation',
    model: 'Prosesor kontrol (8 port versatile)', ket: '8 port versatile · 3 serial RS-232/485 · LAN\nDaya: adaptor 24 VDC (termasuk)' });
  const r1 = p({ k: 'relay', x: 300, y: 24, w: 48, h: 30, no: '4', nama: 'Modul relay 8 #1', kategori: 'Kontrol Curtain & Gordyen', model: 'Modul relay 8 kanal 230 V',
    ket: '230 V / 10 A\nR1/R2 tirai · R3/R4 gorden' });
  const r2 = p({ k: 'relay', x: 300, y: 84, w: 48, h: 30, no: '4', nama: 'Modul relay 8 #2', kategori: 'Kontrol Curtain & Gordyen', model: 'Modul relay 8 kanal 230 V',
    ket: 'R1-R3 lampu (3 group)\nR4-R8 cadangan' });
  const tirai = p({ k: 'tirai', x: 368, y: 21, w: 44, h: 25, nama: 'Motor Tirai Jendela', ket: 'input kontak buka/tutup · interlock' });
  const gorden = p({ k: 'gorden', x: 368, y: 67, w: 44, h: 25, nama: 'Motor Gorden Pasien', ket: 'input kontak buka/tutup · interlock' });
  const lampu = p({ k: 'lampu', x: 368, y: 112, w: 44, h: 22, nama: 'Lampu Kamar - 3 Group', ket: '3 saklar · on/off lewat relay R1-R3' });
  const fcu = p({ k: 'fcu', x: 364, y: 146, w: 48, h: 28, nama: 'FCU - AC Central', peran: 'Kontrol via thermostat FCU', ket: 'Modbus RTU: on/off · fan · suhu' });
  const tv = p({ k: 'tv', x: 364, y: 209, w: 46, h: 30, no: '6', nama: 'Smart TV 43 - 65"', kategori: 'Display', model: 'TV 43 - 65 inch (sesuai pengadaan)',
    subGambar: 'sesuai pengadaan', ket: 'kontrol RS-232 / LAN\nDaya: stopkontak' });
  const k = (dari: Perangkat, ke: Perangkat, isi: Partial<Kabel>, pd = '', pk = '') =>
    ({ ...kabelBaru(dari.id, ke.id, isi), dari: ujungBaru(dari.id, pd), ke: ujungBaru(ke.id, pk) });
  const cat = { media: 'Cat6 patch', teksGaris: 'Cat6' };
  const bus = (c: Kabel, cabang: Perangkat): Kabel => ({
    ...c, dari: { ...c.dari, sisi: 'atas' }, ke: { ...c.ke, sisi: 'kiri' }, cabang: [{ ...ujungBaru(cabang.id), sisi: 'kiri' }],
  });
  const blok = {
    ...blokBaru(dibuat), proyek: 'Voice Control Kamar Pasien', lokasi: 'Contoh Rumah Sakit', sistem: 'Voice Command (jalur OFFLINE)',
    ringkas: 'Kontrol suara kamar pasien: lampu, TV, AC (FCU), tirai & gorden', lingkup: '1 kamar · speakerphone (mic + speaker) → mini PC → prosesor kontrol',
    acuan: 'BOM Voice Kamar Pasien.xlsx', acuanSingkat: 'BOM Rev1', nomor: 'CV-SLD-01', rev: 'A',
  };
  return {
    versi: 1, blok, watermark: true, kertas: 'a3', teks: [],
    perangkat: [halo, pc, panel, sw, ctl, r1, r2, tirai, gorden, lampu, fcu, tv],
    kabel: [
      k(halo, pc, { jenis: 'usb', duaArah: true, media: 'USB-A ke USB-C', teksGaris: 'USB-A ↔ USB-C', fungsi: 'Mic perintah suara + speaker balasan (satu kabel)' }, 'USB-C', 'USB-A'),
      k(pc, sw, { ...cat, fungsi: 'Layanan Voice (TCP 5001, panel 8080)', catatan: 'IP tetap' }, 'LAN'),
      k(ctl, sw, { ...cat, fungsi: 'VoiceBridge ke mini PC port 5001' }, 'LAN'),
      k(panel, sw, { media: 'Cat6 patch', teksGaris: 'Cat6 PoE+', fungsi: 'Panel sentuh + daya PoE+', catatan: 'IEEE 802.3at' }, 'LAN (PoE+)', 'port PoE+'),
      bus(k(ctl, r1, { media: 'Cat6 (RS-485)', teksGaris: 'Cat6', fungsi: 'Kontrol relay', catatan: 'Bus RS-485; alamat tiap modul relay berbeda' }, 'serial 1 (RS-485)'), r2),
      k(r1, tirai, { media: 'Cat6 (kontak relay)', teksGaris: 'Cat6', fungsi: 'Tirai jendela', catatan: 'Interlock: jangan aktifkan buka & tutup bersamaan' }, 'relay 1 & 2', 'input kontrol buka / tutup'),
      k(r1, gorden, { media: 'Cat6 (kontak relay)', teksGaris: 'Cat6', fungsi: 'Gorden pasien', catatan: 'Interlock seperti K6' }, 'relay 3 & 4', 'input kontrol buka / tutup'),
      k(r2, lampu, { jenis: 'ac', media: 'Kabel listrik (3 jalur)', teksGaris: '230 VAC · 3 jalur', fungsi: 'Lampu on/off per group', catatan: 'Maks 400 W induktif per relay' }, 'relay 1, 2, 3'),
      k(ctl, fcu, { media: 'Cat6 (RS-485 Modbus)', teksGaris: 'Cat6', fungsi: 'FCU nyala / mati · kecepatan fan · suhu', catatan: 'Bus terpisah dari K5' }, 'serial 2 (RS-485)', 'port Modbus RTU'),
      k(ctl, tv, { media: 'Cat6 (RS-232 / LAN)', teksGaris: 'Cat6', fungsi: 'TV nyala / mati / input', catatan: 'RS-232 / LAN disarankan (status terbaca)' }, 'RS-232 / LAN'),
      { ...kabelBaru('', '', { jenis: 'ac', daya: true, media: 'Kabel listrik 230 VAC', fungsi: 'Catu relay & lampu', catatan: 'Dikerjakan teknisi listrik berlisensi' }),
        dari: { ...ujungBaru(), nama: 'MCB panel listrik' }, ke: { ...ujungBaru(), nama: 'Modul relay #1, #2 & lampu 3 group' } },
    ],
    catatan: [
      { judul: 'Port VoiceBridge', isi: 'Bawaan program dan driver: TCP 5001. TCP Client di prosesor kontrol harus sama dengan nilai di program.' },
      { judul: 'Speakerphone', isi: 'Satu kabel USB-A ke USB-C untuk mic perintah dan speaker balasan. Letakkan dekat kepala kasur, jauh dari speaker TV.' },
      { judul: 'Interlock motor', isi: 'Relay buka dan tutup satu motor tidak boleh aktif bersamaan (K6, K7).' },
    ],
  };
}
