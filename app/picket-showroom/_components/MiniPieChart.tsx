'use client';
import { useState } from 'react';

export function MiniPieChart({data,title,icon,activeFilter,onSliceClick}:{
  data:{label:string;value:number;color:string}[];title:string;icon:string;
  activeFilter?:string|null;onSliceClick?:(l:string)=>void;
}) {
  const [hov,setHov]=useState<number|null>(null);
  const total=data.reduce((s,d)=>s+d.value,0);
  if(!total) return(
    <div className="rounded-2xl p-4" style={{background:'rgba(255,255,255,0.95)',border:'1px solid rgba(255,255,255,0.8)'}}>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{icon} {title}</p>
      <p className="text-gray-400 text-sm text-center py-4">Belum ada data</p>
    </div>
  );
  let cum=-Math.PI/2;
  const cx=60,cy=60,r=50,ir=28;
  const slices=data.map((d,i)=>{
    const angle=(d.value/total)*2*Math.PI;
    if(data.length===1){cum+=angle;return{...d,path:'',full:true,i};}
    const x1=cx+r*Math.cos(cum),y1=cy+r*Math.sin(cum),x2=cx+r*Math.cos(cum+angle),y2=cy+r*Math.sin(cum+angle);
    const xi1=cx+ir*Math.cos(cum),yi1=cy+ir*Math.sin(cum),xi2=cx+ir*Math.cos(cum+angle),yi2=cy+ir*Math.sin(cum+angle);
    const lg=angle>Math.PI?1:0;
    const path=`M ${xi1} ${yi1} L ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ir} ${ir} 0 ${lg} 0 ${xi1} ${yi1} Z`;
    cum+=angle;return{...d,path,full:false,i};
  });
  return(
    <div className="rounded-2xl p-4" style={{background:'rgba(255,255,255,0.95)',border:'1px solid rgba(255,255,255,0.8)'}}>
      <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">{icon} {title}</p>
      <div className="flex items-center gap-3">
        <svg width="120" height="120" viewBox="0 0 120 120" className="flex-shrink-0">
          {slices.map(s=>s.full?(
            <g key={s.i} style={{cursor:onSliceClick?'pointer':'default'}} onClick={()=>onSliceClick?.(s.label)} onMouseEnter={()=>setHov(s.i)} onMouseLeave={()=>setHov(null)}>
              <circle cx={60} cy={60} r={50} fill={s.color} opacity={hov===null||hov===s.i?1:0.45} style={{filter:hov===s.i||activeFilter===s.label?`drop-shadow(0 0 5px ${s.color})`:'none'}}/>
              <circle cx={60} cy={60} r={28} fill="white"/>
            </g>
          ):(
            <path key={s.i} d={s.path} fill={s.color} opacity={hov===null||hov===s.i?1:0.45}
              style={{cursor:onSliceClick?'pointer':'default',transition:'opacity 0.15s',filter:hov===s.i||activeFilter===s.label?`drop-shadow(0 0 5px ${s.color})`:'none'}}
              onMouseEnter={()=>setHov(s.i)} onMouseLeave={()=>setHov(null)} onClick={()=>onSliceClick?.(s.label)}/>
          ))}
          <text x="60" y="57" textAnchor="middle" fontSize="16" fontWeight="800" fill="#1e293b">{total}</text>
          <text x="60" y="70" textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="600">TOTAL</text>
        </svg>
        <div className="flex flex-col gap-1 flex-1 min-w-0 max-h-[120px] overflow-y-auto">
          {slices.map(s=>{
            const isActive=activeFilter===s.label;
            return(
              <div key={s.i} className="flex items-center gap-1.5 cursor-pointer rounded-lg px-1.5 py-0.5 transition-all"
                style={{background:hov===s.i||isActive?`${s.color}20`:'transparent',outline:isActive?`1.5px solid ${s.color}`:'none'}}
                onMouseEnter={()=>setHov(s.i)} onMouseLeave={()=>setHov(null)} onClick={()=>onSliceClick?.(s.label)}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:s.color}}/>
                <span className="text-[10px] font-semibold text-gray-600 truncate flex-1">{s.label}</span>
                <span className="text-[10px] font-bold" style={{color:s.color}}>{s.value}</span>
                {isActive&&<span className="text-[9px] font-bold text-purple-600">✓</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
