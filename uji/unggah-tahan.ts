import { denganUnggahTahan, bodiDiMemori, PESAN_BERKAS_TAK_TERBACA } from '../lib/unggah-tahan';

let lulus = 0, gagal = 0;
const cek = (n: string, ok: boolean, c = '') => {
  if (ok) { lulus++; console.log(`  ok    ${n}`); }
  else { gagal++; console.log(`  GAGAL ${n}${c ? ' - ' + c : ''}`); }
};
const URL_UNGGAH = 'https://x.supabase.co/storage/v1/object/ticket-photos/photos/1.jpg';
const formFoto = () => { const f = new FormData(); f.append('cacheControl', '3600'); f.append('', new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' })); return f; };

(async () => {
  console.log('\n1. Jaringan putus lalu pulih: upload dicoba ulang');
  {
    let panggil = 0; const ukuran: number[] = [];
    const f = denganUnggahTahan(async (_i, init) => {
      panggil++;
      const b = (init!.body as FormData).get('') as File; ukuran.push((await b.arrayBuffer()).byteLength);
      if (panggil < 3) throw new TypeError('Failed to fetch');
      return new Response('{"Key":"ticket-photos/photos/1.jpg"}', { status: 200 });
    }, 1);
    const r = await f(URL_UNGGAH, { method: 'POST', body: formFoto() });
    cek('berhasil di percobaan ke-3', r.ok && panggil === 3, `panggil ${panggil}`);
    cek('isi foto utuh di tiap percobaan', ukuran.every(u => u === 3), ukuran.join(','));
  }
  console.log('\n2. Batas percobaan');
  {
    let panggil = 0;
    const f = denganUnggahTahan(async () => { panggil++; throw new TypeError('Failed to fetch'); }, 1);
    let pesan = '';
    try { await f(URL_UNGGAH, { method: 'POST', body: formFoto() }); } catch (e) { pesan = (e as Error).message; }
    cek('menyerah setelah 3 percobaan', panggil === 3 && pesan === 'Failed to fetch', `panggil ${panggil}`);
  }
  console.log('\n3. Percobaan pertama ternyata sudah masuk');
  {
    let panggil = 0;
    const f = denganUnggahTahan(async () => {
      panggil++;
      if (panggil === 1) throw new TypeError('Failed to fetch');
      return new Response('{"statusCode":"409","error":"Duplicate","message":"The resource already exists"}', { status: 400 });
    }, 1);
    const r = await f(URL_UNGGAH, { method: 'POST', body: formFoto() });
    const j = await r.json() as { Key: string };
    cek('duplikat dianggap berhasil', r.ok && j.Key === 'ticket-photos/photos/1.jpg', JSON.stringify(j));
  }
  {
    const f = denganUnggahTahan(async () => new Response('{"statusCode":"409","error":"Duplicate"}', { status: 400 }), 1);
    const r = await f(URL_UNGGAH, { method: 'POST', body: formFoto() });
    cek('duplikat di percobaan pertama tetap galat asli', r.status === 400);
  }
  console.log('\n4. Selain upload tidak disentuh');
  {
    let dapat: unknown = null; const body = formFoto();
    const f = denganUnggahTahan(async (_i, init) => { dapat = init?.body; return new Response('[]'); }, 1);
    await f('https://x.supabase.co/rest/v1/tickets', { method: 'POST', body });
    cek('REST tetap memakai body asli', dapat === body);
    let n = 0;
    const g = denganUnggahTahan(async () => { n++; throw new TypeError('Failed to fetch'); }, 1);
    try { await g('https://x.supabase.co/storage/v1/object/public/ticket-photos/a.jpg'); } catch { /* */ }
    cek('unduhan publik tidak diulang', n === 1);
  }
  console.log('\n5. Berkas tidak terbaca');
  {
    const rusak = new File([new Uint8Array([1])], 'b.jpg', { type: 'image/jpeg' });
    Object.defineProperty(rusak, 'arrayBuffer', { value: () => Promise.reject(new Error('NotReadableError')) });
    const fd = new FormData(); fd.append('', rusak);
    let pesan = '';
    try { await bodiDiMemori(fd); } catch (e) { pesan = (e as Error).message; }
    cek('pesan jelas untuk berkas tak terbaca', pesan === PESAN_BERKAS_TAK_TERBACA, pesan);
  }
  console.log(`\n${lulus} lulus, ${gagal} gagal`);
  if (gagal) process.exit(1);
})();
