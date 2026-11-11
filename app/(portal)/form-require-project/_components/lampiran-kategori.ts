import type { KategoriLampiran } from './shared';

export const LABEL_KATEGORI: Record<KategoriLampiran, string> = {
  sld: 'SLD', boq: 'BOQ', design3d: 'Design 3D', screen: 'Screen Connection',
};

export const KELAS_KATEGORI: Record<KategoriLampiran, { garis: string; latar: string; teks: string; teksRedup: string; ikon: string; lencana: string }> = {
  sld: { garis: 'border-blue-200', latar: 'bg-blue-50', teks: 'text-blue-700', teksRedup: 'text-blue-500', ikon: 'bg-blue-100', lencana: 'bg-blue-500' },
  boq: { garis: 'border-emerald-200', latar: 'bg-emerald-50', teks: 'text-emerald-700', teksRedup: 'text-emerald-500', ikon: 'bg-emerald-100', lencana: 'bg-emerald-500' },
  design3d: { garis: 'border-purple-200', latar: 'bg-purple-50', teks: 'text-purple-700', teksRedup: 'text-purple-500', ikon: 'bg-purple-100', lencana: 'bg-purple-500' },
  screen: { garis: 'border-cyan-200', latar: 'bg-cyan-50', teks: 'text-cyan-700', teksRedup: 'text-cyan-500', ikon: 'bg-cyan-100', lencana: 'bg-cyan-500' },
};
