'use client';
import { useRef } from 'react';

export function MultiFileField({ label, icon, files, onAdd, onRemove }: {
  label:string; icon:string; files:File[]; onAdd:(f:File[])=>void; onRemove:(i:number)=>void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{icon} {label}</label>
      <div className="w-full border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all hover:border-amber-400 hover:bg-amber-50/40"
        style={{borderColor:'#e2e8f0',background:'#f8fafc'}}
        onClick={()=>ref.current?.click()}
        onDragOver={e=>e.preventDefault()}
        onDrop={e=>{e.preventDefault();onAdd(Array.from(e.dataTransfer.files));}}>
        <input ref={ref} type="file" multiple accept="image/*,application/pdf" className="hidden"
          onChange={e=>{onAdd(Array.from(e.target.files||[]));if(ref.current)ref.current.value='';}}/>
        <p className="text-xs text-gray-400 font-medium">📎 Klik atau drag file di sini</p>
        <p className="text-[10px] text-gray-300 mt-0.5">Multiple files • Gambar / PDF</p>
      </div>
      {files.length>0&&(
        <div className="mt-2 space-y-1.5">
          {files.map((f,i)=>(
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
              <span className="text-sm">{f.type.startsWith('image/')?'🖼️':'📄'}</span>
              <span className="text-xs font-semibold text-gray-700 flex-1 truncate">{f.name}</span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{(f.size/1024).toFixed(0)} KB</span>
              <button type="button" onClick={()=>onRemove(i)} className="text-red-400 hover:text-red-600 font-bold text-xs flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
