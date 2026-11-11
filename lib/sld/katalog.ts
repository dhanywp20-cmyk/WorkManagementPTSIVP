export type KelompokKatalog = 'display' | 'middleware' | 'sumber' | 'audio' | 'kontrol' | 'listrik';

export const LABEL_KELOMPOK: Record<KelompokKatalog, string> = {
  display: 'Display', middleware: 'Middleware (WyreStorm, LED & videowall)', sumber: 'Sumber input', audio: 'Audio & konferensi',
  kontrol: 'Kontrol & jaringan', listrik: 'Kelistrikan & beban',
};
export const URUTAN_KELOMPOK: KelompokKatalog[] = ['display', 'middleware', 'sumber', 'audio', 'kontrol', 'listrik'];

export interface TemplatPerangkat {
  k: string;
  nama: string;
  kategori: string;
  kelompok: KelompokKatalog;
  ikon: string;
  port: string[];
  w: number; h: number;
  ket?: string;
  saran?: string[];
  foto?: string;
}

const PHILIPS_BDL = [
  'Philips 32BDL4650D', 'Philips 43BDL4650D', 'Philips 50BDL4650D', 'Philips 55BDL4650D', 'Philips 65BDL4650D', 'Philips 75BDL4650D', 'Philips 86BDL4650D',
  'Philips 43BDL5050D', 'Philips 55BDL5050D', 'Philips 65BDL5050D', 'Philips 75BDL5050D', 'Philips 86BDL5050D',
  'Philips 43BDL3650Q', 'Philips 55BDL3650Q', 'Philips 65BDL3650Q', 'Philips 75BDL3650Q', 'Philips 86BDL3650Q',
  'Philips 43BDL4050Q', 'Philips 55BDL4050Q', 'Philips 65BDL4050Q', 'Philips 43BDL3117P', 'Philips 55BDL3117P', 'Philips 65BDL3117P',
  'Philips 55BDL6017P', 'Philips 43BDL2050A', 'Philips 55BDL2050A',
];
const TCL = ['TCL 43" Smart TV', 'TCL 50" Smart TV', 'TCL 55" Smart TV', 'TCL 65" Smart TV', 'TCL 75" Smart TV', 'TCL 85" Smart TV', 'TCL 98" Smart TV'];
const W = 'WyreStorm';
const ws = (...m: string[]) => m.map(x => `${W} ${x}`);

