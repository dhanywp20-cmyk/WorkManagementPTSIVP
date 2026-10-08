'use client';

/** ModalPengaturanDasborKPI - dipecah dari app/(portal)/kpi-team/_components/DashboardKPI.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { createPortal } from 'react-dom';
import { IkonTeks } from '@/components/shared/Ikon';
import { KPISettings, DEFAULT_KPI_SETTINGS } from '@/app/(portal)/kpi-team/_components/shared';
import React from 'react';

export interface ModalPengaturanDasborKPIProps {
  kpiSettings: KPISettings;
  saveKpiSettings: (s: KPISettings) => Promise<void>;
  setKpiSettings: React.Dispatch<React.SetStateAction<KPISettings>>;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
  showSettings: boolean;
}

export function ModalPengaturanDasborKPI({ kpiSettings, saveKpiSettings, setKpiSettings, setShowSettings, showSettings }: ModalPengaturanDasborKPIProps) {
  return (
    <>
      {showSettings && typeof document !== 'undefined' && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Pengaturan KPI" className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <div className="font-bold text-slate-800 text-base"><IkonTeks nama="⚙" />Pengaturan KPI</div>
                <div className="text-sm text-slate-500 mt-0.5">Atur batas & bobot masing-masing komponen</div>
              </div>
              <button aria-label="Tutup" onClick={()=>setShowSettings(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100">×</button>
            </div>
            <div className="p-6 space-y-5">
              {/* LC Min Score */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1.5 uppercase tracking-wide"><IkonTeks nama="🎓" />Learning Center — Batas Nilai Minimum</label>
                <div className="flex items-center gap-3">
                  <input aria-label="🎓 Learning Center — Batas Nilai Minimum" type="range" min={40} max={85} step={5} value={kpiSettings.lcMinScore}
                    onChange={e=>setKpiSettings(p=>({...p, lcMinScore:Number(e.target.value)}))}
                    className="flex-1 accent-violet-600"/>
                  <span className="text-lg font-black text-violet-600 w-12 text-right">&lt;{kpiSettings.lcMinScore}</span>
                </div>
                <div className="text-sm text-slate-500 mt-1">Nilai di bawah ini dianggap tidak lulus KPI LC</div>
              </div>
              {/* RnD Target */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1.5 uppercase tracking-wide"><IkonTeks nama="📝" />R&D Tech Note — Target per Tahun</label>
                <div className="flex items-center gap-3">
                  <input aria-label="📝 R&D Tech Note — Target per Tahun" type="range" min={1} max={8} step={1} value={kpiSettings.rndTarget}
                    onChange={e=>setKpiSettings(p=>({...p, rndTarget:Number(e.target.value)}))}
                    className="flex-1 accent-pink-600"/>
                  <span className="text-lg font-black text-pink-600 w-12 text-right">{kpiSettings.rndTarget}x</span>
                </div>
                <div className="text-sm text-slate-500 mt-1">Minimal Tech Note approved per tahun untuk nilai penuh</div>
              </div>
              {/* Bobot section */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-3 uppercase tracking-wide"><IkonTeks nama="📊" />Bobot Komponen KPI (total harus 100%)</label>
                <div className="space-y-3">
                  {([
                    {key:'ticketOverdueWeight', label:'🎫 Ticketing', color:'#ef4444'},
                    {key:'bastWeight', label:'⭐ BAST & Demo', color:'#f59e0b'},
                    {key:'lcWeight', label:'🎓 Learning Center', color:'#6366f1'},
                    {key:'rndWeight', label:'📝 R&D Tech Note', color:'#ec4899'},
                  ] as {key: keyof KPISettings, label:string, color:string}[]).map(item=>(
                    <div key={item.key} className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-600 w-36 flex-shrink-0">{item.label}</span>
                      <input aria-label="Bobot KPI" type="range" min={5} max={60} step={5} value={Math.round((kpiSettings[item.key] as number)*100)}
                        onChange={e=>setKpiSettings(p=>({...p, [item.key]:Number(e.target.value)/100}))}
                        className="flex-1" style={{accentColor:item.color}}/>
                      <span className="text-sm font-black w-10 text-right" style={{color:item.color}}>
                        {Math.round((kpiSettings[item.key] as number)*100)}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Total bobot sekarang:</span>
                  <span className={`text-sm font-black ${Math.round((kpiSettings.ticketOverdueWeight+kpiSettings.bastWeight+kpiSettings.lcWeight+kpiSettings.rndWeight)*100)===100?'text-emerald-700':'text-red-500'}`}>
                    {Math.round((kpiSettings.ticketOverdueWeight+kpiSettings.bastWeight+kpiSettings.lcWeight+kpiSettings.rndWeight)*100)}%
                    {Math.round((kpiSettings.ticketOverdueWeight+kpiSettings.bastWeight+kpiSettings.lcWeight+kpiSettings.rndWeight)*100)===100?' ✓':' ⚠ harus 100%'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5 justify-end">
              <button onClick={()=>{
                  setKpiSettings(DEFAULT_KPI_SETTINGS);
                  saveKpiSettings(DEFAULT_KPI_SETTINGS);
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
                Reset Default
              </button>
              <button onClick={()=>{ saveKpiSettings(kpiSettings); setShowSettings(false); }}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors"
                style={{background:'linear-gradient(135deg,#7c3aed,#6d28d9)'}}>
                ✓ Simpan & Tutup
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
