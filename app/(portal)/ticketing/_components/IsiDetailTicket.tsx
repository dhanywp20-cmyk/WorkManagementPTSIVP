'use client';

import type { Dispatch, SetStateAction } from 'react';
import { TombolTugaskan } from '@/components/shared';
import { InfoLine } from './DonutCards';
import type { Ticket, User } from './shared';
import { formatDateTime, statusColors, ringkasPenanganan, bolehReroute, adalahPending } from './shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { SolusiSerupa } from './SolusiSerupa';
import { jejakProgres } from '@/lib/alur-status-ticket';

export interface IsiDetailTicketProps {
  selectedTicket: Ticket;
  currentUser: User | null;
  setSupAssignTicket: Dispatch<SetStateAction<Ticket | null>>;
  setSupAssignTo: Dispatch<SetStateAction<string>>;
  canManageTickets: boolean;
  bukaAdminEdit: (t: Ticket) => void;
  getDeadline: (t: Ticket) => Date | null;
  users: User[];
  getWarrantyInfo: (projectName: string) => { isIn: boolean; diffDays: number; wy: number; bastStr: string; expiryStr: string; } | null;
}

export function IsiDetailTicket({
  selectedTicket, currentUser, setSupAssignTicket, setSupAssignTo, canManageTickets, bukaAdminEdit, getDeadline, users,
  getWarrantyInfo,
}: IsiDetailTicketProps) {
  return (
    <div className="overflow-y-auto flex-1 min-h-0">
      {selectedTicket.routing_status === "supervisor_assign" && selectedTicket.assigned_supervisor_id === currentUser?.id && (
        <div className="mx-4 mt-3 rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(245,158,11,0.1)", border: "1.5px solid rgba(245,158,11,0.4)" }}>
          <span className="text-2xl"><Ikon nama="🎯" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-800">Ticket ini menunggu kamu tugaskan ke tim</p>
            <p className="text-[11px] text-amber-700">Sudah disetujui Admin — pilih anggota tim atau kerjakan sendiri.</p>
          </div>
          <TombolTugaskan ukuran="kecil" className="shrink-0" onClick={() => { setSupAssignTicket(selectedTicket); setSupAssignTo(""); }}>Tugaskan Tim</TombolTugaskan>
        </div>
      )}
      {canManageTickets && (
        <div className="mx-4 mt-3 rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(99,102,241,0.08)', border: '1.5px solid rgba(99,102,241,0.25)' }}>
          <span className="text-2xl"><Ikon nama="🛠" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-indigo-800">Koreksi data ticket</p>
            <p className="text-[11px] text-indigo-700">
              {bolehReroute(selectedTicket)
                ? 'Betulkan detail atau alihkan ke supervisor/tim lain.'
                : 'Detail bisa dibetulkan. Pengalihan tidak tersedia — pengerjaannya sudah jalan.'}
            </p>
          </div>
          <button onClick={() => bukaAdminEdit(selectedTicket)}
            className="tombol-kedua shrink-0 px-3 py-2 rounded-kontrol text-xs font-bold">
            <IkonTeks nama="🛠" />Edit &amp; Re-route
          </button>
        </div>
      )}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Progress</p>
          {adalahPending(selectedTicket.status) && (() => {
            const dl = getDeadline(selectedTicket);
            if (!dl) return null;
            const sisaHari = Math.ceil((dl.getTime() - Date.now()) / 86400000);
            const lewat = sisaHari < 0;
            return (
              <span className="text-[11px] font-bold px-2 py-1 rounded-full border"
                style={lewat
                  ? { background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.3)', color: '#b91c1c' }
                  : { background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.35)', color: '#b45309' }}>
                {selectedTicket.status} · {lewat
                  ? `lewat ${Math.abs(sisaHari)} hari`
                  : `${sisaHari} hari lagi`}
              </span>
            );
          })()}
        </div>
        <div className="flex items-center">
          {(() => {
            const jejak = jejakProgres(selectedTicket.status, selectedTicket.activity_logs ?? []);
            const iAktif = jejak.findIndex(j => j.keadaan === 'aktif');
            const icons: Record<string,string> = { Pending:'🟡', Call:'📞', Onsite:'🚗', 'In Progress':'🔵', Solved:'✅' };
            return jejak.map(({ langkah: step, keadaan }, idx, arr) => {
              const done = keadaan === 'selesai', active = keadaan === 'aktif', lewat = keadaan === 'dilewati';
              const kanan = arr[idx + 1]?.keadaan;
              const ujungDilalui = (k?: string) => k === 'selesai' || k === 'aktif';
              const garis = idx + 1 > iAktif ? 'h-0.5 bg-gray-200' : ujungDilalui(keadaan) && ujungDilalui(kanan) ? 'h-0.5 bg-green-400' : 'border-t-2 border-dashed border-gray-300';
              return (
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-0.5" title={lewat ? `${step} dilewati - tidak pernah dilalui ticket ini` : undefined}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2
                      ${active ? 'border-red-500 bg-red-50 shadow-md scale-110' : done ? 'border-green-500 bg-green-50' : lewat ? 'border-dashed border-gray-300 bg-white text-gray-400' : 'border-gray-200 bg-gray-50'}`}>
                      {done ? '✓' : lewat ? '–' : icons[step]}
                    </div>
                    <span className={`text-[10px] font-bold text-center leading-tight whitespace-nowrap ${active ? 'text-red-600' : done ? 'text-green-700' : 'text-gray-400'}`}>{step}</span>
                    {lewat && <span className="text-[9px] leading-none text-gray-400">dilewati</span>}
                  </div>
                  {idx < arr.length - 1 && <div className={`flex-1 mx-0.5 mb-3 ${garis}`} />}
                </div>
              );
            });
          })()}
        </div>
      </div>
    
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <div>
            <InfoLine label="Handler" value={ringkasPenanganan(selectedTicket).handlerPTS || '-'} />
            <InfoLine label="Team" value={ringkasPenanganan(selectedTicket).teamHandler} />
            <InfoLine label="Issue" value={selectedTicket.issue_case} />
            {selectedTicket.product && <InfoLine label="Product" value={selectedTicket.product} />}
            {selectedTicket.sn_unit && <InfoLine label="SN Unit" value={selectedTicket.sn_unit} />}
            {selectedTicket.customer_phone && <InfoLine label="Customer" value={selectedTicket.customer_phone} />}
          </div>
          <div>
            {selectedTicket.sales_name && <InfoLine label="Sales" value={`${selectedTicket.sales_name}${selectedTicket.sales_division ? ` (${selectedTicket.sales_division})` : ''}`} />}
            <InfoLine label="Dibuat" value={selectedTicket.created_at ? formatDateTime(selectedTicket.created_at) : '-'} />
            {selectedTicket.created_by && (() => {
              const pembuat = users.find(u => u.username === selectedTicket.created_by);
              const namaPembuat = pembuat?.full_name || selectedTicket.created_by;
              const atasNama = selectedTicket.sales_name || "";
              const beda = atasNama && atasNama !== namaPembuat;
              return <InfoLine label={beda ? "Diinput oleh" : "Oleh"}
                value={beda ? `${namaPembuat} (${selectedTicket.created_by}) — atas nama Sales ${atasNama}` : `${namaPembuat} (${selectedTicket.created_by})`} />;
            })()}
            {selectedTicket.description && <InfoLine label="Deskripsi" value={selectedTicket.description} />}
          </div>
        </div>
      </div>
    
      {selectedTicket.status !== "Solved" && selectedTicket.status !== "Rejected" && (
        <SolusiSerupa ticketId={selectedTicket.id}
          teks={[selectedTicket.issue_case, selectedTicket.product, selectedTicket.description].filter(Boolean).join(' ')} />
      )}
    
      {(() => {
        const w = getWarrantyInfo(selectedTicket.project_name);
        if (!w) return null;
        return (
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2"><IkonTeks nama="🛡" />Status Garansi Project</p>
            <div className="rounded-xl p-3 flex flex-wrap items-center gap-3"
              style={w.isIn
                ? { background: "rgba(14,165,233,0.08)", border: "1.5px solid rgba(14,165,233,0.3)" }
                : { background: "rgba(239,68,68,0.07)", border: "1.5px solid rgba(239,68,68,0.3)" }}>
              <span className="text-2xl">{w.isIn ? "🛡️" : "⚠️"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold"
                    style={{ color: w.isIn ? "#0369a1" : "#dc2626" }}>
                    {w.isIn ? "✅ In Warranty" : "❌ Out of Warranty"}
                  </span>
                  <span className="text-xs font-bold" style={{ color: w.isIn ? "#0369a1" : "#dc2626" }}>
                    {w.isIn ? `Sisa ${w.diffDays} hari` : `Sudah lewat ${Math.abs(w.diffDays)} hari`}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-[11px] text-gray-500">
                  <div><span className="block text-gray-500">BAST</span><strong className="text-gray-700">{w.bastStr}</strong></div>
                  <div><span className="block text-gray-500">Berakhir</span><strong style={{ color: w.isIn ? "#0369a1" : "#dc2626" }}>{w.expiryStr}</strong></div>
                  <div><span className="block text-gray-500">Durasi</span><strong className="text-gray-700">{w.wy} Tahun</strong></div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    
      {selectedTicket.photo_url && (
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5"><IkonTeks nama="📸" />Foto Awal</p>
          <img src={selectedTicket.photo_url} alt="foto" loading="lazy" decoding="async" className="w-full max-h-36 object-cover rounded-xl border cursor-pointer hover:opacity-90" onClick={() => window.open(selectedTicket.photo_url!, "_blank")} />
        </div>
      )}
    
      <div className="px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2"><IkonTeks nama="📝" />Activity Log ({selectedTicket.activity_logs?.length || 0})</p>
        <div className="space-y-2">
          {selectedTicket.activity_logs && selectedTicket.activity_logs.length > 0
            ? selectedTicket.activity_logs.map(log => (
              <div key={log.id} className="rounded-lg p-2.5 border border-gray-100 bg-gray-50/80">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-800">{log.handler_name}</span>
                    <span className="text-[10px] text-purple-700 font-semibold">{log.team_type}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold ${(statusColors[log.new_status] || 'text-gray-600').split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>{log.new_status}</span>
                    <span className="text-[10px] text-gray-500">{formatDateTime(log.created_at)}</span>
                  </div>
                </div>
                {log.action_taken && <p className="text-[11px] text-blue-700 font-semibold"><Ikon nama="🔧" ukuran="1em" className="inline-block align-[-0.12em]" /> {log.action_taken}</p>}
                <p className="text-xs text-gray-600">{log.notes}</p>
                {log.photo_url && <img src={log.photo_url} alt="log" loading="lazy" decoding="async" className="mt-1.5 max-h-24 rounded-lg border cursor-pointer" onClick={() => window.open(log.photo_url!, "_blank")} />}
                {log.file_url && <a href={log.file_url} download className="inline-block mt-1 text-[11px] font-bold text-blue-600 hover:underline"><Ikon nama="📄" ukuran="1em" className="inline-block align-[-0.12em]" /> {log.file_name || "Download"}</a>}
              </div>
            ))
            : <p className="text-xs text-gray-500 text-center py-3">Belum ada aktivitas</p>
          }
        </div>
      </div>
    
    </div>
  );
}
