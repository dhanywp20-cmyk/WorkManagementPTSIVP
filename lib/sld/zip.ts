export interface BerkasZip { nama: string; isi: Uint8Array }

const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u32 = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const MAKS_ISI = 60_000_000;

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const aliran = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(aliran).arrayBuffer());
}

export async function bacaZip(b: Uint8Array, saring: (nama: string) => boolean = () => true): Promise<Map<string, Uint8Array>> {
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Berkas bukan ZIP / Excel (.xlsx) yang sah.');
  const jumlah = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);
  const hasil = new Map<string, Uint8Array>();
  let total = 0;
  const td = new TextDecoder();
  for (let n = 0; n < jumlah; n++) {
    if (u32(b, p) !== 0x02014b50) throw new Error('Struktur ZIP rusak.');
    const metode = u16(b, p + 10), ukKomp = u32(b, p + 20), ukAsli = u32(b, p + 24);
    const panjangNama = u16(b, p + 28), panjangExtra = u16(b, p + 30), panjangKomentar = u16(b, p + 32), lokal = u32(b, p + 42);
    const nama = td.decode(b.subarray(p + 46, p + 46 + panjangNama));
    p += 46 + panjangNama + panjangExtra + panjangKomentar;
    if (!saring(nama) || nama.endsWith('/')) continue;
    total += ukAsli;
    if (total > MAKS_ISI) throw new Error('Isi berkas terlalu besar.');
    const awal = lokal + 30 + u16(b, lokal + 26) + u16(b, lokal + 28);
    const data = b.subarray(awal, awal + ukKomp);
    if (metode === 0) hasil.set(nama, data);
    else if (metode === 8) hasil.set(nama, await inflate(data));
  }
  return hasil;
}

const TABEL_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = TABEL_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function tulisZip(berkas: BerkasZip[]): Uint8Array {
  const te = new TextEncoder();
  const bagian: Uint8Array[] = [], pusat: Uint8Array[] = [];
  let offset = 0;
  for (const f of berkas) {
    const nama = te.encode(f.nama), crc = crc32(f.isi);
    const lokal = new DataView(new ArrayBuffer(30));
    lokal.setUint32(0, 0x04034b50, true); lokal.setUint16(4, 20, true); lokal.setUint16(6, 0x0800, true);
    lokal.setUint32(14, crc, true); lokal.setUint32(18, f.isi.length, true); lokal.setUint32(22, f.isi.length, true); lokal.setUint16(26, nama.length, true);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, f.isi.length, true); cd.setUint32(24, f.isi.length, true); cd.setUint16(28, nama.length, true);
    cd.setUint32(42, offset, true);
    bagian.push(new Uint8Array(lokal.buffer), nama, f.isi);
    pusat.push(new Uint8Array(cd.buffer), nama);
    offset += 30 + nama.length + f.isi.length;
  }
  const ukPusat = pusat.reduce((s, x) => s + x.length, 0);
  const akhir = new DataView(new ArrayBuffer(22));
  akhir.setUint32(0, 0x06054b50, true); akhir.setUint16(8, berkas.length, true); akhir.setUint16(10, berkas.length, true);
  akhir.setUint32(12, ukPusat, true); akhir.setUint32(16, offset, true);
  const semua = [...bagian, ...pusat, new Uint8Array(akhir.buffer)];
  const out = new Uint8Array(semua.reduce((s, x) => s + x.length, 0));
  let i = 0;
  for (const x of semua) { out.set(x, i); i += x.length; }
  return out;
}
