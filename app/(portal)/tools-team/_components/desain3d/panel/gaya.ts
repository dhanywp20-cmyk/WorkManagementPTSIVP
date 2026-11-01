/**
 * Kelas tombol bersama Desain 3D. Satu bahasa visual untuk seluruh alat: tinggi 32 px, sudut 8 px, ikon 15 px.
 * Tata letak (gaya aplikasi CAD): satu bilah atas, satu rel alat di kiri kanvas (alat benda terpilih di bawahnya),
 * menu Tampilan di kiri-bawah, navigasi kamera di kanan-bawah.
 */
export const tombol = 'inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-[12.5px] font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 whitespace-nowrap';
export const tombolUtama = 'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-semibold text-white bg-blue-700 hover:bg-blue-800 whitespace-nowrap';
export const tombolAktif = 'inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg text-[12.5px] font-semibold border border-blue-300 bg-blue-50 text-blue-800 whitespace-nowrap';
/** Tombol ikon persegi di bilah atas (undo, bantuan, layar penuh). */
export const tombolIkon = 'inline-grid place-items-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-white';
/** Pemisah tipis antar kelompok di bilah atas. */
export const pemisah = 'hidden md:block w-px h-5 bg-slate-200';
/** Panel melayang di atas kanvas (rel alat, bilah terpilih, navigasi, menu). */
export const panelKanvas = 'rounded-xl bg-white/95 backdrop-blur border border-slate-200 shadow-md';
/** Grup tombol kamera mendatar (kanan-bawah kanvas). */
export const grupNavMendatar = 'flex flex-row rounded-xl bg-white/95 backdrop-blur border border-slate-200 shadow-md overflow-hidden divide-x divide-slate-100';
export const grupNav = 'flex flex-col rounded-xl bg-white/95 backdrop-blur border border-slate-200 shadow-md overflow-hidden divide-y divide-slate-100';
export const tombolSudut = (aktif: boolean) => `px-2 py-1.5 rounded-lg text-[12px] font-semibold border ${aktif ? 'bg-blue-700 border-blue-700 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`;
/** Menu tarik-turun (Ekspor, Pusatkan isi, Tampilan). */
export const menuMelayang = 'z-30 rounded-xl bg-white border border-slate-200 shadow-xl p-1.5';
export const itemMenu = 'w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50';
export const judulMenu = 'px-3 pt-2 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-500';
