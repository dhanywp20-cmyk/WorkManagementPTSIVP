'use client';

type Tab = "org" | "atasan" | "ivp" | "product" | "user_cc" | "divisi" | "lingkup";

export function PilihModeAtasan({ activeTab, setActiveTab, jumlahGrup, jumlahUser }: { activeTab: Tab; setActiveTab: (t: Tab) => void; jumlahGrup: number; jumlahUser: number }) {
  if (activeTab !== 'atasan' && activeTab !== 'user_cc') return null;
  const pilihan = [
    { tab: 'atasan' as const, judul: `Per Grup (${jumlahGrup})`, isi: 'Atasan untuk semua anggota satu grup / divisi.' },
    { tab: 'user_cc' as const, judul: `Per User (${jumlahUser})`, isi: 'Atasan khusus satu orang — mengalahkan atasan grup. Dipakai untuk lingkup tim, CC WA & Struktur Organisasi.' },
  ];
  return (
    <div className="px-5 pt-4 shrink-0">
      <div role="tablist" aria-label="Jenis mapping atasan" className="grid grid-cols-1 formulir:grid-cols-2 gap-2">
        {pilihan.map(p => {
          const aktif = activeTab === p.tab;
          return (
            <button key={p.tab} role="tab" aria-selected={aktif} type="button" onClick={() => setActiveTab(p.tab)}
              className={`text-left px-3 py-2 rounded-xl border-2 transition-all ${aktif ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:border-amber-300'}`}>
              <span className={`block text-xs font-bold ${aktif ? 'text-amber-800' : 'text-slate-700'}`}>{p.judul}</span>
              <span className="block text-[11px] text-slate-500">{p.isi}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
