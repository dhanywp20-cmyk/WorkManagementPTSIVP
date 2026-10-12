'use client';

/** ModalDetailNote - dipecah dari app/(portal)/tech-note/_components/bagian-tech-note.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { TechNote, TechNoteHistory, STATUS_CONFIG, formatDate } from './shared';
import React from 'react';
import { HistoryTimeline, Modal, StatusBadge, hrefAman } from './bagian-tech-note';

export interface ModalDetailNoteProps {
  bolehEditNote: (n: TechNote) => boolean;
  bukaEditNote: (n: TechNote) => void;
  canManage: boolean;
  detailHistory: TechNoteHistory[];
  detailNote: TechNote | null;
  hapusNote: (n: TechNote) => void;
  setApprovalForm: React.Dispatch<React.SetStateAction<{ action: string; note: string; }>>;
  setApproveModal: React.Dispatch<React.SetStateAction<TechNote | null>>;
  setDetailNote: React.Dispatch<React.SetStateAction<TechNote | null>>;
}

export function ModalDetailNote({ bolehEditNote, bukaEditNote, canManage, detailHistory, detailNote, hapusNote, setApprovalForm, setApproveModal, setDetailNote }: ModalDetailNoteProps) {
  return (
    <>
      {detailNote && (
        <Modal open={!!detailNote} onClose={()=>setDetailNote(null)} title="📄 Detail Tech Note" width={640}>
          <div className="rounded-xl p-4 mb-4 bg-gray-50 border border-gray-200">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-black text-[16px] text-slate-800 leading-snug flex-1">{detailNote.title}</h3>
              <StatusBadge status={detailNote.status} />
            </div>
            <p className="text-[13px] text-slate-500 leading-relaxed mb-3">{detailNote.description}</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] text-slate-500">
              <span><Ikon nama="🏷" ukuran="1em" className="inline-block align-[-0.12em]" /> <b className="text-slate-600">Produk:</b> {detailNote.product}</span>
              <span><Ikon nama="👤" ukuran="1em" className="inline-block align-[-0.12em]" /> <b className="text-slate-600">Author:</b> {detailNote.author_name}</span>
              <span><Ikon nama="📅" ukuran="1em" className="inline-block align-[-0.12em]" /> <b className="text-slate-600">Submit:</b> {formatDate(detailNote.submitted_at)}</span>
              {detailNote.reviewed_by_name && <span><Ikon nama="✅" ukuran="1em" className="inline-block align-[-0.12em]" /> <b className="text-slate-600">Reviewed by:</b> {detailNote.reviewed_by_name}</span>}
            </div>
            {(detailNote.tags??[]).length>0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {(detailNote.tags??[]).map(tag=>(
                  <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full font-semibold text-blue-600 bg-blue-50 border border-blue-200">#{tag}</span>
                ))}
              </div>
            )}
            {detailNote.one_drive_link && (
              <a href={hrefAman(detailNote.one_drive_link)} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-[12px] font-bold px-4 py-2 rounded-xl transition-colors text-white bg-blue-600 hover:bg-blue-700">
                <IkonTeks nama="☁" />Buka di OneDrive →
              </a>
            )}
          </div>

          {detailNote.review_note && (
            <div className="rounded-xl px-4 py-3 mb-4 text-[12px]"
              style={{ background: STATUS_CONFIG[detailNote.status].bg+'15',
                border:`1px solid ${STATUS_CONFIG[detailNote.status].color}30`,
                color: STATUS_CONFIG[detailNote.status].color }}>
              <b>Catatan Reviewer:</b> {detailNote.review_note}
            </div>
          )}

          <HistoryTimeline history={detailHistory} />

          {(bolehEditNote(detailNote) || canManage) && (
            <div className="flex gap-2 mt-4 pt-4 justify-end border-t border-gray-100">
              {bolehEditNote(detailNote) && (
                <button onClick={()=>bukaEditNote(detailNote)}
                  className="px-4 py-2 rounded-xl text-sm font-bold transition-colors bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100">
                  <IkonTeks nama="✏" />Edit Detail
                </button>
              )}
              {canManage && (
                <button onClick={()=>hapusNote(detailNote)}
                  className="px-4 py-2 rounded-xl text-sm font-bold transition-colors bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
                  <IkonTeks nama="🗑" />Hapus
                </button>
              )}
            </div>
          )}

          {canManage && detailNote.status==='pending' && (
            <div className="flex gap-2 mt-4 pt-4 justify-end border-t border-gray-100">
              <button onClick={()=>{setApproveModal(detailNote);setApprovalForm({action:'approved',note:''}); }}
                className="px-4 py-2 rounded-xl text-white text-sm font-bold transition-colors bg-emerald-500 hover:bg-emerald-600"><IkonTeks nama="✅" />Approve</button>
              <button onClick={()=>{setApproveModal(detailNote);setApprovalForm({action:'revision_requested',note:''}); }}
                className="px-4 py-2 rounded-xl text-white text-sm font-bold transition-colors bg-amber-500 hover:bg-amber-600"><IkonTeks nama="🔄" />Revisi</button>
              <button onClick={()=>{setApproveModal(detailNote);setApprovalForm({action:'rejected',note:''}); }}
                className="px-4 py-2 rounded-xl text-white text-sm font-bold transition-colors bg-slate-500 hover:bg-slate-600"><IkonTeks nama="❌" />Tolak</button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
