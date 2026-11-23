import { atasanEfektif, pilihBawahan, terpisahDariGrup, cariTargetCC, type OrangAtasan, type PemetaanAtasan } from '../lib/atasan';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean) {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}`); }
}

const orang: OrangAtasan[] = [
  { id: 'spvA', jabatan: 'Supervisor', sales_division: 'IVP' },
  { id: 'spvB', jabatan: 'Supervisor', sales_division: 'IVP' },
  { id: 'mgr', jabatan: 'Manager', sales_division: 'IVP' },
  { id: 's1', jabatan: 'Staff', sales_division: 'IVP' },
  { id: 's2', jabatan: 'Staff', sales_division: 'IVP' },
  { id: 's3', jabatan: 'Staff', sales_division: 'IVP' },
  { id: 'luar', jabatan: 'Staff', sales_division: 'HAVS' },
];
const peta: PemetaanAtasan[] = [
  { user_id: 's1', supervisor_id: 'spvA' },
  { user_id: 's2', supervisor_id: 'spvB' },
  { user_id: 'luar', supervisor_id: 'spvA' },
];
const tier = (id: string) => ({ spvA: 2, spvB: 2, mgr: 3 } as Record<string, number>)[id] ?? 1;
const bawahan = (id: string) => [...pilihBawahan({ viewer: orang.find(o => o.id === id)!, divisi: ['IVP'], orang, peta })].sort();

(async () => {
  console.log('\nAtasan efektif');
  cek('per user diisi -> per user menang', atasanEfektif(['b'], ['a']).sumber === 'user' && atasanEfektif(['b'], ['a']).ids[0] === 'b');
  cek('per user kosong -> ikut grup', atasanEfektif([], ['a']).sumber === 'grup');
  cek('dua-duanya kosong -> kosong', atasanEfektif([], []).sumber === 'kosong');

  console.log('\nLingkup bawahan (satu grup, dua supervisor)');
  cek('supervisor A: tim A + yang ikut grup, bukan tim B', JSON.stringify(bawahan('spvA')) === JSON.stringify(['luar', 's1', 's3']));
  cek('supervisor B: tim B + yang ikut grup, bukan tim A', JSON.stringify(bawahan('spvB')) === JSON.stringify(['s2', 's3']));
  cek('manager di atas keduanya tetap melihat semua staf grup', ['s1', 's2', 's3', 'spvA', 'spvB'].every(id => bawahan('mgr').includes(id)));
  cek('user di luar grup ikut lewat mapping per user', bawahan('spvA').includes('luar') && !bawahan('mgr').includes('luar'));
  cek('terpisah dari grup dihitung per penonton', terpisahDariGrup('spvA', 2, peta, tier).has('s2') && !terpisahDariGrup('spvA', 2, peta, tier).has('s1'));

  console.log('\nTarget CC');
  const data: Record<string, unknown[]> = {
    users: [{ id: 's1', jabatan: 'Staff', full_name: 'S1', phone_number: '1' }, { id: 'spvA', jabatan: 'Supervisor', full_name: 'A', phone_number: '10' },
      { id: 'spvB', jabatan: 'Supervisor', full_name: 'B', phone_number: '20' }, { id: 's3', jabatan: 'Staff', full_name: 'S3', phone_number: '3' }],
    user_supervisor_mappings: peta,
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
