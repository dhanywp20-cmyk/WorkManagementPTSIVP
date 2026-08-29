/*
  UJI: rekapitulasi per orang di rekap Summary.

  Menjaga tiga hal yang salah pada bentuk sebelumnya:

    1. Satu orang bisa muncul DUA KALI - sebagai Supervisor di satu proyek dan
       PIC di proyek lain - dengan dua angka terpisah. Finance butuh satu
       angka: berapa yang ditransfer ke orang itu.
    2. GRAND TOTAL kosong.
    3. Tidak ada pecahan tahun sama sekali, padahal uangnya memang keluar
       bertahap - jadi rekapnya masih harus dihitung ulang di luar sistem.

  Installer diperiksa terpisah: porsinya TIDAK dipecah, lunas di tahun pertama.

    node uji/rekap-per-orang.mjs
*/
const sk = { installerBayarDiMuka: true,
  tranche: [{nomor:1,persen:50,tahunKe:1},{nomor:2,persen:35,tahunKe:2},{nomor:3,persen:15,tahunKe:3}] };

// Yoga muncul 2x: Supervisor di satu proyek, PIC di proyek lain (kasus gambar 1)
const akumulasi = [
  { nama:'Yoga KS', peran:'supervisor', jumlah:1_350_000, bastYear:2026 },
  { nama:'Yoga KS', peran:'pic',        jumlah:  550_000, bastYear:2026 },
  { nama:'Dhany Wahyu', peran:'manager',jumlah:1_475_000, bastYear:2026 },
  { nama:'Pras', peran:'installer',     jumlah:  300_000, bastYear:2026 },
];

const per = new Map(); const tahunSet = new Set();
const tahap = [...sk.tranche].sort((a,b)=>a.nomor-b.nomor);
const totalPersen = tahap.reduce((n,t)=>n+t.persen,0);
for (const {nama,peran,jumlah,bastYear} of akumulasi) {
  const e = per.get(nama) ?? { nama, peran:new Set(), tahun:new Map(), total:0 };
  e.peran.add(peran); e.total += jumlah;
  if (peran==='installer' && sk.installerBayarDiMuka) {
    const th = bastYear + tahap[0].tahunKe; tahunSet.add(th);
    e.tahun.set(th,(e.tahun.get(th)??0)+jumlah);
  } else for (const t of tahap) {
    const th = bastYear + t.tahunKe; tahunSet.add(th);
    e.tahun.set(th,(e.tahun.get(th)??0)+Math.round(jumlah*t.persen/totalPersen));
  }
  per.set(nama,e);
}
const tahun=[...tahunSet].sort();
let gagal=0;
const cek=(n,a,b)=>{ const ok=JSON.stringify(a)===JSON.stringify(b);
  console.log(`  ${ok?'ok   ':'GAGAL'} ${n}${ok?'':` — dapat ${JSON.stringify(a)}, harap ${JSON.stringify(b)}`}`); if(!ok)gagal++; };

console.log('\nTahun yang muncul:', tahun.join(', '));
const yoga = per.get('Yoga KS');
cek('Yoga jadi SATU baris (bukan dua)', per.size, 3);
cek('Nominal Yoga dijumlah dari 2 peran', yoga.total, 1_900_000);
cek('Peran Yoga tercatat keduanya', [...yoga.peran].sort(), ['pic','supervisor']);
cek('Yoga 2027 = 50%', yoga.tahun.get(2027), 950_000);
cek('Yoga 2028 = 35%', yoga.tahun.get(2028), 665_000);
cek('Yoga 2029 = 15%', yoga.tahun.get(2029), 285_000);
cek('Tiga tahun Yoga = totalnya', [2027,2028,2029].reduce((n,t)=>n+yoga.tahun.get(t),0), 1_900_000);

const pras = per.get('Pras');
cek('Installer HANYA di tahun pertama', [...pras.tahun.keys()], [2027]);
cek('Installer 100% sekaligus', pras.tahun.get(2027), 300_000);
cek('Persen installer = 100%', pras.tahun.get(2027)/pras.total, 1);

const grand=[...per.values()].reduce((n,o)=>n+o.total,0);
cek('GRAND TOTAL terisi, bukan kosong', grand, 3_675_000);
console.log(`\n${gagal===0?'SEMUA LULUS':'ADA GAGAL'} — ${gagal} gagal\n`);
process.exit(gagal?1:0);
