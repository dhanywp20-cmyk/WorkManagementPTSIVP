export interface TemplatPerangkat {
  k: string;
  nama: string;
  kategori: string;
  ikon: string;
  port: string[];
  w: number; h: number;
  ket?: string;
}

export const KATALOG: TemplatPerangkat[] = [
  { k: 'speakerphone', nama: 'Speakerphone', kategori: 'Audio (Mic + Speaker)', ikon: 'speakerphone', port: ['USB-C'], w: 42, h: 26 },
  { k: 'mic', nama: 'Mikrofon plafon', kategori: 'Audio', ikon: 'mic', port: ['RJ45'], w: 34, h: 22 },
  { k: 'dsp', nama: 'Audio DSP / hub mic', kategori: 'Audio', ikon: 'amplifier', port: ['LAN', 'USB-B', 'Mic in', 'Line out'], w: 48, h: 22 },
  { k: 'amplifier', nama: 'Amplifier', kategori: 'Audio', ikon: 'amplifier', port: ['Input', 'Output speaker', 'LAN'], w: 48, h: 22 },
  { k: 'speaker', nama: 'Speaker', kategori: 'Audio', ikon: 'speaker', port: ['Input speaker'], w: 26, h: 30 },
  { k: 'minipc', nama: 'Mini PC', kategori: 'Server / PC', ikon: 'minipc', port: ['LAN', 'USB-A', 'HDMI'], w: 44, h: 28 },
  { k: 'controller', nama: 'Prosesor kontrol', kategori: 'Control Automation', ikon: 'controller', port: ['LAN', 'Serial 1 (RS-485)', 'Serial 2 (RS-485)', 'RS-232', 'IR'], w: 50, h: 32 },
  { k: 'relay', nama: 'Modul relay', kategori: 'Kontrol relay', ikon: 'relay', port: ['RS-485', 'Relay 1', 'Relay 2', 'Relay 3', 'Relay 4', 'AC in'], w: 42, h: 26 },
  { k: 'switch', nama: 'Switch jaringan', kategori: 'Jaringan', ikon: 'switch', port: ['Port 1', 'Port 2', 'Port 3', 'Port 4', 'Port PoE+'], w: 46, h: 24 },
  { k: 'panel', nama: 'Panel sentuh', kategori: 'User Interface', ikon: 'panel', port: ['LAN (PoE+)'], w: 50, h: 32 },
  { k: 'tv', nama: 'TV / display', kategori: 'Display', ikon: 'tv', port: ['HDMI', 'LAN', 'RS-232'], w: 48, h: 30 },
  { k: 'proyektor', nama: 'Proyektor', kategori: 'Display', ikon: 'proyektor', port: ['HDMI', 'LAN', 'RS-232'], w: 44, h: 26 },
  { k: 'kamera', nama: 'Kamera', kategori: 'Video Conference', ikon: 'kamera', port: ['USB', 'LAN', 'HDMI'], w: 30, h: 28 },
  { k: 'tirai', nama: 'Motor tirai', kategori: 'Beban', ikon: 'tirai', port: ['Input buka / tutup'], w: 40, h: 26 },
  { k: 'gorden', nama: 'Motor gorden', kategori: 'Beban', ikon: 'gorden', port: ['Input buka / tutup'], w: 40, h: 26 },
  { k: 'lampu', nama: 'Lampu', kategori: 'Beban', ikon: 'lampu', port: ['Group 1', 'Group 2', 'Group 3'], w: 42, h: 22 },
  { k: 'ac', nama: 'AC split', kategori: 'Beban', ikon: 'ac', port: ['IR'], w: 44, h: 22 },
  { k: 'fcu', nama: 'FCU / thermostat', kategori: 'Beban', ikon: 'fcu', port: ['Modbus RTU'], w: 48, h: 28 },
  { k: 'ups', nama: 'UPS', kategori: 'Kelistrikan', ikon: 'ups', port: ['AC in', 'AC out'], w: 22, h: 30 },
  { k: 'mcb', nama: 'MCB / panel listrik', kategori: 'Kelistrikan', ikon: 'mcb', port: ['Output'], w: 32, h: 26 },
  { k: 'rak', nama: 'Rak perangkat', kategori: 'Infrastruktur', ikon: 'rak', port: [], w: 26, h: 34 },
  { k: 'umum', nama: 'Perangkat lain', kategori: 'Lainnya', ikon: 'umum', port: [], w: 44, h: 26 },
];

export const cariTemplat = (k: string) => KATALOG.find(t => t.k === k) ?? KATALOG[KATALOG.length - 1];

const KATA_KUNCI: [RegExp, string][] = [
  [/speakerphone|halo ?\d|conference speaker/i, 'speakerphone'],
  [/mic|mikrofon/i, 'mic'],
  [/dsp|hub mic|audio processor/i, 'dsp'],
  [/amp/i, 'amplifier'],
  [/speaker|soundbar/i, 'speaker'],
  [/mini ?pc|nuc|komputer|\bpc\b|server/i, 'minipc'],
  [/relay/i, 'relay'],
  [/control|kontrol|processor|prosesor|crestron|extron ipcp|cue/i, 'controller'],
  [/switch/i, 'switch'],
  [/touch|panel sentuh|10bdl|tablet|user interface/i, 'panel'],
  [/proyektor|projector/i, 'proyektor'],
  [/\btv\b|display|monitor|videowall|layar|ifp|signage/i, 'tv'],
  [/kamera|camera|ptz/i, 'kamera'],
  [/gorden|gordyn|gordyen/i, 'gorden'],
  [/tirai|curtain|blind/i, 'tirai'],
  [/lampu|light|dimmer/i, 'lampu'],
  [/fcu|thermostat|chiller|hvac/i, 'fcu'],
  [/\bac\b|air ?con/i, 'ac'],
  [/ups/i, 'ups'],
  [/mcb|panel listrik|breaker/i, 'mcb'],
  [/rack|rak/i, 'rak'],
];

export function tebakTemplat(teks: string): string {
  for (const [pola, k] of KATA_KUNCI) if (pola.test(teks)) return k;
  return 'umum';
}
