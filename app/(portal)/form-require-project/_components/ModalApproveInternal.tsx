'use client';

/**
 * ModalApproveInternal - dipecah dari app/(portal)/form-require-project/page.tsx. Semua keadaan tetap milik induk.
 * Kerangka: ModalSetujui bersama (components/shared/Persetujuan.tsx) - sama dengan Request Schedule.
 */
import { KotakInfo, ModalSetujui } from '@/components/shared';
import { ProjectRequest } from './shared';

export interface ModalApproveInternalProps {
  formatDate: (dt: string) => string;
  handleInternalApproveProject: (req: ProjectRequest) => Promise<void>;
  internalApproveSaving: boolean;
  internalApproveTarget: ProjectRequest | null;
  setInternalApproveTarget: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
}

function Baris({ label, children, tebal }: { label: string; children: React.ReactNode; tebal?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500 text-xs">{label}</span>
      <span className={`text-right ${tebal ? 'font-bold text-slate-800' : 'font-semibold text-slate-700'}`}>{children}</span>
    </div>
  );
}

export function ModalApproveInternal({ formatDate, handleInternalApproveProject, internalApproveSaving, internalApproveTarget, setInternalApproveTarget }: ModalApproveInternalProps) {
  if (!internalApproveTarget) return null;
  const t = internalApproveTarget;
  return (
    <ModalSetujui buka onTutup={() => { if (!internalApproveSaving) setInternalApproveTarget(null); }} judul="Setujui Request?"
      keterangan="Diteruskan ke Admin/Manager untuk ditugaskan" lapisan="atas" labelAksi="Setujui & Teruskan"
      sibuk={internalApproveSaving} onSetujui={() => { void handleInternalApproveProject(t); }}>
      <div className="space-y-3">
        <div className="rounded-kontrol border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-sm">
          <Baris label="Project" tebal>{t.project_name}</Baris>
          <Baris label="Ruangan">{t.room_name || '-'}</Baris>
          <Baris label="Sales">{t.sales_name}{t.sales_division ? ` · ${t.sales_division}` : ''}</Baris>
          <Baris label="Requester">{t.requester_name}</Baris>
          <Baris label="Lokasi">{t.project_location || '-'}</Baris>
          <Baris label="Kebutuhan">{(t.kebutuhan ?? []).join(', ') || '-'}</Baris>
          <Baris label="Diajukan">{formatDate(t.created_at)}</Baris>
        </div>
        {/* Brand BOTH: dua reviewer, dan persetujuan ini belum tentu yang terakhir. */}
        {t.internal_sales_id_2 && (
          <KotakInfo>
            Request ini <strong>Kedua Brand</strong> - perlu persetujuan dua Sales Internal. Kalau yang satunya belum,
            request menunggu dia dulu sebelum diteruskan ke Admin.
          </KotakInfo>
        )}
      </div>
    </ModalSetujui>
  );
}
