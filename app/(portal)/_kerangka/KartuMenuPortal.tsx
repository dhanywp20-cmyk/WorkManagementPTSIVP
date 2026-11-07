'use client';
import type { MenuItem } from '../dashboard/_components/shared';
import { Ikon } from '@/components/shared/Ikon';

type ItemMenu = MenuItem['items'][0];

export function KartuMenuPortal({ menu, index, onMenuClick }: {
  menu: MenuItem; index: number; onMenuClick: (item: ItemMenu, menuTitle?: string) => void;
}) {
  const isSingleInternal = menu.items.length === 1 && menu.items[0].internal;
  return (
    <div
      className={`rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white ${isSingleInternal ? 'cursor-pointer group' : ''}`}
      style={{ animation: `fadeInUp 0.5s ease forwards`, animationDelay: `${index * 80}ms`, opacity: 0 }}
      onClick={isSingleInternal ? () => onMenuClick(menu.items[0], menu.title) : undefined}
    >
      <div className={`bg-linear-to-br ${menu.gradient} ${isSingleInternal ? 'p-6 md:p-8' : 'p-5 md:p-6'} relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white" />
          <div className="absolute -left-2 -bottom-2 w-16 h-16 rounded-full bg-white" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-4xl"><Ikon nama={menu.icon} ukuran="1.1em" className="inline-block align-[-0.18em]" /></div>
            <h3 className="text-xl font-bold tracking-tight text-white leading-tight">{menu.title}</h3>
          </div>
          <p className="text-white/90 text-sm font-medium line-clamp-2">{menu.description}</p>
        </div>
      </div>
      {!isSingleInternal && (
        <div className="p-5 space-y-3">
          {menu.items.map((item, itemIndex) => (
            <button key={itemIndex} onClick={e => { e.stopPropagation(); onMenuClick(item, menu.title); }}
              className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-800 px-5 py-4 rounded-md font-semibold shadow-xs hover:shadow-md transition-all text-right flex items-center justify-end gap-4 group/item">
              {item.external && !item.embed ? (
                <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              ) : (
                <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-slate-500 transition-transform group-hover/item:-translate-x-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              )}
              <span className="flex-1 text-sm tracking-wide text-right">{item.name}</span>
              <div className="w-10 h-10 bg-white rounded-md shadow-xs flex items-center justify-center text-xl border border-slate-200 text-slate-600 group-hover/item:scale-110 transition-transform shrink-0"><Ikon nama={item.icon} ukuran={20} /></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function GridMenuPortal({ learningMenuItems, projectMenuItems, internalMenuItems, onMenuClick }: {
  learningMenuItems: MenuItem[]; projectMenuItems: MenuItem[]; internalMenuItems: MenuItem[];
  onMenuClick: (item: ItemMenu, menuTitle?: string) => void;
}) {
  return (
    <>
      {learningMenuItems.length > 0 && (
        <div style={{ animation: 'fadeInUp 0.45s ease 0.2s forwards', opacity: 0 }}>
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-xl"
            style={{ background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(8px)', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #60a5fa, #4338ca)' }}>
              <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <span className="text-white font-bold text-sm tracking-wide">Learning Center</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {learningMenuItems.map((menu, i) => <KartuMenuPortal key={menu.key} menu={menu} index={i} onMenuClick={onMenuClick} />)}
          </div>
        </div>
      )}
      {projectMenuItems.length > 0 && (
        <div style={{ animation: 'fadeInUp 0.45s ease forwards', opacity: 0 }}>
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-xl"
            style={{ background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(8px)', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #38bdf8, #0284c7)' }}>
              <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-white font-bold text-sm tracking-wide">Project</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {projectMenuItems.map((menu, i) => <KartuMenuPortal key={menu.key} menu={menu} index={i} onMenuClick={onMenuClick} />)}
          </div>
        </div>
      )}
      
      {internalMenuItems.length > 0 && (
        <div style={{ animation: 'fadeInUp 0.45s ease 0.1s forwards', opacity: 0 }}>
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-xl"
            style={{ background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(8px)', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #34d399, #059669)' }}>
              <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-white font-bold text-sm tracking-wide">Internal Daily</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {internalMenuItems.map((menu, i) => <KartuMenuPortal key={menu.key} menu={menu} index={i} onMenuClick={onMenuClick} />)}
          </div>
        </div>
      )}
    </>
  );
}
