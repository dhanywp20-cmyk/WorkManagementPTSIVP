'use client';

import { useState } from 'react';

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_FOLDERS = [
  { id: '1', name: 'Keselamatan Kerja', items: 3, color: 'from-amber-500 to-orange-500', icon: '🦺', sub: ['K3 Dasar', 'SOP Lapangan'] },
  { id: '2', name: 'Produk', items: 5, color: 'from-blue-500 to-indigo-600', icon: '📦', sub: ['Pengetahuan Dasar', 'Spesifikasi Teknis'] },
  { id: '3', name: 'Teknis & Instalasi', items: 4, color: 'from-teal-500 to-cyan-600', icon: '🔧', sub: ['Kabel & Konektor', 'Instalasi Display'] },
  { id: '4', name: 'Sales & Marketing', items: 6, color: 'from-purple-500 to-violet-600', icon: '📊', sub: ['Teknik Closing', 'Presentasi Produk'] },
  { id: '5', name: 'SOP & Prosedur', items: 2, color: 'from-rose-500 to-pink-600', icon: '📋', sub: [] },
  { id: '6', name: 'Orientasi Karyawan', items: 4, color: 'from-emerald-500 to-green-600', icon: '🎓', sub: ['Pengenalan Perusahaan'] },
];

const MOCK_MATERIALS = [
  { id: 'm1', name: 'AV Dasar & Pengenalan Produk', folder: 'Produk / Pengetahuan Dasar', hasAI: true, date: '14 Mei 2026' },
  { id: 'm2', name: 'LED Display — Spesifikasi & Aplikasi', folder: 'Produk / Pengetahuan Dasar', hasAI: true, date: '14 Mei 2026' },
  { id: 'm3', name: 'Panduan K3 untuk Teknisi Lapangan', folder: 'Keselamatan Kerja', hasAI: false, date: '10 Mei 2026' },
  { id: 'm4', name: 'SOP Instalasi Display Indoor', folder: 'Teknis & Instalasi', hasAI: true, date: '08 Mei 2026' },
  { id: 'm5', name: 'Teknik Presentasi & Demo Produk', folder: 'Sales & Marketing', hasAI: true, date: '05 Mei 2026' },
];

// ─── Shared badge ─────────────────────────────────────────────────────────────
const AIBadge = () => (
  <span className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">AI ✓</span>
);

