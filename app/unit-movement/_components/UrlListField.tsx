'use client';
import { useState } from 'react';

export function UrlListField({ label, icon, value, onChange }: {
  label:string; icon:string; value:string; onChange:(v:string)=>void;
}) {
  const urls = value ? value.split(',').map(s=>s.trim()).filter(Boolean) : [];
  const [input,setInput] = useState('');
  const add = () => { const u=input.trim(); if(!u)return; onChange([...urls,u].join(',')); setInput(''); };
  const remove = (i:number) => onChange(urls.filter((_,idx)=>idx!==i).join(','));
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{icon} {label}</label>
      <div className="flex gap-2">
        <input type="text"
          className="flex-1 px-3 py-2.5 rounded-xl text-xs outline-none transition-all border border-gray-200 bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          placeholder="Paste link Google Drive / URL..."
          value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),add())}/>
        <button type="button" onClick={add}
          className="px-3 py-2.5 rounded-xl text-xs font-bold text-white flex-shrink-0"
          style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}}>
          + Tambah
        </button>
      </div>
      <p className="text-[10px] text-gray-400 mt-1">Enter atau klik Tambah untuk menyimpan link</p>
      {urls.length>0&&(
        <div className="mt-2 space-y-1.5">
          {urls.map((url,i)=>(
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
              <span className="text-sm">🔗</span>
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="text-xs font-semibold text-blue-600 flex-1 truncate hover:underline">{url}</a>
              <button type="button" onClick={()=>remove(i)} className="text-red-400 hover:text-red-600 font-bold text-xs flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