export const KATALOG: TemplatPerangkat[] = [
  { k: 'tv-tcl', foto: 'tcl-tv', nama: 'TV TCL', kategori: 'Display', kelompok: 'display', ikon: 'tv', port: ['HDMI 1', 'HDMI 2', 'HDMI 3', 'LAN', 'USB', 'RS-232'], w: 48, h: 30, saran: TCL },
  { k: 'signage-philips', foto: 'philips-55bdl4650d', nama: 'Philips Signage BDL', kategori: 'Display', kelompok: 'display', ikon: 'signage',
    port: ['HDMI 1', 'HDMI 2', 'DisplayPort', 'LAN (RJ45)', 'RS-232', 'IR in', 'USB'], w: 48, h: 30, saran: PHILIPS_BDL },
  { k: 'panel', foto: 'philips-10bdl3351t', nama: 'Panel sentuh 10"', kategori: 'User Interface', kelompok: 'display', ikon: 'panel', port: ['LAN (PoE+)', 'USB'], w: 42, h: 26,
    saran: ['Philips 10BDL3351T'] },
  { k: 'ifp', foto: 'ifp', nama: 'Interactive display (IFP)', kategori: 'Display', kelompok: 'display', ikon: 'panel',
    port: ['HDMI in 1', 'HDMI in 2', 'USB-C', 'USB touch', 'LAN', 'OPS slot'], w: 44, h: 43,
    saran: ['Interactive flat panel 65"', 'Interactive flat panel 75"', 'Interactive flat panel 86"'] },
  { k: 'videowall', nama: 'Videowall', kategori: 'Display', kelompok: 'display', ikon: 'videowall', port: ['HDMI in', 'DP out (loop)', 'LAN', 'RS-232'], w: 56, h: 28,
    ket: 'Susunan 3 x 2 · panel 55" bezel tipis', saran: ['Philips 55BDL2105X', 'Philips 49BDL2105X'] },
  { k: 'led', nama: 'LED Display', kategori: 'Display', kelompok: 'display', ikon: 'led', port: ['Ethernet in (dari sending box)', 'Ethernet loop', 'AC in'], w: 60, h: 30,
    ket: 'Ukuran 4 x 2,25 m · pitch P2.5', saran: ['LED indoor P1.5', 'LED indoor P1.8', 'LED indoor P2.5', 'LED indoor P3.9', 'LED outdoor P4', 'LED outdoor P6', 'LED outdoor P10'] },
  { k: 'proyektor', foto: 'panasonic-proyektor', nama: 'Proyektor', kategori: 'Display', kelompok: 'display', ikon: 'proyektor', port: ['HDMI', 'HDBaseT', 'LAN', 'RS-232'], w: 44, h: 27.5 },
  { k: 'layar-motor', foto: 'elite-layar-motor', nama: 'Layar proyektor motorized', kategori: 'Display / Layar proyektor', kelompok: 'display', ikon: 'layar',
    port: ['AC in', 'Trigger 12 V', 'RS-485 / IR'], w: 40, h: 31,
    saran: ['Elite Screens Evanesce Tension B', 'Elite Screens Spectrum', 'Elite Screens VMAX2', 'Screenview motorized', 'Screenview motorized tab-tension'] },
  { k: 'layar-frame', foto: 'elite-layar-frame', nama: 'Layar proyektor fixed frame', kategori: 'Display / Layar proyektor', kelompok: 'display', ikon: 'layar',
    port: [], w: 40, h: 34, saran: ['Elite Screens Sable Frame B2', 'Elite Screens Aeon CLR', 'Screenview fixed frame'] },

  { k: 'matrix', foto: 'mx-0404-scl', nama: 'Matrix switcher', kategori: 'Middleware / Switching', kelompok: 'middleware', ikon: 'matrix',
    port: ['HDMI in 1', 'HDMI in 2', 'HDMI in 3', 'HDMI in 4', 'HDBT out 1', 'HDBT out 2', 'HDMI out 1', 'HDMI out 2', 'LAN', 'RS-232', 'IR'], w: 58, h: 36,
    saran: ws('MX-0404-SCL', 'MX-0404-HDMI', 'MX-0808-H2A-MK2', 'MX-0808-SCL-V2', 'MX-0812-SCL', 'MX-1616-SCL', 'MXV-0404-H2A-KIT v2', 'MXV-0808-H2A-70 v3',
      'MXV-0808-H2A-KIT', 'EXP-MX-0402-H2') },
  { k: 'presentasi', foto: 'mx-0402-mst', nama: 'Presentation switcher', kategori: 'Middleware / Switching', kelompok: 'middleware', ikon: 'switcher',
    port: ['USB-C', 'HDMI in 1', 'HDMI in 2', 'HDBT out', 'HDMI out', 'USB host', 'LAN'], w: 46, h: 29,
    saran: ws('MX-0402-MST v2', 'MX-0403-H3-MST', 'MX-0804-EDC', 'MX-1007-HYB', 'SW-510-TX', 'SW-120-TX3', 'SW-620-TX-W') },
  { k: 'extender', foto: 'ex-70-h2', nama: 'Extender HDBaseT TX/RX', kategori: 'Middleware / Extender', kelompok: 'middleware', ikon: 'extender',
    port: ['HDMI in', 'HDBaseT', 'HDMI out', 'IR', 'RS-232'], w: 52, h: 32.5,
    saran: ws('EX-35-H2', 'EX-70-H2', 'EX-70-G2', 'EX-100-G2', 'EX-35-8K', 'RX-70-4K', 'RXV-70-4K-G2', 'RX3-100') },
  { k: 'avoip', foto: 'nhd-120-tx', nama: 'AV over IP encoder / decoder', kategori: 'Middleware / AV over IP', kelompok: 'middleware', ikon: 'encoder',
    port: ['HDMI', 'LAN (1G)', 'USB', 'IR', 'RS-232'], w: 44, h: 27.5,
    saran: ws('NHD-120-TX', 'NHD-120-RX', 'NHD-124-TX', 'NHD-150-RX', 'NHD-510-TX', 'NHD-500-TX/RX v2', 'NHD-600-E-TX/RX', 'NHD-0401-MV', 'NHD-CTL-PRO v2') },
  { k: 'dongle', foto: 'dongle-wireless', nama: 'Dongle wireless presentation', kategori: 'Middleware / Wireless presentation', kelompok: 'middleware',
    ikon: 'extender', port: ['USB-C / USB-A (ke laptop)', 'Wireless (ke base unit)'], w: 14, h: 28,
    saran: ['Dongle USB-C wireless presentation', 'Dongle USB-A wireless presentation'] },
  { k: 'wallplate', foto: 'wyrestorm-wallplate', nama: 'Wallplate transmitter (HDMI + USB-C)', kategori: 'Middleware / Extender', kelompok: 'middleware', ikon: 'extender',
    port: ['HDMI in', 'USB-C in', 'Line in', 'USB host', 'HDBaseT out'], w: 30, h: 29 },
  { k: 'sending-box', foto: 'novastar-mctrl660-pro', nama: 'Sending box LED', kategori: 'Middleware / LED controller', kelompok: 'middleware', ikon: 'matrix',
    port: ['HDMI in', 'DVI in', 'DVI loop', 'Ethernet out 1', 'Ethernet out 2', 'Ethernet out 3', 'Ethernet out 4', 'USB (kontrol)', 'Audio in'], w: 64, h: 10,
    saran: ['NovaStar MCTRL300', 'NovaStar MCTRL600', 'NovaStar MCTRL660', 'NovaStar MCTRL660 PRO', 'NovaStar MCTRL700', 'NovaStar MSD300', 'NovaStar VX400',
      'NovaStar VX600', 'NovaStar VX1000', 'NovaStar TB60 (Taurus)'] },
  { k: 'videoprocessor', foto: 'pontus-vwc', nama: 'Video processor / videowall controller', kategori: 'Middleware / Video processor', kelompok: 'middleware',
    ikon: 'matrix', port: ['HDMI in 1', 'HDMI in 2', 'HDMI in 3', 'HDMI in 4', 'HDMI out 1', 'HDMI out 2', 'HDMI out 3', 'HDMI out 4', 'LAN', 'RS-232'], w: 52, h: 18,
    saran: ['Pontus video wall controller', 'Tricolor video processor', 'NovaStar VX1000', 'NovaStar H2', 'NovaStar H5'] },

  { k: 'laptop', nama: 'Laptop', kategori: 'Sumber input', kelompok: 'sumber', ikon: 'laptop', port: ['HDMI', 'USB-C', 'USB-A', 'LAN'], w: 42, h: 26 },
  { k: 'pc', nama: 'PC', kategori: 'Sumber input', kelompok: 'sumber', ikon: 'pc', port: ['HDMI', 'DisplayPort', 'USB', 'LAN'], w: 36, h: 22.5 },
  { k: 'minipc', foto: 'asus-nuc', nama: 'Mini PC', kategori: 'Sumber input', kelompok: 'sumber', ikon: 'minipc', port: ['LAN', 'USB-A', 'USB-C', 'HDMI'], w: 40, h: 25 },
  { k: 'nvr', foto: 'hikvision-nvr', nama: 'NVR CCTV', kategori: 'Sumber input', kelompok: 'sumber', ikon: 'nvr', port: ['HDMI', 'VGA', 'LAN', 'PoE (kamera)', 'USB'], w: 48, h: 30 },
  { k: 'kamera', foto: 'cam-210-ptz', nama: 'Kamera PTZ', kategori: 'Sumber input', kelompok: 'sumber', ikon: 'kamera', port: ['HDMI', 'USB', 'LAN (PoE)', 'RS-232'], w: 34, h: 21.25,
    saran: ws('CAM-210-PTZ', 'CAM-210-NDI-PTZ', 'CAM-420-PTZ', 'FOCUS 200 PRO') },
  { k: 'mediaplayer', foto: 'brightsign', nama: 'Media player digital signage', kategori: 'Sumber input', kelompok: 'sumber', ikon: 'mediaplayer', port: ['HDMI', 'LAN', 'USB'], w: 40, h: 25 },

  { k: 'speakerphone', foto: 'halo-80', nama: 'Speakerphone', kategori: 'Audio (Mic + Speaker)', kelompok: 'audio', ikon: 'speakerphone', port: ['USB-C'], w: 42, h: 26.25,
    saran: ws('HALO 80', 'APO-210-UC') },
  { k: 'speakerphone-aver', foto: 'aver-speakerphone', nama: 'Speakerphone AVer', kategori: 'Audio (Mic + Speaker)', kelompok: 'audio', ikon: 'speakerphone',
    port: ['USB', 'Bluetooth'], w: 42, h: 24, saran: ['AVer FONE540', 'AVer FONE700'] },
  { k: 'videobar', foto: 'apo-vx20', nama: 'Video bar', kategori: 'Video Conference', kelompok: 'audio', ikon: 'videobar', port: ['USB-C', 'HDMI in', 'HDMI out', 'LAN'], w: 50, h: 31.25,
    saran: ws('APO-VX20-UC v2', 'HALO-VX10 v2') },
  { k: 'mic', foto: 'apo-sky-mic', nama: 'Mikrofon plafon', kategori: 'Audio', kelompok: 'audio', ikon: 'mic', port: ['RJ45 / USB'], w: 36, h: 22.5, saran: ws('APO-SKY-MIC', 'HALO-COM-MIC') },
  { k: 'dsp', foto: 'dsp-88-dnt', nama: 'Audio DSP / hub mic', kategori: 'Audio', kelompok: 'audio', ikon: 'dsp', port: ['LAN', 'USB-B', 'Mic in', 'Line out', 'Dante'], w: 50, h: 31.25 },
  { k: 'amplifier', foto: 'amp-2120', nama: 'Amplifier', kategori: 'Audio', kelompok: 'audio', ikon: 'amplifier', port: ['Input', 'Output speaker', 'LAN'], w: 50, h: 31.25 },
  { k: 'speaker', foto: 'fonestar-speaker-dinding', nama: 'Speaker dinding', kategori: 'Audio', kelompok: 'audio', ikon: 'speaker', port: ['Input speaker (100 V / 8 Ω)'], w: 26, h: 30 },
  { k: 'speaker-plafon', foto: 'fonestar-speaker-plafon', nama: 'Speaker plafon', kategori: 'Audio', kelompok: 'audio', ikon: 'speaker', port: ['Input speaker (100 V / 8 Ω)'], w: 32, h: 24 },
  { k: 'speaker-pa', foto: 'neo-8', nama: 'Speaker PA full range', kategori: 'Audio', kelompok: 'audio', ikon: 'speaker', port: ['Speakon in', 'Speakon link'], w: 18, h: 32,
    saran: ['NEO-8'] },
  { k: 'mic-array', foto: 'mic-array-plafon', nama: 'Mic array plafon (tile)', kategori: 'Audio', kelompok: 'audio', ikon: 'mic', port: ['LAN / Dante (PoE)'], w: 40, h: 21 },
  { k: 'mic-handheld', foto: 'sennheiser-md42', nama: 'Mic handheld (kabel)', kategori: 'Audio', kelompok: 'audio', ikon: 'mic', port: ['XLR'], w: 16, h: 30,
    saran: ['Sennheiser MD 42', 'Sennheiser e835', 'Shure SM58'] },
  { k: 'receiver-wireless', foto: 'receiver-mic-wireless', nama: 'Receiver mic wireless', kategori: 'Audio', kelompok: 'audio', ikon: 'dsp',
    port: ['Antena A', 'Antena B', 'Audio out (XLR)', 'Mix out'], w: 50, h: 23 },
  { k: 'mic-konferensi', foto: 'fonestar-mic-konferensi', nama: 'Mic konferensi (chairman / delegate)', kategori: 'Konferensi', kelompok: 'audio', ikon: 'mic',
    port: ['Sistem in', 'Sistem loop'], w: 24, h: 34 },
  { k: 'sentral-konferensi', foto: 'fonestar-sci-750', nama: 'Unit sentral konferensi wireless', kategori: 'Konferensi', kelompok: 'audio', ikon: 'dsp',
    port: ['Antena', 'Line out', 'Rec out', 'USB', 'AC in'], w: 52, h: 26, saran: ['Fonestar SCI-750'] },
  { k: 'paperless', foto: 'paperless-mic', nama: 'Terminal paperless + mic', kategori: 'Konferensi', kelompok: 'audio', ikon: 'panel', port: ['LAN (PoE)', 'Mic', 'USB'], w: 30, h: 36 },
  { k: 'paperless-tricolor', foto: 'tricolor-terminal', nama: 'Terminal paperless Tricolor', kategori: 'Konferensi', kelompok: 'audio', ikon: 'panel',
    port: ['LAN (PoE)', 'USB', 'HDMI'], w: 40, h: 31 },
  { k: 'monitor-lift', foto: 'monitor-lift-mic', nama: 'Monitor lift motorized + mic', kategori: 'Konferensi', kelompok: 'audio', ikon: 'panel',
    port: ['HDMI in', 'LAN', 'Mic', 'AC in', 'Kontrol naik / turun'], w: 48, h: 28 },

  { k: 'controller', foto: 'controlcue', nama: 'Prosesor kontrol', kategori: 'Control Automation', kelompok: 'kontrol', ikon: 'controller',
    port: ['LAN', 'Serial 1 (RS-485)', 'Serial 2 (RS-485)', 'RS-232', 'IR', 'Relay'], w: 48, h: 30, saran: [...ws('SYN-CTL-FL10'), 'CUE controlCUE-versatile (CS0475)'] },
  { k: 'relay', foto: 'relaycue', nama: 'Modul relay', kategori: 'Kontrol relay', kelompok: 'kontrol', ikon: 'relay', port: ['RS-485', 'Relay 1', 'Relay 2', 'Relay 3', 'Relay 4', 'AC in'], w: 42, h: 26.25,
    saran: ['CUE relayCUE-8 (CS0335-2, 230 V)'] },
  { k: 'switch', foto: 'netgear-m4250', nama: 'Switch jaringan', kategori: 'Jaringan', kelompok: 'kontrol', ikon: 'switch', port: ['Port 1', 'Port 2', 'Port 3', 'Port 4', 'Port PoE+', 'SFP uplink'], w: 52, h: 32.5,
    saran: ['Netgear M4250-GSM4230PX-26P', 'Netgear M4250-GSM4248PX-40P'] },
  { k: 'rak', nama: 'Rak perangkat', kategori: 'Infrastruktur', kelompok: 'kontrol', ikon: 'rak', port: [], w: 30, h: 18.75 },

  { k: 'ups', nama: 'UPS', kategori: 'Kelistrikan', kelompok: 'listrik', ikon: 'ups', port: ['AC in', 'AC out'], w: 30, h: 18.75 },
  { k: 'mcb', nama: 'MCB / panel listrik', kategori: 'Kelistrikan', kelompok: 'listrik', ikon: 'mcb', port: ['Output'], w: 36, h: 22.5 },
  { k: 'tirai', nama: 'Motor tirai', kategori: 'Beban', kelompok: 'listrik', ikon: 'tirai', port: ['Input buka / tutup'], w: 42, h: 26.25 },
  { k: 'gorden', nama: 'Motor gorden', kategori: 'Beban', kelompok: 'listrik', ikon: 'gorden', port: ['Input buka / tutup'], w: 42, h: 26.25 },
  { k: 'lampu', nama: 'Lampu', kategori: 'Beban', kelompok: 'listrik', ikon: 'lampu', port: ['Group 1', 'Group 2', 'Group 3'], w: 42, h: 26.25 },
  { k: 'ac', nama: 'AC split', kategori: 'Beban', kelompok: 'listrik', ikon: 'ac', port: ['IR'], w: 44, h: 27.5 },
  { k: 'fcu', nama: 'FCU / thermostat', kategori: 'Beban', kelompok: 'listrik', ikon: 'fcu', port: ['Modbus RTU'], w: 48, h: 30 },
  { k: 'umum', nama: 'Perangkat lain', kategori: 'Lainnya', kelompok: 'listrik', ikon: 'umum', port: [], w: 44, h: 27.5 },
];

