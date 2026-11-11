import type { JenisKabel } from './tipe';

export interface PresetKabel { k: string; l: string; jenis: JenisKabel; teks: string; media: string; daya?: boolean; duaArah?: boolean }

export const PRESET_KABEL: PresetKabel[] = [
  { k: 'cat6', l: 'Cat6 (LAN)', jenis: 'catx', teks: 'Cat6', media: 'Cat6 patch' },
  { k: 'cat6-poe', l: 'Cat6 PoE+', jenis: 'catx', teks: 'Cat6 PoE+', media: 'Cat6 patch (PoE+)' },
  { k: 'hdbt', l: 'HDBaseT', jenis: 'catx', teks: 'HDBaseT', media: 'Cat6 STP (HDBaseT)' },
  { k: 'rs485', l: 'RS-485', jenis: 'catx', teks: 'RS-485', media: 'Cat6 (RS-485)' },
  { k: 'rs232', l: 'RS-232', jenis: 'lain', teks: 'RS-232', media: 'Kabel serial RS-232' },
  { k: 'hdmi', l: 'HDMI', jenis: 'hdmi', teks: 'HDMI', media: 'Kabel HDMI' },
  { k: 'usb', l: 'USB', jenis: 'usb', teks: 'USB', media: 'Kabel USB' },
  { k: 'usb-c', l: 'USB-C', jenis: 'usb', teks: 'USB-C', media: 'Kabel USB-C', duaArah: true },
  { k: 'audio', l: 'Audio', jenis: 'audio', teks: 'Audio', media: 'Kabel audio balanced' },
  { k: 'speaker', l: 'Speaker', jenis: 'speaker', teks: 'Speaker', media: 'Kabel speaker 2 x 1,5 mm²' },
  { k: 'fiber', l: 'Fiber optik', jenis: 'fiber', teks: 'Fiber', media: 'Fiber optik' },
  { k: 'ir', l: 'IR emitter', jenis: 'ir', teks: 'IR', media: 'Kabel IR emitter' },
  { k: 'ac', l: '230 VAC', jenis: 'ac', teks: '230 VAC', media: 'Kabel listrik 230 VAC' },
  { k: 'dc', l: 'DC / adaptor', jenis: 'dc', teks: 'DC', media: 'Adaptor DC' },
];

export const presetKabel = (k: string | null | undefined) => PRESET_KABEL.find(p => p.k === k) ?? PRESET_KABEL[0];

export const isiPreset = (p: PresetKabel) => ({ jenis: p.jenis, teksGaris: p.teks, media: p.media, daya: !!p.daya, duaArah: !!p.duaArah });
