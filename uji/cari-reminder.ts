import { cariReminderByNama } from '@/lib/cari-reminder';

// Mata-mata: mencatat URL tiap kueri SETELAH pembatas lingkup diterapkan.
const url: string[] = [];
const FILTER = 'sales_name.eq."Fajar Setiawan"';

// URLSearchParams menulis spasi sebagai '+', bukan '%20'. Tanpa diseragamkan,
// tesnya menuduh kode yang sebenarnya benar.
const baca = (u: unknown) => decodeURIComponent(String(u)).replace(/\+/g, ' ');

async function jalan() {
  await cariReminderByNama('BPKP ICT', 'id, project_name, title', 15, (kueri: any) => {
    const hasil = kueri.or(FILTER);
    url.push(baca(hasil.url));
    return hasil;
  });

  let gagal = 0;
  const cek = (syarat: boolean, label: string) => {
    console.log(`${syarat ? 'OK  ' : 'GAGAL'}  ${label}`);
    if (!syarat) gagal++;
  };

  cek(url.length === 2, `Dua kueri dijalankan (project_name + title) - dapat ${url.length}`);
  cek(url.every(u => u.includes(FILTER)), 'Pembatas lingkup terpasang di SETIAP kueri');
  cek(url.some(u => u.includes('project_name=ilike.%BPKP ICT%')), 'Kueri 1 mencari project_name');
  cek(url.some(u => u.includes('title=ilike.%BPKP ICT%')),        'Kueri 2 mencari title (terpisah)');
  cek(!url.some(u => /or=\(project_name[^)]*title/.test(u)),
      'project_name dan title TIDAK lagi digabung dalam satu or()');

  console.log('\n--- URL yang terbentuk ---');
  url.forEach((u, i) => console.log(`[${i + 1}] ${u.replace('https://x.supabase.co/rest/v1/', '')}`));

  // Wildcard pada kata kunci harus dilucuti.
  const url2: string[] = [];
  await cariReminderByNama('%', 'id', 5, (k: any) => { url2.push(baca(k.url)); return k; });
  cek(url2.every(u => u.includes('\\%')), 'Karakter % pada kata kunci dilucuti, bukan jadi wildcard');
  console.log(`        ${url2[0]?.split('?')[1]}`);

  console.log(gagal === 0 ? '\nLULUS' : `\n${gagal} GAGAL`);
  process.exit(gagal ? 1 : 0);
}
jalan();
