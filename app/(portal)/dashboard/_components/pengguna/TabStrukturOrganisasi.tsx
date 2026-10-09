'use client';
import { Keterangan } from '@/components/shared/Keterangan';

/** TabStrukturOrganisasi - dipecah dari app/(portal)/dashboard/_components/modal-user.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { User } from '../shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import React from 'react';

export interface TabStrukturOrganisasiProps {
  ORG_GROUP_STYLE: Record<string, { bg: string; color: string; }>;
  activeTab: "org" | "atasan" | "ivp" | "product" | "user_cc" | "divisi" | "lingkup";
  allUsers: User[];
  handleSetAtasan: (userId: string, atasanId: string) => Promise<void>;
  jabatanBadge: (u: User | undefined) => React.JSX.Element | null;
  orgChildren: Record<string, User[]>;
  orgFilter: "all" | "Sales" | "Marketing" | "PTS";
  orgGroupOf: (u: User | undefined) => "Sales" | "Marketing" | "PTS" | "Lainnya";
  orgSearch: string;
  orgSelectedId: string;
  orgTierOf: (u: User) => number;
  orgVisible: Set<string> | null;
  saving: boolean;
  setOrgFilter: React.Dispatch<React.SetStateAction<"all" | "Sales" | "Marketing" | "PTS">>;
  setOrgSearch: React.Dispatch<React.SetStateAction<string>>;
  setOrgSelectedId: React.Dispatch<React.SetStateAction<string>>;
}

export function TabStrukturOrganisasi({ ORG_GROUP_STYLE, activeTab, allUsers, handleSetAtasan, jabatanBadge, orgChildren, orgFilter, orgGroupOf, orgSearch, orgSelectedId, orgTierOf, orgVisible, saving, setOrgFilter, setOrgSearch, setOrgSelectedId }: TabStrukturOrganisasiProps) {
  return (
    <>
      {activeTab === 'org' && (() => {
        const flat: { u: User; depth: number; directCount: number }[] = [];
        const walk = (u: User, depth: number) => {
          if (orgVisible && !orgVisible.has(u.id)) return;
          flat.push({ u, depth, directCount: (orgChildren[u.id] || []).length });
          (orgChildren[u.id] || []).forEach(k => walk(k, depth + 1));
        };
        (orgChildren['__root__'] || []).forEach(r => walk(r, 0));

        /**
         * Siapa yang TIDAK muncul di pohon sama sekali. Penelusuran
         * berangkat dari orang tanpa atasan, jadi rantai yang melingkar
         * (A atasan B, B atasan A) tidak tersambung ke akar mana pun dan
         * anggotanya lenyap dari layar tanpa pesan. Dihitung tanpa
         * filter pencarian supaya peringatannya tidak ikut hilang saat
         * daftar sedang disaring.
         */
        const tampilSemua = new Set<string>();
        const walkAll = (u: User) => {
          if (tampilSemua.has(u.id)) return;      // penjaga siklus
          tampilSemua.add(u.id);
          (orgChildren[u.id] || []).forEach(walkAll);
        };
        (orgChildren['__root__'] || []).forEach(walkAll);
        const tidakTampil = allUsers.filter(u => !tampilSemua.has(u.id));

        return (
          <div className="p-5 space-y-4">
            <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-xs font-bold text-emerald-800 mb-1"><IkonTeks nama="🏛" />Struktur Organisasi — satu tempat untuk semua divisi</p>
              <Keterangan className="ml-1">Atur atasan langsung setiap orang (Sales, Marketing, PTS) dalam satu pohon Direktur → Staff. Satu atasan bisa membawahi banyak orang. Klik nama untuk mengubah atasannya.</Keterangan>
            </div>

            {/* Peringatan: akun yang tidak muncul di pohon mana pun. */}
            {tidakTampil.length > 0 && (
              <div className="px-4 py-3 rounded-xl" style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}>
                <p className="text-xs font-bold text-amber-800 mb-1">
                  <Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /> {tidakTampil.length} akun tidak muncul di pohon ini
                </p>
                <p className="text-[11px] text-amber-700 leading-relaxed mb-2">
                  Penyebabnya salah satu dari dua: <strong>belum punya atasan</strong>, atau
                  <strong> rantai atasannya melingkar</strong> (A atasan B, B atasan A) sehingga
                  tidak pernah tersambung ke puncak. Keduanya membuat orang tersebut tidak masuk
                  rekap dan routing siapa pun. Klik namanya di daftar bawah untuk menetapkan atasan.
                </p>
                <div className="flex flex-wrap gap-1">
                  {tidakTampil.map(u => (
                    <span key={u.id} className="text-[11px] px-2 py-0.5 rounded-full bg-white text-amber-800 border border-amber-300">
                      {u.full_name}{u.jabatan ? ` · ${u.jabatan}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {(['all', 'Sales', 'Marketing', 'PTS'] as const).map(f => (
                <button key={f} onClick={() => setOrgFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${orgFilter === f ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}>
                  {f === 'all' ? 'Semua' : f}
                </button>
              ))}
              <div className="relative flex-1 min-w-[160px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <input aria-label="Cari nama / username..." type="text" value={orgSearch} onChange={e => setOrgSearch(e.target.value)} placeholder="Cari nama / username..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all" />
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#185FA5' }} /> Sales</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#D4537E' }} /> Marketing</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#1D9E75' }} /> PTS</span>
              <span className="ml-auto">Indentasi = tingkat jabatan · {flat.length} orang</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-2">
              {flat.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  <p className="text-2xl mb-1"><Ikon nama="🏛" ukuran="1em" className="inline-block align-[-0.12em]" /></p>
                  Tidak ada hasil. Coba ubah filter atau jalankan migration <code className="text-[11px]">atasan_id</code>.
                </div>
              ) : flat.map(({ u, depth, directCount }) => {
                const grp = orgGroupOf(u);
                const gs = ORG_GROUP_STYLE[grp];
                const isSel = orgSelectedId === u.id;
                return (
                  <div key={u.id}>
                    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                      style={{ marginLeft: depth * 18 }} onClick={() => setOrgSelectedId(isSel ? '' : u.id)}>
                      {depth > 0 && <span className="text-slate-400 text-xs flex-shrink-0">└</span>}
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{ background: gs.bg, color: gs.color }}>
                        {u.full_name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <span className="text-sm font-semibold text-slate-800 truncate">{u.full_name}</span>
                      {jabatanBadge(u)}
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: gs.bg, color: gs.color }}>{grp}</span>
                      {directCount > 0 && <span className="text-[11px] text-slate-500 flex-shrink-0">· {directCount} bawahan</span>}
                      <span className="ml-auto text-slate-400 text-xs flex-shrink-0">{isSel ? '▲' : '▼'}</span>
                    </div>
                    {isSel && (
                      <div style={{ marginLeft: depth * 18 + 30 }} className="my-1 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                        <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest mb-1.5">Atur atasan langsung — {u.full_name}</p>
                        <select aria-label="— Tidak ada (puncak / Direktur) —" value={u.atasan_id || ''} onChange={e => { handleSetAtasan(u.id, e.target.value); setOrgSelectedId(''); }} disabled={saving}
                          className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200 bg-white">
                          <option value="">— Tidak ada (puncak / Direktur) —</option>
                          {allUsers.filter(c => c.id !== u.id).slice().sort((a, b) => orgTierOf(b) - orgTierOf(a) || a.full_name.localeCompare(b.full_name, 'id')).map(c => (
                            <option key={c.id} value={c.id}>{c.full_name}{c.jabatan ? ` · ${c.jabatan}` : ''} ({orgGroupOf(c)})</option>
                          ))}
                        </select>
                        <p className="text-[11px] text-emerald-700 mt-1.5">Daftar berisi SEMUA user lintas divisi · otomatis tervalidasi anti-loop.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </>
  );
}
