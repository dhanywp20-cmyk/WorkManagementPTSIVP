import { atasanEfektif, pilihBawahan, cariTargetCC, type OrangAtasan, type PemetaanAtasan, type PemetaanGrup } from '../lib/atasan';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

const orang: OrangAtasan[] = [
  { id: 'adela', jabatan: 'Manager', sales_division: 'IVP' },
  { id: 'hendri', jabatan: 'Supervisor', sales_division: 'IVP' },
  { id: 'spvB', jabatan: 'Supervisor', sales_division: 'IVP' },
  { id: 'mgrGrup', jabatan: 'Manager', sales_division: 'SGP' },
  { id: 's1', jabatan: 'Staff', sales_division: 'IVP' },
  { id: 's2', jabatan: 'Staff', sales_division: 'IVP' },
  { id: 's3', jabatan: 'Staff', sales_division: 'IVP' },
  { id: 'g1', jabatan: 'Staff', sales_division: 'SGP' },
  { id: 'g2', jabatan: 'Staff', sales_division: 'SGP' },
  { id: 'luar', jabatan: 'Staff', sales_division: 'HAVS' },
];
const peta: PemetaanAtasan[] = [
  { user_id: 's1', supervisor_id: 'adela' },
  { user_id: 'luar', supervisor_id: 'adela' },
  { user_id: 'spvB', supervisor_id: 'adela' },
  { user_id: 's2', supervisor_id: 'spvB' },
  { user_id: 'g2', supervisor_id: 'spvB' },
];
const grup: PemetaanGrup[] = [{ sales_division: 'SGP', supervisor_id: 'mgrGrup' }];
const bawahan = (id: string) => [...pilihBawahan({ viewerId: id, orang, peta, grup })].sort().join(',');

(async () => {
  console.log('\nAtasan efektif');
  cek('per user diisi -> per user menang', atasanEfektif(['b'], ['a']).sumber === 'user' && atasanEfektif(['b'], ['a']).ids[0] === 'b');
  cek('per user kosong -> ikut grup', atasanEfektif([], ['a']).sumber === 'grup');
  cek('dua-duanya kosong -> kosong', atasanEfektif([], []).sumber === 'kosong');

  console.log('\nLingkup bawahan hanya dari mapping');
  cek('Adela: tim per user + rantai di bawah spvB, tanpa Hendri / staf IVP lain', bawahan('adela') === 'g2,luar,s1,s2,spvB');
  cek('Hendri tanpa mapping -> tidak melihat siapa pun walau satu divisi', bawahan('hendri') === '');
  cek('atasan grup: anggota grup yang jabatannya lebih rendah', bawahan('mgrGrup') === 'g1');
  cek('anggota grup dengan mapping per user tidak ikut atasan grup', !bawahan('mgrGrup').includes('g2'));
  cek('staf tidak melihat siapa pun', bawahan('s1') === '');
  const lingkar: PemetaanAtasan[] = [{ user_id: 'b', supervisor_id: 'a' }, { user_id: 'a', supervisor_id: 'b' }];
  cek('rantai melingkar tidak macet', [...pilihBawahan({ viewerId: 'a', orang, peta: lingkar, grup: [] })].join(',') === 'b');

  console.log('\nTarget CC');
  const data: Record<string, unknown[]> = {
    users: [{ id: 's1', jabatan: 'Staff', full_name: 'S1', phone_number: '1' }, { id: 'spvA', jabatan: 'Supervisor', full_name: 'A', phone_number: '10' },
      { id: 'spvB', jabatan: 'Supervisor', full_name: 'B', phone_number: '20' }, { id: 's3', jabatan: 'Staff', full_name: 'S3', phone_number: '3' }],
    user_supervisor_mappings: [{ user_id: 's1', supervisor_id: 'spvA' }],
    division_supervisor_mappings: [{ sales_division: 'IVP', supervisor_id: 'spvA' }, { sales_division: 'IVP', supervisor_id: 'spvB' }],
    division_ivp_mappings: [],
  };
  const db = {
    from(tabel: string) {
      let baris = [...(data[tabel] ?? [])] as Record<string, unknown>[];
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => { baris = baris.filter(b => b[k] === v); return q; },
        in: (k: string, v: unknown[]) => { baris = baris.filter(b => v.includes(b[k])); return q; },
        not: () => q, neq: () => q,
        maybeSingle: () => Promise.resolve({ data: baris[0] ?? null }),
        then: (ok: (r: { data: unknown[] }) => unknown) => Promise.resolve({ data: baris }).then(ok),
      };
      return q;
    },
  };
  const cc = async (id: string) => (await cariTargetCC(db as never, id, 'IVP')).map(t => t.name).sort().join(',');
  cek('staf dengan atasan per user -> hanya atasannya', await cc('s1') === 'A');
  cek('staf tanpa atasan per user -> semua atasan grup', await cc('s3') === 'A,B');

  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  if (gagal) process.exit(1);
})();
