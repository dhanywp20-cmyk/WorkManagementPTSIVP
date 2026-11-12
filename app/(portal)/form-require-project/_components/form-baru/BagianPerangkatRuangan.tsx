'use client';

import type { Dispatch, SetStateAction } from 'react';
import { type InitialFormType } from '../Modals';

export interface BagianPerangkatRuanganProps {
  setForm: Dispatch<SetStateAction<InitialFormType>>;
  form: InitialFormType;
}

export function BagianPerangkatRuangan({
  setForm, form,
}: BagianPerangkatRuanganProps) {
  return (
    <div className="mb-4 pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
    <div>
      <div className="mb-4">
        <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Wireless Presentation</label>
        <div className="flex flex-wrap gap-2">
          {['Yes','No'].map(opt => <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, wireless_presentation: opt }))}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${form.wireless_presentation === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${form.wireless_presentation === opt ? 'border-teal-500' : 'border-gray-400'}`}>{form.wireless_presentation === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
            {opt}
          </button>)}
        </div>
      </div>
      {form.wireless_presentation === 'Yes' && <div className="ml-4 mb-4 space-y-3 border-l-2 border-teal-200 pl-4">
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Wireless Mode</label>
          <div className="flex flex-wrap gap-2">
            {['Aplikasi','AirPlay','Miracast','Chromecast','BYOM'].map(opt => {
              const active = form.wireless_mode.includes(opt);
              return <button aria-pressed={active} key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, wireless_mode: active ? prev.wireless_mode.filter(x=>x!==opt) : [...prev.wireless_mode,opt] }))}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0 ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>{active && 
                  <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>}</div>
                {opt}
              </button>;
            })}
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Dongle</label>
          <div className="flex flex-wrap gap-2">
            {['Yes','No'].map(opt => <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, wireless_dongle: opt }))}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${form.wireless_dongle === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${form.wireless_dongle === opt ? 'border-teal-500' : 'border-gray-400'}`}>{form.wireless_dongle === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
              {opt}
            </button>)}
          </div>
        </div>
      </div>}
    </div>
    
    <div>
      <div className="mb-4">
        <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Controller / Automation</label>
        <div className="flex flex-wrap gap-2">
          {['Yes','No'].map(opt => <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, controller_automation: opt }))}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${form.controller_automation === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${form.controller_automation === opt ? 'border-teal-500' : 'border-gray-400'}`}>{form.controller_automation === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
            {opt}
          </button>)}
        </div>
      </div>
      {form.controller_automation === 'Yes' && <div className="ml-4 mb-4 border-l-2 border-teal-200 pl-4">
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Controller Type</label>
          <div className="flex flex-wrap gap-2">
            {['Cue','Wyrestorm','Extron','Custom'].map(opt => {
              const active = form.controller_type.includes(opt);
              return <button aria-pressed={active} key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, controller_type: active ? prev.controller_type.filter(x=>x!==opt) : [...prev.controller_type,opt] }))}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0 ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>{active && 
                  <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>}</div>
                {opt}
              </button>;
            })}
          </div>
        </div>
      </div>}
    </div>
    </div>
  );
}
