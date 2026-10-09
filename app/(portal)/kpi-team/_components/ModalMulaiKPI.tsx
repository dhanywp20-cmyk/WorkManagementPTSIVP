'use client';

/** ModalMulaiKPI - dipecah dari app/(portal)/kpi-team/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { createPortal } from 'react-dom';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import React from 'react';
import { KPIMember, KPISettings } from './shared';

export interface ModalMulaiKPIProps {
  kpiMembers: KPIMember[];
  kpiPeriodLabel: string;
  kpiSettings: KPISettings;
  kpiYear: number;
  saveKPISnapshot: () => Promise<void>;
  savingSnapshot: boolean;
  setShowStartKPI: React.Dispatch<React.SetStateAction<boolean>>;
  showStartKPI: boolean;
}

export function ModalMulaiKPI({ kpiMembers, kpiPeriodLabel, kpiSettings, kpiYear, saveKPISnapshot, savingSnapshot, setShowStartKPI, showStartKPI }: ModalMulaiKPIProps) {
  return (
    <>
      {showStartKPI && typeof document !== 'undefined' && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Mulai periode KPI" className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowStartKPI(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}><Ikon nama="🚀" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
              <div>
                <div className="font-bold text-slate-800 text-base">Mulai KPI {kpiYear}</div>
                <div className="text-xs text-slate-500 mt-0.5">Simpan snapshot penilaian KPI periode ini</div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl p-4 text-sm text-slate-600 leading-relaxed" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                <b><IkonTeks nama="📋" />Ringkasan yang akan disimpan:</b>
                <ul className="mt-2 space-y-1 list-disc list-inside text-slate-500">
                  <li>Periode: <b className="text-slate-700">{kpiPeriodLabel}</b></li>
                  <li>Anggota: <b className="text-slate-700">{kpiMembers.length} orang</b></li>
                  <li>Bobot: 🎫{Math.round(kpiSettings.ticketOverdueWeight*100)}% ⭐{Math.round(kpiSettings.bastWeight*100)}% 🎓{Math.round(kpiSettings.lcWeight*100)}% 📝{Math.round(kpiSettings.rndWeight*100)}%</li>
                </ul>
              </div>
              <p className="text-sm text-slate-500">
                Data KPI akan dibekukan dan disimpan ke Riwayat KPI. Proses ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-5 justify-end">
              <button onClick={() => setShowStartKPI(false)} disabled={savingSnapshot}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
                Batal
              </button>
              <button onClick={() => saveKPISnapshot()} disabled={savingSnapshot}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 2px 8px rgba(16,185,129,0.4)' }}>
                {savingSnapshot ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan…</>
                ) : (
                  <>🚀 Simpan KPI</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
