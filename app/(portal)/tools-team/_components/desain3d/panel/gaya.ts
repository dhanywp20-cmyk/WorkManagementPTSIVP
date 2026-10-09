/** Kelas tombol bersama Desain 3D (bilah atas, kontrol kanvas). */
export const tombol = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50';
export const tombolUtama = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-700 hover:bg-blue-800';
export const tombolAktif = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-400 bg-blue-50 text-blue-800';
export const grupNav = 'flex flex-col rounded-xl bg-white/95 border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100';
export const tombolSudut = (aktif: boolean) => `px-2 py-1.5 rounded-lg text-[12px] font-semibold border ${aktif ? 'bg-blue-700 border-blue-700 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`;
