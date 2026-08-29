/*
  UJI: SEMUA nama yang muncul di Tabel 1 (Summary) harus tercatat di rekap
  per orang - termasuk yang seluruh proyeknya masih "belum input" nominal.

  Bug nyata dari laporan: "semua nama juga di summary total nominalnya bukan
  hanya nominal project!" - beberapa nama (mis. yang HANYA muncul di proyek
  ber-status "belum input") diam-diam tidak pernah tercantum sama sekali di
  rekap Total Incentive Per Orang, karena rekap itu dibangun murni dari
  `akumulasi`, dan `akumulasi` sengaja hanya mencatat proyek yang final
  (nominal & mode sudah diisi).

  Perbaikannya memisahkan dua peta: `semuaNama` (siapa saja yang muncul,
  apa pun status nominal proyeknya) dan `akumulasi` (uang sungguhan, hanya
  dari proyek final). Nama yang ada di `semuaNama` tapi tidak di `akumulasi`
  tetap ditambahkan ke rekap dengan total Rp 0 dan ditandai `belumFinal`.

    node uji/semua-nama-rekap.mjs
*/

let lulus = 0, gagal = 0;
function ok(nama, syarat, ket = '') {
  if (syarat) { lulus++; console.log(`  ok    ${nama}`); }
  else { gagal++; console.log(`  GAGAL ${nama}${ket ? ' — ' + ket : ''}`); }
}

// Meniru persis logika di exportSummaryIncentive.
function bangunRekap(proyekList) {
  const semuaNama = new Map();
  const akumulasi = [];

  for (const p of proyekList) {
    for (const s of p.splits) {
      const peranOrang = semuaNama.get(s.nama) ?? new Set();
      peranOrang.add(s.peran);
      semuaNama.set(s.nama, peranOrang);
    }
    if (!p.isEstimate && p.bastDate) {
      for (const s of p.splits) {
        akumulasi.push({ nama: s.nama, peran: s.peran, jumlah: s.jumlah, bastYear: new Date(p.bastDate).getFullYear() });
      }
    }
  }

  const perOrang = new Map();
  for (const { nama, peran, jumlah } of akumulasi) {
    const e = perOrang.get(nama) ?? { nama, peran: new Set(), total: 0 };
    e.peran.add(peran); e.total += jumlah;
    perOrang.set(nama, e);
  }
  const namaBelumFinal = new Set();
  for (const [nama, peranSet] of semuaNama) {
    if (perOrang.has(nama)) continue;
    perOrang.set(nama, { nama, peran: new Set(peranSet), total: 0 });
    namaBelumFinal.add(nama);
  }
  return { perOrang, namaBelumFinal };
}

console.log('\n1. Kasus nyata dari laporan: sebagian project "belum input"');
{
  const proyek = [
    // Final - masuk akumulasi
    { bastDate: '2026-02-09', isEstimate: false, splits: [
      { nama: 'Yoga KS', peran: 'pic', jumlah: 550_000 },
      { nama: 'Dhany Wahyu', peran: 'manager', jumlah: 450_000 },
    ]},
    // "belum input" - TIDAK masuk akumulasi, tapi orangnya tetap tercatat
    { bastDate: null, isEstimate: true, splits: [
      { nama: 'Ferdinan Agustinus', peran: 'pic', jumlah: 550_000 }, // pool contoh, BUKAN uang sungguhan
      { nama: 'Dhany Wahyu', peran: 'manager', jumlah: 450_000 },
    ]},
    { bastDate: null, isEstimate: true, splits: [
      { nama: 'Taufik wahyudi', peran: 'supervisor', jumlah: 300_000 },
    ]},
  ];

  const { perOrang, namaBelumFinal } = bangunRekap(proyek);

  ok('Yoga KS (punya project final) tercatat', perOrang.has('Yoga KS'));
  ok('Yoga KS total = uang sungguhan dari project final', perOrang.get('Yoga KS').total === 550_000);

  ok('Ferdinan Agustinus TETAP tercatat walau seluruh projectnya "belum input"',
    perOrang.has('Ferdinan Agustinus'));
  ok('Ferdinan Agustinus total Rp 0 - BUKAN pool contoh 550.000', perOrang.get('Ferdinan Agustinus').total === 0);
  ok('Ferdinan Agustinus ditandai belumFinal', namaBelumFinal.has('Ferdinan Agustinus'));

  ok('Taufik wahyudi (hanya di project belum-input) juga tetap tercatat', perOrang.has('Taufik wahyudi'));
  ok('Taufik wahyudi total Rp 0', perOrang.get('Taufik wahyudi').total === 0);

  //  Dhany muncul di KEDUA jenis project - hanya project final yang dihitung.
  ok('Dhany Wahyu (muncul di project final DAN belum-input) tidak dobel',
    perOrang.get('Dhany Wahyu').total === 450_000);
  ok('Dhany Wahyu TIDAK ditandai belumFinal - dia sudah punya project final',
    !namaBelumFinal.has('Dhany Wahyu'));

  ok('Jumlah nama di rekap = jumlah nama unik di seluruh Tabel 1 (4 orang)', perOrang.size === 4);
}

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : 'ADA GAGAL'} — ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
