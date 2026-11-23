export type BagianTeks =
  | { jenis: 'judul'; isi: string }
  | { jenis: 'poin'; butir: string[] }
  | { jenis: 'nomor'; butir: string[] }
  | { jenis: 'teks'; isi: string };

const POLA_POIN = /^\s*[-•*]\s+(.*)$/;
const POLA_NOMOR = /^\s*\d{1,2}[.)]\s+(.*)$/;

function adalahJudul(baris: string): boolean {
  const t = baris.trim().replace(/&amp;/g, '&');
  return t.length >= 3 && t.length <= 40 && /[A-Z]{3}/.test(t) && /^[A-Z0-9 &/()-]+$/.test(t);
}

export function uraikanPenanganan(teks: string): BagianTeks[] {
  const hasil: BagianTeks[] = [];
  for (const baris of teks.replace(/\r\n/g, '\n').split('\n')) {
    const akhir = hasil[hasil.length - 1];
    const poin = baris.match(POLA_POIN);
    const nomor = poin ? null : baris.match(POLA_NOMOR);
    if (poin) {
      if (akhir?.jenis === 'poin') akhir.butir.push(poin[1]);
      else hasil.push({ jenis: 'poin', butir: [poin[1]] });
    } else if (nomor) {
      if (akhir?.jenis === 'nomor') akhir.butir.push(nomor[1]);
      else hasil.push({ jenis: 'nomor', butir: [nomor[1]] });
    } else if (adalahJudul(baris)) {
      hasil.push({ jenis: 'judul', isi: baris.trim() });
    } else if (baris.trim()) {
      if (akhir?.jenis === 'teks') akhir.isi += `\n${baris}`;
      else hasil.push({ jenis: 'teks', isi: baris });
    }
  }
  return hasil;
}

export function htmlPenanganan(teksAman: string, ukuran: number): string {
  const gayaDaftar = `margin:2px 0 0;padding-left:18px;font-size:${ukuran}px;line-height:1.55`;
  return uraikanPenanganan(teksAman).map(b => {
    if (b.jenis === 'judul') return `<div style="font-size:${ukuran - 2}px;font-weight:800;letter-spacing:.06em;color:#1d4ed8;margin-top:6px">${b.isi}</div>`;
    if (b.jenis === 'poin') return `<ul style="${gayaDaftar}">${b.butir.map(x => `<li>${x}</li>`).join('')}</ul>`;
    if (b.jenis === 'nomor') return `<ol style="${gayaDaftar}">${b.butir.map(x => `<li>${x}</li>`).join('')}</ol>`;
    return `<div style="font-size:${ukuran}px;line-height:1.6;white-space:pre-wrap;margin-top:2px">${b.isi}</div>`;
  }).join('');
}
