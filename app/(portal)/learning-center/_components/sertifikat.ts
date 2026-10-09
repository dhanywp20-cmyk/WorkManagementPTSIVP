/**
 * Sertifikat Learning Center: kanvas A4 mendatar (2480 × 1754 px) -> PNG atau dicetak.
 * Aturan berhak & nomor: lib/sertifikat.ts. Nama perusahaan dari pengaturan merek.
 */
import { merek } from '@/lib/merek';
import { nomorSertifikat, ringkasJudul, tanggalSertifikat, type AttemptSertifikat } from '@/lib/sertifikat';
import { namaBerkas, unduhKanvasPNG } from '@/lib/lembar-cetak';

export interface DataSertifikat { nama: string; sesi: string; materi?: string | null; passing?: number | null; attempt: AttemptSertifikat }

const W = 2480, H = 1754;
const NAVY = '#13294b', EMAS = '#b8892b';

function gambar(d: DataSertifikat): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  //  Latar krem lembut + bingkai ganda navy & emas.
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#fffdf7'); bg.addColorStop(1, '#f7f1e3');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = NAVY; g.lineWidth = 26; g.strokeRect(70, 70, W - 140, H - 140);
  g.strokeStyle = EMAS; g.lineWidth = 6; g.strokeRect(120, 120, W - 240, H - 240);
  //  Ornamen sudut.
  g.fillStyle = EMAS;
  for (const [x, y] of [[120, 120], [W - 120, 120], [120, H - 120], [W - 120, H - 120]]) { g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.fill(); }

  const tengah = (teks: string, y: number, font: string, warna: string, jarak = 0) => {
    g.font = font; g.fillStyle = warna; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if (jarak) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${jarak}px`;
    g.fillText(teks, W / 2, y);
    if (jarak) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  };
  const m = merek();
  tengah((m.namaPerusahaan || m.namaPlatform).toUpperCase(), 330, '600 46px Georgia, serif', EMAS, 10);
  tengah('SERTIFIKAT', 520, 'bold 170px Georgia, "Times New Roman", serif', NAVY, 24);
  tengah('LEARNING CENTER', 610, '600 50px Georgia, serif', NAVY, 14);
  tengah('diberikan kepada', 760, 'italic 52px Georgia, serif', '#475569');
  tengah(ringkasJudul(d.nama, 40), 920, 'bold 120px Georgia, "Times New Roman", serif', '#0f172a');
  g.strokeStyle = EMAS; g.lineWidth = 4; g.beginPath(); g.moveTo(W / 2 - 620, 960); g.lineTo(W / 2 + 620, 960); g.stroke();
  tengah('atas keberhasilannya menyelesaikan kuis', 1070, '48px Georgia, serif', '#475569');
  tengah(ringkasJudul(d.sesi), 1170, 'bold 70px Georgia, serif', NAVY);
  if (d.materi) tengah(ringkasJudul(`Materi: ${d.materi}`, 80), 1250, '44px Georgia, serif', '#475569');
  tengah(`Nilai ${Math.round(d.attempt.score ?? 0)}${d.passing ? `  ·  Passing ${d.passing}%` : ''}`, 1340, 'bold 54px Georgia, serif', '#047857');

  //  Kaki: tanggal (kiri), nomor (kanan), tanda tangan (tengah).
  g.textAlign = 'left'; g.fillStyle = '#334155'; g.font = '40px Georgia, serif';
  g.fillText(tanggalSertifikat(d.attempt.submitted_at), 260, 1560);
  g.textAlign = 'right'; g.fillText(`No. ${nomorSertifikat(d.attempt)}`, W - 260, 1560);
  g.strokeStyle = '#334155'; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2 - 300, 1520); g.lineTo(W / 2 + 300, 1520); g.stroke();
  tengah('Admin Learning Center', 1580, '600 40px Georgia, serif', '#334155');
  return c;
}

export function unduhSertifikat(d: DataSertifikat): Promise<void> {
  return unduhKanvasPNG(gambar(d), namaBerkas('Sertifikat', d.nama, d.sesi));
}

export function cetakSertifikat(d: DataSertifikat) {
  const url = gambar(d).toDataURL('image/png');
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sertifikat</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0}img{width:100%;height:auto;display:block}</style></head><body><img src="${url}" alt="Sertifikat"></body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}