const LAMA: Record<string, string> = { tv: 'tv-tcl' };
export const cariTemplat = (k: string) => KATALOG.find(t => t.k === (LAMA[k] ?? k)) ?? KATALOG[KATALOG.length - 1];
export const templatIkon = (ikon: string) => KATALOG.find(t => t.ikon === ikon);

const KATA_KUNCI: [RegExp, string][] = [
  [/\bBDL\b|\d{2}BDL\d|philips.*(signage|display)|signage display/i, 'signage-philips'],
  [/10BDL|touch ?panel|panel sentuh|user interface/i, 'panel'],
  [/monitor lift|lift monitor|pop-?up (monitor|display)|motori[sz]ed (monitor|lift)/i, 'monitor-lift'],
  [/video ?processor|video ?wall controller|pontus/i, 'videoprocessor'],
  [/tricolor/i, 'paperless-tricolor'],
  [/paperless/i, 'paperless'],
  [/novastar|sending ?(box|card)|\bMCTRL|\bMSD\d|\bVX\d{3,4}\b|taurus/i, 'sending-box'],
  [/interactive|\bifp\b|flat panel|smart ?board/i, 'ifp'],
  [/videowall|video wall/i, 'videowall'],
  [/\bLED\b(?! ?(tv|monitor|lamp|lampu))|videotron/i, 'led'],
  [/motori[sz]ed|electric screen|tab.?tension|layar (proyektor |projector )?motor/i, 'layar-motor'],
  [/fixed (frame )?screen|frame screen|sable frame|layar (proyektor |projector )?(fixed|frame)/i, 'layar-frame'],
  [/projection screen|projector screen|layar (proyektor|projector)/i, 'layar-motor'],
  [/\bMXV?-\d{4}|matrix/i, 'matrix'],
  [/dongle|clickshare|wireless (presentation|screen ?shar)/i, 'dongle'],
  [/wall ?plate|-TX-W\b/i, 'wallplate'],
  [/MX-0\d0\d-(MST|EDC)|MX-1007|SW-\d{3}|presentation|switcher/i, 'presentasi'],
  [/\bNHD-|av over ip|encoder|decoder/i, 'avoip'],
  [/\bEXF?-\d|\bRXV?3?-\d|hdbase|extender/i, 'extender'],
  [/video ?bar|APO-VX|HALO-VX/i, 'videobar'],
  [/\bAVer\b|\bFONE ?\d/i, 'speakerphone-aver'],
  [/speakerphone|halo ?\d|APO-210/i, 'speakerphone'],
  [/SCI-\d|wireless conference|conference system|sentral konferensi/i, 'sentral-konferensi'],
  [/delegate|chairman|mic(rophone)? konferensi|conference mic/i, 'mic-konferensi'],
  [/receiver|wireless mic|mic wireless/i, 'receiver-wireless'],
  [/mic(rophone)? array|array mic|ceiling (tile )?mic/i, 'mic-array'],
  [/handheld|\bMD ?\d{2}\b|mic (kabel|genggam)|dynamic mic/i, 'mic-handheld'],
  [/ceiling speaker|in-?ceiling|speaker (plafon|ceiling)/i, 'speaker-plafon'],
  [/\bNEO-?\d|full ?range|speaker (pa|aktif|active)|column speaker|line array/i, 'speaker-pa'],
  [/CAM-|kamera|camera|ptz|webcam/i, 'kamera'],
  [/\bnvr\b|cctv|dvr/i, 'nvr'],
  [/media ?player|signage player|brightsign/i, 'mediaplayer'],
  [/laptop|notebook/i, 'laptop'],
  [/mini ?pc|nuc/i, 'minipc'],
  [/\bpc\b|komputer|desktop|server/i, 'pc'],
  [/mic|mikrofon/i, 'mic'],
  [/dsp|hub mic|audio processor/i, 'dsp'],
  [/amp/i, 'amplifier'],
  [/speaker|soundbar/i, 'speaker'],
  [/relay/i, 'relay'],
  [/control|kontrol|processor|prosesor|SYN-CTL|cue/i, 'controller'],
  [/switch|netgear|jaringan/i, 'switch'],
  [/proyektor|projector/i, 'proyektor'],
  [/\btcl\b|\btv\b|display|monitor|layar|ifp/i, 'tv-tcl'],
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
