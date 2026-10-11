/**
 * Fixture Product Comparison: isi PDF contoh owner (LG 22SM3G-B vs DigiSIGN DSN-LAD-015, EN) - data datasheet
 * publik, tidak sensitif. Dipakai uji/perbandingan.ts untuk memeriksa struktur & kemiripan dengan template.
 */
import type { KartuBanding, NilaiSpek } from '../../lib/perbandingan';

const a = (teks: string, unggul = false): NilaiSpek => ({ teks, status: 'ada', ...(unggul ? { unggul } : {}), bukti: { kutipan: teks } });
const x: NilaiSpek = { teks: '', status: 'tidak-disebut' };

export const CONTOH: KartuBanding = {
  bahasa: 'en',
  kategori: 'Product Comparison — Compact Display 22"',
  judul: 'LG 22SM3G-B vs DigiSIGN DSN-LAD-015',
  pengantar: 'This document compares the technical specifications of the LG 22SM3G-B (22" Standard Signage) against the DigiSIGN DSN-LAD-015 (22" Lift Display) based on each vendor\'s official datasheet and publications — covering panel & display, operating system & CMS, connectivity, physical build, and certification & after-sales support, as a reference for PT Indovisual Group in selecting the most suitable compact-area display solution (lift, counter, waiting area) for client needs.',
  produk: [
    { merek: 'LG Information Display', nama: 'LG 22SM3G-B', judulKartu: '22SM3G-B — Standard Signage 22"', deskripsi: 'Full HD digital signage powered by the webOS 4.0 smart signage platform, embedded CMS, Quad Core SoC, and the SuperSign management ecosystem — backed by LG\'s official service network in Indonesia.' },
    { merek: 'DigiSIGN', nama: 'DigiSIGN DSN-LAD-015', judulKartu: 'DSN-LAD-015 — Lift Display 22"', deskripsi: 'A display built specifically for lift/elevator interiors with a slim, button-free design, 3M-tape installation, a 180° IPS panel, and an Android-based platform running the DigiSign Play cloud CMS.' },
  ],
  bagian: [
    { judul: 'Panel & Display', baris: [
      { spesifikasi: 'Screen Size', nilai: [a('21.5" (22" class)'), a('22"')] },
      { spesifikasi: 'Resolution', nilai: [a('1,920 x 1,080 (Full HD)', true), x] },
      { spesifikasi: 'Panel', nilai: [a('IPS'), a('IPS')] },
      { spesifikasi: 'Brightness', nilai: [a('250 cd/m²', true), x] },
      { spesifikasi: 'Contrast Ratio', nilai: [a('1,000:1', true), x] },
      { spesifikasi: 'Viewing Angle', nilai: [a('178° / 178°'), a('180°')] },
      { spesifikasi: 'Response Time', nilai: [a('14 ms (G to G)', true), x] },
      { spesifikasi: 'Refresh Rate', nilai: [a('60 Hz', true), x] },
      { spesifikasi: 'Panel Life Time (Min.)', nilai: [a('30,000 hrs', true), x] },
      { spesifikasi: 'Duty Rating', nilai: [a('16/7', true), x] },
    ] },
    { judul: 'Operating System, CMS & Content Management', baris: [
      { spesifikasi: 'Platform / OS', nilai: [a('webOS 4.0 Smart Signage', true), a('Android (built-in)')] },
      { spesifikasi: 'Processor', nilai: [a('Quad Core SoC', true), x] },
      { spesifikasi: 'Additional Media Player', nilai: [a('Not required (already embedded)', true), a('Not required (already embedded)')] },
      { spesifikasi: 'Content CMS', nilai: [a('Embedded CMS + SuperSign CMS (offline/online, scheduling, group manager)', true), a('DigiSign Play — cloud-based CMS')] },
      { spesifikasi: 'Content Update', nilai: [a('USB Plug & Play, LAN, WiFi'), a('WiFi (cloud, real-time)')] },
      { spesifikasi: 'Fleet Monitoring & Control', nilai: [a('SuperSign Control / Control+, Control Manager, SNMP', true), x] },
      { spesifikasi: 'Cloud After-Sales Service', nilai: [a('Signage365 Care (optional)', true), x] },
      { spesifikasi: 'Display Features', nilai: [a('PIP, PBP (2), Screen Share, Play via URL, Fail Over', true), a('Split Screen')] },
      { spesifikasi: 'Power Management', nilai: [a('Smart Energy Saving, PM Mode, Wake on LAN', true), a('Smart Power Management')] },
      { spesifikasi: 'Room / AV Control Integration', nilai: [a('Crestron Connected®, RS232C, HDMI-CEC', true), x] },
    ] },
    { judul: 'Connectivity, Physical Build & Installation', baris: [
      { spesifikasi: 'Input Ports', nilai: [a('HDMI (2, HDCP2.2), USB 2.0, Audio In', true), x] },
      { spesifikasi: 'External Control', nilai: [a('RS232C, RJ45 (LAN), IR In', true), x] },
      { spesifikasi: 'Wireless Connectivity', nilai: [a('Built-in Wi-Fi'), a('Built-in WiFi')] },
      { spesifikasi: 'Speaker', nilai: [a('1 W x 2 (built-in)', true), x] },
      { spesifikasi: 'Design & Bezel', nilai: [a('Even bezel 16.3 mm, black'), a('Slim, no external physical buttons')] },
      { spesifikasi: 'Unit Dimensions (W x H x D)', nilai: [a('510.3 x 302.1 x 53.8 mm', true), x] },
      { spesifikasi: 'Unit Weight', nilai: [a('3.34 kg', true), x] },
      { spesifikasi: 'Mounting Method', nilai: [a('VESA 100 x 100 mm (universal standard mount)', true), a('3M tape (adhesive, lift-wall specific)')] },
      { spesifikasi: 'Power Consumption (Typ.)', nilai: [a('30 W (Smart Energy Saving: 15 W)', true), x] },
    ] },
    { judul: 'Certification, Warranty & Support', baris: [
      { spesifikasi: 'EMC Certification', nilai: [a('FCC Class "A" / CE', true), x] },
      { spesifikasi: 'Safety Certification', nilai: [a('CB / NRTL', true), x] },
      { spesifikasi: 'Energy Standard', nilai: [a('ErP / Energy Star (EU)', true), x] },
    ] },
  ],
  ringkasan: 'On paper, the **LG 22SM3G-B** leads in almost every officially comparable aspect — from complete panel specifications (brightness, contrast ratio, response time, panel life time), its software ecosystem (webOS + SuperSign CMS + Control Manager), professional-grade connectivity (HDMI HDCP2.2, RS232C, Crestron Connected®), to fully documented international certifications. The DigiSIGN DSN-LAD-015 is a niche product purpose-built for tight lift interiors with easy 3M-tape installation, but most of its core technical parameters (resolution, brightness, dimensions, certification) are not officially published by the vendor, making it difficult to verify equivalence with commercial display standards.',
  sorotan: [
    { judul: 'Verified Quality & Reliability', teks: 'A certified IPS panel with a 30,000-hour life time, along with measurable contrast ratio and response time — suited for 16/7 operation without the risk of rapid image-quality degradation.' },
    { judul: 'Ecosystem & AV Integration', teks: 'webOS + SuperSign + Crestron Connected® simplify integration with room control systems and centralized, multi-site content management — aligning with PT Indovisual\'s AV system integration business line.' },
    { judul: 'After-Sales & Unit Availability', teks: 'Backed by LG\'s official network and spare-part stock through PT Indovisual Group, compared to a local niche product with more limited distribution coverage and technical documentation.' },
  ],
  rekomendasi: 'For compact-area display needs (lift, counter, lobby, waiting area) that demand long-term reliability, complete technical documentation, and easy integration with after-sales support, the **LG 22SM3G-B** is the more appropriate and safer choice to offer clients — both in terms of product quality and after-sales backing from PT Indovisual Group as LG Information Display\'s official partner in Indonesia.',
  catatan: 'LG 22SM3G-B specifications are taken from LG Information Display\'s official datasheet. DigiSIGN DSN-LAD-015 specifications are taken from publicly available official publications by the DigiSIGN distributor; parameters not disclosed by the vendor are marked "Not officially published" and should be confirmed directly with the principal before being used as the basis for a competitive quotation.',
};
