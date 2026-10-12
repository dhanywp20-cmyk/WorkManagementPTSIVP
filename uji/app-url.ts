/**
 * uji/app-url.ts - tautan untuk orang lain tidak boleh membawa domain Preview Vercel.
 *
 * Bug 12 Okt 2026: link checklist tim & link "lihat saja" Project Progress yang disalin saat
 * menguji di Preview membawa domain `...-git-...vercel.app`, yang dikunci login Vercel - tim luar
 * terlempar ke halaman login ("link jadi private"). Sama halnya link di pesan WA.
 *
 * Jalankan: npm test -- app-url
 */
import { readFileSync } from 'fs';
import { adalahPreviewVercel } from '../lib/app-url';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

console.log('\n1. Mengenali domain Preview Vercel');
cek('preview cabang (-git-)', adalahPreviewVercel('work-management-ptsivp-git-claude-719ded-dhany-wahyus-projects.vercel.app'));
cek('deployment unik (hash 9 karakter)', adalahPreviewVercel('work-management-ptsivp-a1b2c3d4e-dhany-wahyus-projects.vercel.app'));
cek('domain produksi BUKAN preview', !adalahPreviewVercel('work-management-ptsivp.vercel.app'));
cek('custom domain pembeli BUKAN preview', !adalahPreviewVercel('wm.perusahaan.co.id'));
cek('localhost BUKAN preview', !adalahPreviewVercel('localhost'));

console.log('\n2. Semua pembuat link untuk orang lain memakai appBaseUrl');
const sumber: Record<string, string> = {
  'lib/checklist.ts (link tim isi checklist)': 'lib/checklist.ts',
  'ModalShare (link lihat saja)': 'app/(portal)/project-progress/_components/ModalShare.tsx',
  'ReminderDetailPopup (.ics)': 'app/(portal)/reminder-schedule/_components/ReminderDetailPopup.tsx',
  'modal-kode-acara (link daftar)': 'app/(portal)/dashboard/_components/modal-kode-acara.tsx',
};
for (const [nama, f] of Object.entries(sumber)) {
  const t = readFileSync(f, 'utf8');
  cek(`${nama} memakai appBaseUrl`, /appBaseUrl\(\)/.test(t));
  cek(`${nama} tidak lagi memakai location.origin untuk link`, !/(window\.)?location\.origin\}?\/(checklist|project-progress|reminder-schedule)/.test(t) && !/setAsalUrl\(window\.location\.origin\)/.test(t));
}

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
