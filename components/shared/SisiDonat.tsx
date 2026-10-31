/**
 * Donat 3D: ketebalan cincin (sisi samping) digambar dari salinan irisan yang ditumpuk 1px demi 1px ke
 * bawah lalu digelapkan, sehingga dari sudut miring (kelas `donat-3d` di globals.css) cincin terlihat
 * seperti benda tebal. Hanya SVG - tidak ada data tambahan.
 */

export const TEBAL_DONAT = 5;

/** Cincin utuh sebagai path (lubang tengah lewat fill-rule evenodd) - untuk irisan 100%. */
export function jalurCincin(cx: number, cy: number, r: number, ir: number): string {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z `
    + `M ${cx - ir} ${cy} A ${ir} ${ir} 0 1 1 ${cx + ir} ${cy} A ${ir} ${ir} 0 1 1 ${cx - ir} ${cy} Z`;
}

/** Geser irisan yang disorot keluar dari pusat (sudut tengah irisan, radian). */
export function geserIrisan(sudutTengah: number, jarak = 3.5): string {
  return `translate(${(Math.cos(sudutTengah) * jarak).toFixed(2)}px, ${(Math.sin(sudutTengah) * jarak - 1.5).toFixed(2)}px)`;
}

export function SisiDonat({ irisan }: { irisan: { d: string; warna: string }[] }) {
  const lapis = Array.from({ length: TEBAL_DONAT }, (_, k) => TEBAL_DONAT - k);
  return (
    <g aria-hidden="true" pointerEvents="none">
      {lapis.map(y => (
        <g key={y} transform={`translate(0 ${y})`}>
          {irisan.map((s, i) => <path key={i} d={s.d} fill={s.warna} fillRule="evenodd" />)}
          <g fill="#0f172a" opacity={0.22 + (y / TEBAL_DONAT) * 0.14}>
            {irisan.map((s, i) => <path key={i} d={s.d} fillRule="evenodd" />)}
          </g>
        </g>
      ))}
    </g>
  );
}
