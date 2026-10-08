/** Teks ringkasan & bagian lembar cetak Power Connection. */
import { esc, type Seksi } from '../../bersama/cetak';
import { f } from '../../bersama/ui';
import { type DataDaya, type PengaturanDaya, susunDaya } from './data';
import { svgDaya } from './svg';

export const teksCara = (s: PengaturanDaya) => `${s.fase === 3 ? '3 fase' : '1 fase'}, MCB ${s.mcb} A/sirkuit, beban maks ${s.beban}%, kabel ${s.arah === 'vertikal' ? 'tegak per kolom' : 'mendatar per baris'} pola ${s.pola}`;

/** Ringkasan untuk Salin/WA. */
export function ringkasanDaya(d: DataDaya, s: PengaturanDaya): string {
  const h = susunDaya(d, s);
  return [
    `Power connection: ${h.sirkuit.length} sirkuit · ${teksCara(s)}`,
    `Total ${f(h.totalW / 1000)} kW maks @${d.tegangan} V · maks ${h.unitPerSirkuitMaks} ${d.satuan}/sirkuit (${f(h.kapasitasW, 0)} W)`,
    ...h.perFase.map(p => `- Fase ${p.fase}: ${p.sirkuit} sirkuit, ${f(p.watt / 1000)} kW, ${f(p.arus, 1)} A → MCB utama ${p.mcb} A`),
    ...h.sirkuit.map(c => `  C${c.no} (${c.fase}): ${c.unit} ${d.satuan}, ${f(c.watt, 0)} W, ${f(c.arus, 1)} A`),
    h.galat ?? '',
  ].filter(Boolean).join('\n');
}

/** Seksi lembar cetak: diagram + tabel sirkuit & fase. */
export function seksiCetakDaya(d: DataDaya, s: PengaturanDaya): Seksi[] {
  const h = susunDaya(d, s);
  return [
    { judul: 'Power connection (urutan kabel power per sirkuit)', jenis: 'html',
      html: `<div class="diagram">${svgDaya(d, h, s.arah)}<p style="margin:6px 0 0;font-size:11px;color:#475569">${esc(teksCara(s))} · C = sirkuit, huruf = fase</p>${h.galat ? `<p style="margin:4px 0 0;font-size:11px;color:#b91c1c">${esc(h.galat)}</p>` : ''}</div>` },
    { judul: 'Beban per fase & MCB utama', jenis: 'tabel', kepala: ['Fase', 'Sirkuit', 'Daya maks', 'Arus', 'MCB utama'], rataKanan: [1, 2, 3, 4],
      isi: h.perFase.map(p => [p.fase, String(p.sirkuit), `${f(p.watt / 1000)} kW`, `${f(p.arus, 1)} A`, `${p.mcb} A`]) },
    { judul: 'Pembagian sirkuit', jenis: 'tabel', kepala: ['Sirkuit', 'Fase', d.satuan === 'modul' ? 'Modul' : 'Cabinet', 'Daya maks', 'Arus', 'Masuk di'], rataKanan: [2, 3, 4],
      isi: h.sirkuit.map(c => [`C${c.no} · MCB ${s.mcb} A`, c.fase, String(c.unit), `${f(c.watt, 0)} W`, `${f(c.arus, 1)} A`, c.mulai ? `kolom ${c.mulai.c + 1}, baris ${c.mulai.r + 1}` : '—']) },
  ];
}
