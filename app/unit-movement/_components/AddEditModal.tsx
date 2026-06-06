'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User, MovementLog, EVENTS, uploadFiles } from './shared';
import { MultiFileField } from './MultiFileField';
import { UrlListField } from './UrlListField';

export function AddEditModal({ log, currentUser, teamMembers, onClose, onSave }: {
  log?:MovementLog|null; currentUser:User; teamMembers:string[]; onClose:()=>void; onSave:()=>void;
}) {
  const isEdit = !!log;
  const [form, setForm] = useState({
    tanggal:        log?.tanggal?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    status_barang:  (log?.status_barang ?? 'Keluar') as 'Masuk'|'Keluar',
    nama_pts:       log?.nama_pts      ?? '',
    nama_luar:      log?.nama_luar     ?? '',
    event:          log?.event         ?? 'Project',
    project_name:   log?.project_name  ?? '',
    type_barang:    log?.type_barang   ?? '',
    serial_number:  log?.serial_number ?? '',
    catatan:        log?.catatan       ?? '',
    foto_surat_url:  log?.foto_surat_url  ?? '',
    foto_barang_url: log?.foto_barang_url ?? '',
  });
  const [suratFiles,  setSuratFiles]  = useState<File[]>([]);
  const [barangFiles, setBarangFiles] = useState<File[]>([]);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState('');

  const set = (k:string,v:string) => setForm(p=>({...p,[k]:v}));
  const isMasuk = form.status_barang==='Masuk';
  const inp = "w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all border border-gray-200 bg-gray-50 focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100";
  const lbl = "block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5";

  const handleSave = async () => {
    if (!form.tanggal||!form.nama_pts||!form.project_name) { setError('Tanggal, Nama PTS, dan Project wajib diisi!'); return; }
    setSaving(true); setUploading(true); setError('');
    try {
      let suratUrl  = form.foto_surat_url;
      let barangUrl = form.foto_barang_url;
      if (suratFiles.length>0) {
        const uploaded = await uploadFiles(suratFiles,'surat');
        const existing = suratUrl ? suratUrl.split(',').map(s=>s.trim()).filter(Boolean) : [];
        suratUrl = [...existing,...uploaded].join(',');
      }
      if (barangFiles.length>0) {
        const uploaded = await uploadFiles(barangFiles,'barang');
        const existing = barangUrl ? barangUrl.split(',').map(s=>s.trim()).filter(Boolean) : [];
        barangUrl = [...existing,...uploaded].join(',');
      }
      setUploading(false);
      const payload = { tanggal:form.tanggal, status_barang:form.status_barang, nama_pts:form.nama_pts, nama_luar:form.nama_luar, event:form.event, project_name:form.project_name, type_barang:form.type_barang, serial_number:form.serial_number, catatan:form.catatan, foto_surat_url:suratUrl, foto_barang_url:barangUrl, created_by:currentUser.username };
      if (isEdit) { const {error:e}=await supabase.from('movement_logs').update(payload).eq('id',log!.id); if(e)throw e; }
      else        { const {error:e}=await supabase.from('movement_logs').insert([payload]); if(e)throw e; }
      onSave();
    } catch(e:any) { setError('Gagal: '+e.message); setSaving(false); setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(6px)'}}>
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}}>{isEdit?'✏️':'➕'}</span>
            <h2 className="font-bold text-gray-900">{isEdit?'Edit Movement Log':'Tambah Movement Log'}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {error&&<div className="px-4 py-3 rounded-xl text-sm font-semibold text-red-700 bg-red-50 border border-red-200">{error}</div>}

          <div><label className={lbl}>📅 Tanggal In/Out</label>
            <input type="date" className={inp} value={form.tanggal} onChange={e=>set('tanggal',e.target.value)}/></div>

          <div><label className={lbl}>📦 Status Barang</label>
            <div className="flex gap-2">
              {(['Masuk','Keluar'] as const).map(s=>(
                <button key={s} type="button" onClick={()=>set('status_barang',s)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border-2"
                  style={form.status_barang===s ? (s==='Masuk'?{background:'#d1fae5',color:'#065f46',borderColor:'#10b981'}:{background:'#fee2e2',color:'#991b1b',borderColor:'#ef4444'}) : {background:'#f8fafc',color:'#64748b',borderColor:'#e2e8f0'}}>
                  {s==='Masuk'?'📥':'📤'} {s}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl space-y-3" style={{background:'#fffbeb',border:'1px solid #fde68a'}}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
              {isMasuk?'📥 PTS = Penerima — Pengirim adalah Pihak Luar':'📤 PTS = Pengirim — Penerima adalah Pihak Luar'}
            </p>
            <div><label className={lbl}>{isMasuk?'👤 Nama PTS (Penerima)':'👤 Nama PTS (Pengirim)'}</label>
              <select className={inp+" cursor-pointer"} value={form.nama_pts} onChange={e=>set('nama_pts',e.target.value)}>
                <option value="">-- Pilih Anggota PTS --</option>
                {teamMembers.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div><label className={lbl}>{isMasuk?'🏢 Pengirim (Pihak Luar)':'🏢 Penerima (Pihak Luar)'}</label>
              <input type="text" className={inp} placeholder="Nama pihak luar..." value={form.nama_luar} onChange={e=>set('nama_luar',e.target.value)}/></div>
          </div>

          <div><label className={lbl}>📋 Nama Project</label>
            <input type="text" className={inp} placeholder="Nama project..." value={form.project_name} onChange={e=>set('project_name',e.target.value)}/></div>

          <div><label className={lbl}>🎯 Event</label>
            <select className={inp+" cursor-pointer"} value={form.event} onChange={e=>set('event',e.target.value)}>
              {EVENTS.map(ev=><option key={ev} value={ev}>{ev}</option>)}
            </select>
          </div>

          <div><label className={lbl}>📦 Type Barang</label>
            <textarea className={inp+" resize-none"} rows={3} placeholder="Nama / tipe barang (satu per baris jika multiple)..." value={form.type_barang} onChange={e=>set('type_barang',e.target.value)}/></div>

          <div><label className={lbl}>🔢 Serial Number</label>
            <input type="text" className={inp} placeholder="Serial number..." value={form.serial_number} onChange={e=>set('serial_number',e.target.value)}/></div>

          <div><label className={lbl}>📝 Catatan</label>
            <textarea className={inp+" resize-none"} rows={3} placeholder="Keterangan tambahan..." value={form.catatan} onChange={e=>set('catatan',e.target.value)}/></div>

          {/* Foto Surat: upload file */}
          <MultiFileField label="Upload Foto Surat Jalan" icon="📄" files={suratFiles}
            onAdd={f=>setSuratFiles(p=>[...p,...f])} onRemove={i=>setSuratFiles(p=>p.filter((_,idx)=>idx!==i))}/>

          {/* Foto Surat: link Google Drive */}
          <UrlListField label="Link Foto Surat Jalan (Google Drive / URL)" icon="🔗"
            value={form.foto_surat_url} onChange={v=>set('foto_surat_url',v)}/>

          {/* Foto Barang: upload file */}
          <MultiFileField label="Upload Foto Barang" icon="🖼️" files={barangFiles}
            onAdd={f=>setBarangFiles(p=>[...p,...f])} onRemove={i=>setBarangFiles(p=>p.filter((_,idx)=>idx!==i))}/>

          {/* Foto Barang: link Google Drive */}
          <UrlListField label="Link Foto Barang (Google Drive / URL)" icon="🔗"
            value={form.foto_barang_url} onChange={v=>set('foto_barang_url',v)}/>

          <div className="px-4 py-3 rounded-xl text-xs text-blue-700 bg-blue-50 border border-blue-100">
            <p className="font-bold mb-1">💡 Cara pakai Google Drive link</p>
            <p>Buka file di Google Drive → klik kanan → <strong>Get link</strong> → ubah akses ke <strong>Anyone with the link</strong> → copy URL → paste di kolom Link di atas.</p>
          </div>

          {uploading&&(
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <div className="w-4 h-4 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin flex-shrink-0"/>
              <span className="text-xs font-semibold text-amber-700">Mengupload file ke Supabase Storage...</span>
            </div>
          )}

          <button type="button" onClick={handleSave} disabled={saving}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{background:'linear-gradient(135deg,#f59e0b,#d97706)',boxShadow:'0 4px 14px rgba(245,158,11,0.35)'}}>
            {saving?'⏳ Menyimpan...':isEdit?'💾 Simpan Perubahan':'➕ Tambah Log'}
          </button>
        </div>
      </div>
    </div>
  );
}
