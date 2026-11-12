'use client';
import { isPimpinan } from '@/lib/pimpinan';
import { User } from './shared';
import { ModalPortal } from '@/components/shared';
import { Ikon } from '@/components/shared/Ikon';
import { TYPE_CONFIG, ALL_TYPES, type ResultType } from './cari-global-tipe';
import { useGlobalSearch } from './useGlobalSearch';

export default function GlobalSearch({ currentUser, onNavigate }: {
  currentUser: User;
  onNavigate?: (url: string, query: string, type: ResultType) => void;
}) {
  const {
    open, setOpen, inputRef, query, setQuery, loading, results, setActiveType,
    activeType, typeCounts, listRef, filtered, selected, handleSelect, setSelected, isAdmin,
    isPTSsup, isSalesSup,
  } = useGlobalSearch({ currentUser, onNavigate });

  if (!open) return (
    <button aria-label="Pencarian semua platform (Ctrl+K)" onClick={() => setOpen(true)}
      className="flex items-center justify-center gap-1.5 h-10 w-10 sm:w-auto sm:px-3 rounded-xl transition-all hover:shadow-md"
      style={{ background: 'rgba(15,23,42,0.06)', border: '1.5px solid rgba(15,23,42,0.12)', color: '#475569' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15,23,42,0.12)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(15,23,42,0.22)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15,23,42,0.06)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(15,23,42,0.12)'; }}
      title="Pencarian semua platform (Ctrl+K)">
      <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <span className="hidden sm:inline text-sm font-bold text-slate-600 whitespace-nowrap">Pencarian</span>
      <kbd className="hidden lg:inline text-[11px] font-bold text-slate-500 border border-slate-300 rounded-sm px-1 py-0.5 leading-none">⌘K</kbd>
    </button>
  );

  return (
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-1000 flex items-start justify-center pt-[12vh] px-4"
      onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>

      <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'rgba(255,255,255,0.98)', border: '1.5px solid rgba(0,0,0,0.1)', animation: 'dropIn 0.18s ease-out' }}>

        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input aria-label="Cari ticket, reminder, project, piket, unit, user..." ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Cari ticket, reminder, project, piket, unit, user..."
            className="flex-1 text-sm font-medium text-slate-800 outline-hidden bg-transparent placeholder-slate-400"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          <button onClick={() => setOpen(false)}
            className="text-[11px] font-bold text-slate-500 px-1.5 py-0.5 rounded-sm border border-slate-200 hover:bg-slate-100 transition-all shrink-0">
            ESC
          </button>
        </div>

        {results.length > 0 && (
          <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 overflow-x-auto">
            <button onClick={() => setActiveType('all')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition-all"
              style={activeType === 'all'
                ? { background: '#0f172a', color: 'white' }
                : { background: '#f1f5f9', color: '#64748b' }}>
              Semua ({results.length})
            </button>
            {ALL_TYPES.filter(t => typeCounts[t] > 0).map(t => (
              <button key={t} onClick={() => setActiveType(t)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 transition-all"
                style={activeType === t
                  ? { background: TYPE_CONFIG[t].color, color: 'white' }
                  : { background: TYPE_CONFIG[t].bg, color: TYPE_CONFIG[t].color }}>
                {TYPE_CONFIG[t].label} ({typeCounts[t]})
              </button>
            ))}
          </div>
        )}

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto">
          {!query.trim() ? (
            <div className="px-4 py-8 text-center">
              <div className="text-4xl mb-3"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
              <p className="text-sm font-semibold text-slate-600">Cari di seluruh platform</p>
              <p className="text-[11px] text-slate-500 mt-1">Ticket · Reminder · Project · Piket · Unit Movement · User</p>
              <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded-sm border border-slate-200 font-mono">↑↓</kbd> navigasi</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded-sm border border-slate-200 font-mono">↵</kbd> buka</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded-sm border border-slate-200 font-mono">ESC</kbd> tutup</span>
              </div>
            </div>
          ) : loading && results.length === 0 ? (
            <div className="space-y-2 p-3">
              {[1,2,3].map(i => (
                <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-50 animate-pulse">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-slate-200 rounded-sm w-48" />
                    <div className="h-2.5 bg-slate-100 rounded-sm w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="text-3xl mb-2">😶</div>
              <p className="text-sm text-slate-500">Tidak ada hasil untuk <b>"{query}"</b></p>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {filtered.map((r, i) => {
                const cfg = TYPE_CONFIG[r.type as ResultType] ?? { label: r.type, color: '#64748b', bg: '#f1f5f9' };
                const isSelected = i === selected;
                return (
                  <button key={r.id} onClick={() => handleSelect(r)}
                    onMouseEnter={() => setSelected(i)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={isSelected
                      ? { background: '#f1f5f9', outline: `2px solid ${cfg.color}22` }
                      : { background: 'transparent' }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                      style={{ background: cfg.bg }}>
                      <Ikon nama={r.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 truncate">{r.title}</span>
                        {r.badge && (
                          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                            style={{ background: `${r.badgeColor}18`, color: r.badgeColor }}>
                            {r.badge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-500 truncate">{r.sub}</span>
                        {r.meta && <span className="text-[11px] text-slate-500 shrink-0">· {r.meta}</span>}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                    {isSelected && r.url && (
                      <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: cfg.color }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {results.length > 0 ? `${results.length} hasil ditemukan` : 'Ketik untuk mulai pencarian'}
          </span>
          <span className="text-[11px] text-slate-500">
            {isAdmin || isPimpinan(currentUser) ? 'Semua data' : isPTSsup ? `Scope: ${currentUser.team_type}` : isSalesSup ? 'Scope: divisi Anda' : 'Data Anda'}
          </span>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}
