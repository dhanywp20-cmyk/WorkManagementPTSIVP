import * as THREE from 'three';
import { biasKeArahLampu, NORMAL_BIAS_SPOT } from '../app/(portal)/tools-team/_components/desain3d/mesin/proyektorNyata';

let lulus = 0, gagal = 0;
function cek(nama: string, syarat: boolean, info = '') {
  if (syarat) { lulus++; console.log(`  ok   ${nama}`); } else { gagal++; console.log(`  GAGAL ${nama}${info ? ` - ${info}` : ''}`); }
}

console.log('\n1. Normal bias bayangan proyektor diarahkan ke lampu (sisi dalam layar cekung tidak membayangi diri sendiri)');
const contoh = `for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {\n\tshadowWorldPosition = worldPosition;\n\t#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n\t\t${NORMAL_BIAS_SPOT}\n\t#endif\n}`;
const jadi = biasKeArahLampu(contoh);
cek('baris normal bias asli diganti', !jadi.includes(NORMAL_BIAS_SPOT));
cek('posisi lampu diambil dari pusat proyeksi spotLightMatrix', jadi.includes('inverse( spotLightMatrix[ i ] ) * vec4( 0.0, 0.0, 1.0, 0.0 )'));
cek('arah geser dibalik bila normal menjauhi lampu', /dot\( shadowWorldNormal, keLampu \) < 0\.0 \? - 1\.0 : 1\.0/.test(jadi));
cek('dipasang dua kali tetap sama', biasKeArahLampu(jadi) === jadi);

console.log('\n2. Cocok dengan three.js yang dipakai');
{
  cek('shadowmap_vertex three.js memuat baris normal bias spot yang diganti', THREE.ShaderChunk.shadowmap_vertex.includes(NORMAL_BIAS_SPOT));
  const lampu = new THREE.SpotLight(0xffffff, 1, 0, 0.6);
  lampu.position.set(2.4, 2.4, 1.9); lampu.target.position.set(2.5, 1.7, 0.3);
  lampu.updateMatrixWorld(); lampu.target.updateMatrixWorld(); lampu.shadow.updateMatrices(lampu);
  const pusat = new THREE.Vector4(0, 0, 1, 0).applyMatrix4(lampu.shadow.matrix.clone().invert());
  const p = new THREE.Vector3(pusat.x / pusat.w, pusat.y / pusat.w, pusat.z / pusat.w);
  cek(`pusat proyeksi matriks bayangan = posisi lampu (selisih ${(p.distanceTo(lampu.position) * 1000).toFixed(3)} mm)`, p.distanceTo(lampu.position) < 1e-4);
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
