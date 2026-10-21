/**
 * uji/pola-persetujuan.ts - SATU pola Setujui / Tolak / Tugaskan di semua menu (components/shared/Persetujuan.tsx).
 *
 * Dulu tiap menu merakit sendiri: kepala modal bergradasi beda warna, label "Approve"/"Setujui",
 * "Reject"/"Tolak", "Assign To"/"Assign ke"/"Assign ke Handler"/"Assign Tim", sebagian berawalan emoji.
 * Uji ini menjaga supaya tidak menyimpang lagi.
 *
 * Jalankan: npm test -- pola-persetujuan
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

let lulus = 0, gagal = 0;
const cek = (n: string, s: boolean, ket = '') => { if (s) { lulus++; console.log(`  ok   ${n}`); } else { gagal++; console.log(`  GAGAL ${n}${ket ? ' - ' + ket : ''}`); } };
const baca = (f: string) => readFileSync(f, 'utf8');

function semuaTsx(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? semuaTsx(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

console.log('\n1. Komponen bersama');
const pola = baca('components/shared/Persetujuan.tsx');
cek('label baku Setujui / Tolak / Tugaskan ke', /setujui: 'Setujui'/.test(pola) && /tolak: 'Tolak'/.test(pola) && /tugaskan: 'Tugaskan ke'/.test(pola));
cek('ModalTolak: tombol Tolak mati bila alasan kosong', /disabled=\{sibuk \|\| !rapi\}/.test(pola));
cek('Setujui = tombol utama (warna merek), Tolak = bahaya', /jenis="utama" onClick=\{onSetujui\}/.test(pola) && /jenis="bahaya" onClick=\{\(\) => onTolak\(rapi\)\}/.test(pola));
cek('diekspor lewat components/shared', /ModalSetujui, ModalTolak/.test(baca('components/shared/index.ts')));

console.log('\n2. Semua menu memakai pola yang sama');
const MEMAKAI: Record<string, RegExp> = {
  'ticketing/_components/SimpleActionModals.tsx': /ModalTolak/,
  'ticketing/_components/ApprovalModal.tsx': /TombolSetujui/,
  'ticketing/_components/AssignApprovalModals.tsx': /ModalSetujui/,
  'ticketing/_components/TicketDetailPopup.tsx': /TombolTugaskan/,
  'reminder-schedule/_components/ApproveAssignModals.tsx': /PilihPenugasan/,
  'reminder-schedule/_components/RejectReasonModal.tsx': /ModalTolak/,
  'reminder-schedule/_components/PopupRingkas.tsx': /ModalSetujui/,
  'reminder-schedule/_components/ReminderDetailPopup.tsx': /TombolSetujui/,
  'form-require-project/_components/Modals-AssignPTSModal.tsx': /PilihPenugasan/,
  'form-require-project/_components/ModalApproveInternal.tsx': /ModalSetujui/,
  'form-require-project/_components/halaman/ModalTolakRequest.tsx': /ModalTolak/,
  'form-require-project/_components/detail/HeaderDetail.tsx': /TombolSetujui/,
  'tech-note/_components/ModalDetailNote.tsx': /TombolSetujui/,
  'dashboard/_components/akun/TabAkunTertunda.tsx': /TombolTolak/,
  'tools-team/_components/ProductComparison.tsx': /ModalTolak/,
};
for (const [f, re] of Object.entries(MEMAKAI)) cek(f, re.test(baca(`app/(portal)/${f}`)));

console.log('\n3. Tidak ada label & gaya lama di tombol');
const berkas = semuaTsx('app/(portal)');
const LABEL_LAMA = /<(?:button|TombolModal)[^>]*>\s*(?:<[^>]+\/>)?\s*(?:Approve|Reject|Assign(?: ke| To| Tim)?)\b/;
const salah = berkas.filter(f => LABEL_LAMA.test(baca(f)));
cek('tidak ada tombol berlabel Approve / Reject / Assign', salah.length === 0, salah.join(', '));
const labelForm = berkas.filter(f => />(?:Assign To|Assign ke)\s*\*?<\/label>/.test(baca(f)));
cek('tidak ada label isian "Assign To" / "Assign ke"', labelForm.length === 0, labelForm.join(', '));
//  Popup detail (Ticket / Reminder) masih punya tombol aksi lain (reschedule, dst) - kerangkanya ikut langkah migrasi modal.
const gradasi = Object.keys(MEMAKAI).filter(f => !/DetailPopup/.test(f)).filter(f => /linear-gradient\(135deg,#(?:16a34a|f59e0b|dc2626|db2777)/.test(baca(`app/(portal)/${f}`)));
cek('popup persetujuan tidak lagi berkepala gradasi hijau/kuning/merah/merah muda sendiri', gradasi.length === 0, gradasi.join(', '));
cek('tidak ada window.confirm di Perbandingan Produk', !/window\.confirm/.test(baca('app/(portal)/tools-team/_components/ProductComparison.tsx')));

console.log(`\n${gagal ? 'GAGAL' : 'OK'}: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
