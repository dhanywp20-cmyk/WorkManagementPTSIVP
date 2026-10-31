/**
 * uji/notif-manager-lewati-review.ts
 *
 *  1. Request Design Project BARU dari sales membuat notifikasi in-app untuk admin + pemegang Full Access
 *     (Manager PTS IVP) - dulu hanya WA, sehingga lonceng Manager kosong. Penerimanya ditentukan
 *     access_level = 'full', BUKAN jabatan Manager (Manager PTS UMP orang luar tidak boleh ikut).
 *  2. Admin / Full Access bisa menyetujui langsung request yang masih menunggu review Sales Internal
 *     (Request Schedule & Design Project), dan tahap review ditutup saat itu.
 *
 * Jalankan: npx tsx uji/notif-manager-lewati-review.ts
 */
import { readFileSync } from 'fs';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}
const baca = (p: string) => readFileSync(p, 'utf8');

console.log('\n1. Notifikasi request design baru');
const kirim = baca('app/(portal)/form-require-project/_components/useKirimRequest.ts');
cek('admin + Full Access dapat badge in-app (createNotificationForAdmins)', /createNotificationForAdmins\(\{[\s\S]*?Request design baru menunggu approval/.test(kirim));
cek('Sales Internal reviewer dapat badge in-app', /createNotification\(\{ \.\.\.notifRef, user_id: h\.id/.test(kirim));
cek('id reviewer ikut dimuat', /select\('id, full_name, phone_number'\)/.test(kirim));
const penerima = baca('lib/penerima-admin.ts');
cek('penerima admin = role admin ATAU access_level full', /SARING_PENERIMA_ADMIN = 'role\.in\.\(admin,superadmin\),access_level\.eq\.full'/.test(penerima));
cek('penerima admin TIDAK disaring dengan jabatan', !/\.eq\('jabatan'|jabatan\.eq\./.test(penerima));
const notif = baca('lib/notifications.ts');
cek('createNotificationForAdmins memakai penerimaAdmin()', /createNotificationForAdmins[\s\S]*?await penerimaAdmin\(\)/.test(notif));

console.log('\n2. Admin / Full Access melewati review Sales Internal');
for (const f of ['ReminderListBody', 'ReminderDetailPopup']) {
  const s = baca(`app/(portal)/reminder-schedule/_components/${f}.tsx`);
  cek(`${f}: bolehLewatiReview = admin || Full Access`, /const bolehLewatiReview = isAdmin \|\| hasFullAccess\(currentUser as never\);/.test(s));
  cek(`${f}: tombol approve tidak lagi terkunci internal_review untuk mereka`, /routing_status !== 'internal_review' \|\| bolehLewatiReview\)/.test(s));
}
const header = baca('app/(portal)/form-require-project/_components/detail/HeaderDetail.tsx');
cek('Design detail: Setujui tampil untuk bisaKelolaRequest tanpa kunci internal_review', /\{bisaKelolaRequest && detailIsPending && \(/.test(header));
const halaman = baca('app/(portal)/form-require-project/page.tsx');
cek('Design daftar: Setujui tanpa kunci internal_review', /\{bisaKelolaRequest && req\.status === 'pending' && \(/.test(halaman));
cek('bisaKelolaRequest = admin/superadmin/Full Access (bukan jabatan)', /const bisaKelolaRequest = isAdmin \|\| isSuperAdmin \|\| hasFullAccess\(/.test(halaman));
const assign = baca('app/(portal)/form-require-project/_components/Modals-AssignPTSModal.tsx');
cek('Design assign langsung menutup tahap internal_review', /const lewatiReview = req\.routing_status === 'internal_review';\s*if \(lewatiReview\) updatePayload\.routing_status = null;/.test(assign));
const jadwal = baca('app/(portal)/reminder-schedule/_components/usePersetujuanAdmin.ts');
cek('Schedule approve menutup routing (routing_status: null)', /routing_status: null/.test(jadwal));

console.log(`\n${gagal ? 'GAGAL' : 'LULUS'}: ${lulus} lulus, ${gagal} gagal`);
if (gagal) process.exit(1);