// ─────────────────────────────────────────────────────────────────────────────
//  STYLE A — Dark Explorer
// ─────────────────────────────────────────────────────────────────────────────
function StyleA() {
  const [selected, setSelected] = useState(MOCK_FOLDERS[1]);
  const [openSub, setOpenSub] = useState<string | null>('Pengetahuan Dasar');
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-700 shadow-2xl" style={{ height: 420 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700" style={{ background: '#0f172a' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs">🎓</div>
          <span className="text-sm font-bold text-white">Materi Training</span>
          <span className="text-xs text-slate-400 font-medium bg-slate-800 px-2 py-0.5 rounded-full">Admin Portal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5">
            <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <span className="text-xs text-slate-400">Cari materi...</span>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
            + Tambah
          </button>
        </div>
      </div>

      <div className="flex" style={{ height: 'calc(420px - 49px)' }}>
        {/* Sidebar */}
        <div className="w-52 flex-shrink-0 border-r border-slate-700 overflow-y-auto" style={{ background: '#1e293b' }}>
          <div className="px-3 pt-3 pb-1">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-2">📁 Folder</p>
            {MOCK_FOLDERS.map(f => (
              <button key={f.id} onClick={() => setSelected(f)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left mb-0.5 transition-all ${selected.id === f.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>
                <span className="text-sm flex-shrink-0">{f.icon}</span>
                <span className="text-xs font-semibold truncate flex-1">{f.name}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${selected.id === f.id ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}>{f.items}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4" style={{ background: '#f8fafc' }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">{selected.icon}</span>
            <h3 className="font-bold text-slate-800">{selected.name}</h3>
            <span className="text-xs text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">{selected.items} item</span>
          </div>

          {/* Subfolders */}
          {selected.sub.length > 0 && (
            <div className="mb-3 grid grid-cols-2 gap-2">
              {selected.sub.map(s => (
                <button key={s} onClick={() => setOpenSub(openSub === s ? null : s)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${openSub === s ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'}`}>
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                    <path d="M2 7.5C2 6.67 2.67 6 3.5 6H9l2 2h9.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-17C2.67 20 2 19.33 2 18.5v-11z" fill={openSub === s ? '#FCD34D' : '#FBBF24'} stroke="#D97706" strokeWidth="0.8" />
                  </svg>
                  <span className="text-xs font-semibold text-slate-700 truncate">{s}</span>
                  <svg className={`w-3 h-3 ml-auto text-slate-400 transition-transform flex-shrink-0 ${openSub === s ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </button>
              ))}
            </div>
          )}

          {/* Materials list */}
          {openSub && (
            <div className="rounded-xl border border-blue-200 overflow-hidden mb-3">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-100" style={{ background: 'rgba(219,234,254,0.5)' }}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><path d="M2 7.5C2 6.67 2.67 6 3.5 6H9l2 2h9.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-17C2.67 20 2 19.33 2 18.5v-11z" fill="#FCD34D" stroke="#D97706" strokeWidth="0.8" /></svg>
                <span className="text-xs font-bold text-blue-800">{openSub}</span>
              </div>
              <div className="p-2.5 space-y-1.5" style={{ background: '#fff' }}>
                {MOCK_MATERIALS.slice(0, 2).map(m => (
                  <div key={m.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:border-blue-200 hover:shadow-sm transition-all">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{m.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">{m.hasAI && <AIBadge />}<span className="text-[10px] text-slate-400">{m.date}</span></div>
                    </div>
                    <a href="#" className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg font-semibold hover:bg-blue-100 transition-all flex-shrink-0">Buka</a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!openSub && selected.sub.length === 0 && (
            <div className="space-y-1.5">
              {MOCK_MATERIALS.slice(0, 3).map(m => (
                <div key={m.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm transition-all">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{m.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">{m.hasAI && <AIBadge />}<span className="text-[10px] text-slate-400">{m.date}</span></div>
                  </div>
                  <a href="#" className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg font-semibold hover:bg-blue-100 transition-all flex-shrink-0">Buka</a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STYLE B — Colorful Hub
// ─────────────────────────────────────────────────────────────────────────────
function StyleB() {
  const [selected, setSelected] = useState<typeof MOCK_FOLDERS[0] | null>(null);
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-xl bg-white" style={{ height: 420 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100" style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' }}>
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2"><span>📚</span> Materi Training</h2>
          <p className="text-xs text-slate-500 mt-0.5">Kelola & organisir materi training team</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
            <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <span className="text-xs text-slate-400">Cari materi...</span>
          </div>
          <button className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-md" style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>+ Tambah Materi</button>
        </div>
      </div>

      <div className="p-5 overflow-y-auto" style={{ height: 'calc(420px - 62px)' }}>
        {/* Folder grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {MOCK_FOLDERS.map(f => (
            <button key={f.id} onClick={() => setSelected(selected?.id === f.id ? null : f)}
              className={`group relative rounded-2xl p-4 text-left transition-all duration-200 overflow-hidden
                ${selected?.id === f.id ? 'ring-2 ring-offset-2 ring-blue-400 scale-[1.02] shadow-xl' : 'hover:scale-[1.02] hover:shadow-xl shadow-md'}`}
              style={{ background: `linear-gradient(135deg, ${f.color.replace('from-', '').replace('to-', '').split(' ').map(c => {
                const m: Record<string,string> = {'amber-500':'#f59e0b','orange-500':'#f97316','blue-500':'#3b82f6','indigo-600':'#4f46e5','teal-500':'#14b8a6','cyan-600':'#0891b2','purple-500':'#a855f7','violet-600':'#7c3aed','rose-500':'#f43f5e','pink-600':'#db2777','emerald-500':'#10b981','green-600':'#16a34a'};
                return m[c] || '#6366f1';
              }).join(',')})` }}>
              {/* Decorative circle */}
              <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-20" style={{ background: 'rgba(255,255,255,0.5)' }} />
              <div className="relative">
                <div className="text-2xl mb-2">{f.icon}</div>
                <p className="text-sm font-bold text-white leading-snug mb-1">{f.name}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/70 font-medium">{f.items} materi</span>
                  <svg className={`w-4 h-4 text-white/80 transition-transform ${selected?.id === f.id ? 'rotate-90' : 'group-hover:translate-x-0.5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Expanded content */}
        {selected && (
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-[fadeIn_0.15s_ease]">
            <div className={`px-4 py-3 flex items-center gap-3 border-b border-slate-100`}
              style={{ background: `linear-gradient(135deg, ${selected.color.replace('from-', '').replace('to-', '').split(' ').map(c => {
                const m: Record<string,string> = {'amber-500':'#fef3c7','orange-500':'#ffedd5','blue-500':'#dbeafe','indigo-600':'#e0e7ff','teal-500':'#ccfbf1','cyan-600':'#cffafe','purple-500':'#f3e8ff','violet-600':'#ede9fe','rose-500':'#ffe4e6','pink-600':'#fce7f3','emerald-500':'#d1fae5','green-600':'#dcfce7'};
                return m[c] || '#e0e7ff';
              }).join(',')})` }}>
              <span className="text-xl">{selected.icon}</span>
              <span className="font-bold text-slate-800">{selected.name}</span>
              <span className="text-xs text-slate-500 bg-white/70 px-2 py-0.5 rounded-full ml-1">{selected.items} item</span>
              <button onClick={() => setSelected(null)} className="ml-auto w-6 h-6 rounded-lg bg-white/70 hover:bg-white flex items-center justify-center text-slate-500 text-sm font-bold transition-all">✕</button>
            </div>
            <div className="p-3 space-y-2" style={{ background: '#fff' }}>
              {MOCK_MATERIALS.slice(0, 3).map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${selected.color.replace('from-','').replace('to-','').split(' ').map(c=>{const m2:Record<string,string>={'amber-500':'#fde68a','orange-500':'#fed7aa','blue-500':'#bfdbfe','indigo-600':'#c7d2fe','teal-500':'#99f6e4','cyan-600':'#a5f3fc','purple-500':'#e9d5ff','violet-600':'#ddd6fe','rose-500':'#fecdd3','pink-600':'#fbcfe8','emerald-500':'#a7f3d0','green-600':'#bbf7d0'};return m2[c]||'#c7d2fe';}).join(',')})` }}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{m.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">{m.hasAI && <AIBadge />}<span className="text-[10px] text-slate-400">{m.date}</span></div>
                  </div>
                  <a href="#" className="text-xs font-bold px-3 py-1.5 rounded-lg text-white shadow-sm transition-all"
                    style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>Buka ↗</a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STYLE C — Breadcrumb Navigator
// ─────────────────────────────────────────────────────────────────────────────
function StyleC() {
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const currentFolder = breadcrumb.length > 0 ? MOCK_FOLDERS.find(f => f.name === breadcrumb[0]) : null;

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-xl bg-white" style={{ height: 420 }}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-100" style={{ background: '#fff' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2"><span>📚</span> Materi Training</h2>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 mt-1">
              <button onClick={() => setBreadcrumb([])} className={`text-xs font-semibold transition-all ${breadcrumb.length === 0 ? 'text-blue-600' : 'text-slate-400 hover:text-blue-500'}`}>Beranda</button>
              {breadcrumb.map((crumb, i) => (
                <span key={crumb} className="flex items-center gap-1.5">
                  <span className="text-slate-300 text-xs">›</span>
                  <button onClick={() => setBreadcrumb(breadcrumb.slice(0, i + 1))} className={`text-xs font-semibold transition-all ${i === breadcrumb.length - 1 ? 'text-blue-600' : 'text-slate-400 hover:text-blue-500'}`}>{crumb}</button>
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <span className="text-xs text-slate-400">Cari materi...</span>
            </div>
            <button className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>+ Tambah</button>
          </div>
        </div>
      </div>

      <div className="p-5 overflow-y-auto" style={{ height: 'calc(420px - 74px)' }}>
        {/* Back button */}
        {breadcrumb.length > 0 && (
          <button onClick={() => setBreadcrumb(b => b.slice(0, -1))}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 mb-4 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            Kembali
          </button>
        )}

        {breadcrumb.length === 0 ? (
          /* Root view — all folders as large tiles */
          <div className="grid grid-cols-2 gap-3">
            {MOCK_FOLDERS.map(f => (
              <button key={f.id} onClick={() => setBreadcrumb([f.name])}
                className="flex items-center gap-3.5 p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-md transition-all text-left group">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-xl shadow-md flex-shrink-0`}>{f.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-all">{f.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{f.items} materi tersedia</p>
                  {f.sub.length > 0 && <p className="text-[10px] text-slate-300 mt-0.5">{f.sub.length} subfolder</p>}
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            ))}
          </div>
        ) : (
          /* Folder content */
          <div>
            {currentFolder && currentFolder.sub.length > 0 && (
              <div className="mb-5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">📁 Subfolder</p>
                <div className="grid grid-cols-3 gap-2">
                  {currentFolder.sub.map(s => (
                    <button key={s} onClick={() => setBreadcrumb(b => [...b, s])}
                      className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/40 hover:shadow-sm transition-all text-left group">
                      <svg className="w-7 h-7 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                        <path d="M2 7.5C2 6.67 2.67 6 3.5 6H9l2 2h9.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-17C2.67 20 2 19.33 2 18.5v-11z" fill="#FBBF24" stroke="#D97706" strokeWidth="0.8" />
                      </svg>
                      <span className="text-xs font-semibold text-slate-700 group-hover:text-amber-700 transition-all">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">📄 Materi</p>
            <div className="space-y-2">
              {MOCK_MATERIALS.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm transition-all">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400">{m.folder}</span>
                      {m.hasAI && <AIBadge />}
                      <span className="text-[10px] text-slate-400">{m.date}</span>
                    </div>
                  </div>
                  <a href="#" className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100 transition-all flex-shrink-0">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    Buka
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STYLE D — Sidebar Tree + Cards
// ─────────────────────────────────────────────────────────────────────────────
function StyleD() {
  const [selected, setSelected] = useState(MOCK_FOLDERS[1]);
  const [openSub, setOpenSub] = useState<string | null>(null);
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-xl bg-white" style={{ height: 420 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100" style={{ background: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)' }}>
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2"><span>📚</span> Materi Training</h2>
          <p className="text-xs text-slate-500 mt-0.5">Learning Management System</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
            <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <span className="text-xs text-slate-400">Cari materi...</span>
          </div>
          <button className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-md" style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)' }}>+ Tambah</button>
        </div>
      </div>

      <div className="flex" style={{ height: 'calc(420px - 62px)' }}>
        {/* Sidebar tree */}
        <div className="w-48 flex-shrink-0 border-r border-slate-100 overflow-y-auto" style={{ background: '#f8fafc' }}>
          <div className="p-2 pt-3">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">Kategori</p>
            {MOCK_FOLDERS.map(f => (
              <div key={f.id}>
                <button onClick={() => { setSelected(f); setOpenSub(null); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left mb-0.5 transition-all ${selected.id === f.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}>
                  <span className="text-sm flex-shrink-0">{f.icon}</span>
                  <span className="text-xs font-semibold truncate flex-1">{f.name}</span>
                  <span className={`text-[10px] font-bold flex-shrink-0 ${selected.id === f.id ? 'text-blue-200' : 'text-slate-400'}`}>{f.items}</span>
                </button>
                {selected.id === f.id && f.sub.length > 0 && (
                  <div className="ml-4 mb-1 space-y-0.5">
                    {f.sub.map(s => (
                      <button key={s} onClick={() => setOpenSub(openSub === s ? null : s)}
                        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left transition-all ${openSub === s ? 'text-blue-600 bg-blue-50 font-bold' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}>
                        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"><path d="M2 7.5C2 6.67 2.67 6 3.5 6H9l2 2h9.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-17C2.67 20 2 19.33 2 18.5v-11z" fill={openSub === s ? '#FCD34D' : '#FBBF24'} stroke="#D97706" strokeWidth="0.8" /></svg>
                        <span className="text-[11px] font-medium truncate">{s}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content area — material cards */}
        <div className="flex-1 overflow-y-auto" style={{ background: '#f8fafc' }}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{selected.icon}</span>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">{selected.name}{openSub ? ` › ${openSub}` : ''}</h3>
                <p className="text-[10px] text-slate-400">{selected.items} materi tersedia</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {MOCK_MATERIALS.map(m => (
                <div key={m.id} className="group rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-md transition-all overflow-hidden">
                  <div className="flex items-start gap-3 p-3.5">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${selected.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-all">{m.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">{m.folder}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {m.hasAI && <AIBadge />}
                        <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">📅 {m.date}</span>
                      </div>
                    </div>
                    <a href="#" className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg text-white shadow-sm flex-shrink-0 transition-all"
                      style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      Buka
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Preview Page
// ─────────────────────────────────────────────────────────────────────────────
export default function MateriStylePreview() {
  const [active, setActive] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const styles = [
    { key: 'A' as const, label: 'A — Dark Explorer', desc: 'Sidebar gelap + content putih', tag: 'VS Code style' },
    { key: 'B' as const, label: 'B — Colorful Hub', desc: 'Gradient folder cards berwarna', tag: 'Google Drive style' },
    { key: 'C' as const, label: 'C — Breadcrumb Nav', desc: 'Drill-down navigation', tag: 'Finder style' },
    { key: 'D' as const, label: 'D — Sidebar + Cards', desc: 'Tree kiri + card besar', tag: 'LMS style' },
  ];

  return (
    <div className="min-h-screen p-8" style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)' }}>
      {/* Page header */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-lg shadow-lg">🎨</div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Style Preview — Materi Training</h1>
            <p className="text-slate-400 text-sm">Klik tab untuk melihat masing-masing style. Semua komponen bisa diklik / diinteraksi.</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
        {/* Tab switcher */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {styles.map(s => (
            <button key={s.key} onClick={() => setActive(s.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${active === s.key
                ? 'bg-white text-slate-900 border-white shadow-lg scale-105'
                : 'border-white/20 text-white/70 hover:bg-white/10 hover:text-white'}`}>
              <span className="text-base">{s.key === 'A' ? '🌑' : s.key === 'B' ? '🌈' : s.key === 'C' ? '🗂️' : '📋'}</span>
              <span>{s.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${active === s.key ? 'bg-blue-100 text-blue-700' : 'bg-white/10 text-white/50'}`}>{s.tag}</span>
            </button>
          ))}
        </div>

        {/* Description */}
        <div className="mb-4 px-4 py-3 rounded-xl border border-white/10 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <span className="text-2xl">{active === 'A' ? '🌑' : active === 'B' ? '🌈' : active === 'C' ? '🗂️' : '📋'}</span>
          <div>
            <p className="text-white font-bold text-sm">{styles.find(s => s.key === active)?.label}</p>
            <p className="text-slate-400 text-xs">{styles.find(s => s.key === active)?.desc} — {styles.find(s => s.key === active)?.tag}</p>
          </div>
          <div className="ml-auto">
            <span className="text-[11px] text-slate-400 bg-white/10 px-2 py-1 rounded-lg">Semua elemen interaktif — klik folder untuk explore</span>
          </div>
        </div>

        {/* Style renderer */}
        {active === 'A' && <StyleA />}
        {active === 'B' && <StyleB />}
        {active === 'C' && <StyleC />}
        {active === 'D' && <StyleD />}

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-slate-500 text-xs">Balas dengan <strong className="text-slate-400">A, B, C, atau D</strong> untuk menerapkan style pilihan ke halaman Materi Training yang sebenarnya</p>
        </div>
      </div>
    </div>
  );
}
