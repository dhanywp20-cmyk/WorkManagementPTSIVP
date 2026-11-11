export interface FotoProduk { src: string; rasio: number; label: string }

const f = (nama: string, w: number, h: number, label: string): FotoProduk => ({ src: `/sld/produk/${nama}.jpg`, rasio: w / h, label });

export const FOTO_PRODUK: Record<string, FotoProduk> = {
  'tcl-tv': f('tcl-tv', 583, 350, 'TCL C8K'),
  'philips-55bdl4650d': f('philips-55bdl4650d', 640, 369, 'Philips 55BDL4650D'),
  'philips-10bdl3351t': f('philips-10bdl3351t', 640, 402, 'Philips 10BDL3351T'),
  'panasonic-proyektor': f('panasonic-proyektor', 640, 335, 'Panasonic PT-MZ882'),
  'mx-0404-scl': f('mx-0404-scl', 428, 194, 'WyreStorm MX-0404-SCL'),
  'mx-0402-mst': f('mx-0402-mst', 428, 177, 'WyreStorm MX-0402-MST v2'),
  'ex-70-h2': f('ex-70-h2', 428, 212, 'WyreStorm EX-70-H2'),
  'nhd-120-tx': f('nhd-120-tx', 428, 184, 'WyreStorm NHD-120-TX'),
  'halo-80': f('halo-80', 307, 299, 'WyreStorm HALO 80'),
  'apo-vx20': f('apo-vx20', 428, 309, 'WyreStorm APO-VX20-UC v2'),
  'apo-sky-mic': f('apo-sky-mic', 346, 346, 'WyreStorm APO-SKY-MIC'),
  'cam-210-ptz': f('cam-210-ptz', 287, 329, 'WyreStorm CAM-210-PTZ'),
  'dsp-88-dnt': f('dsp-88-dnt', 428, 175, 'WyreStorm DSP-88-DNT'),
  'amp-2120': f('amp-2120', 428, 242, 'WyreStorm AMP-2120'),
  'netgear-m4250': f('netgear-m4250', 428, 229, 'Netgear M4250'),
  controlcue: f('controlcue', 640, 324, 'CUE controlCUE-versatile'),
  relaycue: f('relaycue', 640, 424, 'CUE relayCUE-8'),
  'asus-nuc': f('asus-nuc', 294, 123, 'ASUS NUC'),
  brightsign: f('brightsign', 269, 174, 'BrightSign HD6'),
  'hikvision-nvr': f('hikvision-nvr', 640, 165, 'Hikvision DS-7608NI-Q2'),
};

export const POLA_FOTO_PRODUK = /^\/sld\/produk\/[a-z0-9-]+\.jpg$/;
export const fotoSah = (v: unknown): v is string => typeof v === 'string' && POLA_FOTO_PRODUK.test(v);
