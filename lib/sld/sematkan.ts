'use client';

const simpanan = new Map<string, Promise<string>>();

export function fotoData(src: string): Promise<string> {
  let p = simpanan.get(src);
  if (!p) {
    p = fetch(src).then(r => (r.ok ? r.blob() : Promise.reject(new Error(`Foto ${src} gagal dimuat.`)))).then(b => new Promise<string>((ok, gagal) => {
      const f = new FileReader();
      f.onload = () => ok(String(f.result));
      f.onerror = () => gagal(new Error('Foto gagal dibaca.'));
      f.readAsDataURL(b);
    }));
    p.catch(() => simpanan.delete(src));
    simpanan.set(src, p);
  }
  return p;
}

export async function sematkanFoto(svg: string): Promise<string> {
  const jalur = [...new Set([...svg.matchAll(/(?:href|src)="(\/sld\/produk\/[a-z0-9-]+\.jpg|\/api\/tools-team\/sld\/katalog\/[0-9a-f-]{36}\/\d{1,6})"/g)].map(m => m[1]))];
  const data = await Promise.all(jalur.map(fotoData));
  return jalur.reduce((s, j, i) => s.split(`"${j}"`).join(`"${data[i]}"`), svg);
}
