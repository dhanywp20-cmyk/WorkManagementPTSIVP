'use client';
import { MovementLog, fmtDate, splitTypeLines } from './shared';

export function ViewModal({ log, onClose }: { log:MovementLog; onClose:()=>void }) {
  const suratUrls  = log.foto_surat_url  ? log.foto_surat_url.split(',').map(s=>s.trim()).filter(Boolean) : [];
  const barangUrls = log.foto_barang_url ? log.foto_barang_url.split(',').map(s=>s.trim()).filter(Boolean) : [];
  const isMasuk    = log.status_barang==='Masuk';
  const sc         = isMasuk ? {bg:'#d1fae5',text:'#065f46',dot:'#10b981'} : {bg:'#fee2e2',text:'#991b1b',dot:'#ef4444'};
  const typeLines  = splitTypeLines(log.type_barang);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(6px)'}}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}}>📦</span>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Detail Movement Log</h2>
              <p className="text-xs text-gray-500">{fmtDate(log.tanggal,true)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold" style={{background:sc.bg,color:sc.text}}>
              <span className="w-2 h-2 rounded-full" style={{background:sc.dot}}/> Barang {log.status_barang}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-amber-50 text-amber-700">🎯 {log.event}</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {[
              {label:'Tanggal', value:fmtDate(log.tanggal,true), icon:'📅'},
              {label:isMasuk?'PTS (Penerima)':'PTS (Pengirim)', value:log.nama_pts, icon:'👤'},
              {label:isMasuk?'Pengirim (Pihak Luar)':'Penerima (Pihak Luar)', value:log.nama_luar, icon:'🏢'},
              {label:'Project', value:log.project_name, icon:'📋'},
              {label:'Catatan', value:log.catatan, icon:'📝'},
            ].filter(r=>r.value).map(r=>(
              <div key={r.label} className="flex gap-3 px-4 py-3 rounded-xl" style={{background:'#f8fafc',border:'1px solid #e2e8f0'}}>
                <span className="text-base flex-shrink-0">{r.icon}</span>
                <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{r.label}</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5 whitespace-pre-line">{r.value}</p></div>
              </div>
            ))}
            {typeLines.length>0&&(
              <div className="flex gap-3 px-4 py-3 rounded-xl" style={{background:'#f8fafc',border:'1px solid #e2e8f0'}}>
                <span className="text-base flex-shrink-0">📦</span>
                <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Type Barang</p>
                <div className="mt-0.5 space-y-0.5">{typeLines.map((l,i)=><p key={i} className="text-sm font-semibold text-gray-800">{l}</p>)}</div></div>
              </div>
            )}
            {log.serial_number&&(
              <div className="flex gap-3 px-4 py-3 rounded-xl" style={{background:'#f8fafc',border:'1px solid #e2e8f0'}}>
                <span className="text-base flex-shrink-0">🔢</span>
                <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Serial Number</p>
                <p className="text-sm font-semibold text-gray-800 font-mono mt-0.5">{log.serial_number}</p></div>
              </div>
            )}
          </div>
          {suratUrls.length>0&&(
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">📄 Foto Surat Jalan</p>
              <div className="flex flex-wrap gap-2">
                {suratUrls.map((url,i)=>(
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80"
                    style={{background:'linear-gradient(135deg,#3b82f6,#2563eb)',color:'white'}}>🔗 Surat {i+1}</a>
                ))}
              </div>
            </div>
          )}
          {barangUrls.length>0&&(
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">🖼️ Foto Barang</p>
              <div className="flex flex-wrap gap-2">
                {barangUrls.map((url,i)=>(
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80"
                    style={{background:'linear-gradient(135deg,#8b5cf6,#7c3aed)',color:'white'}}>🖼️ Foto {i+1}</a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
