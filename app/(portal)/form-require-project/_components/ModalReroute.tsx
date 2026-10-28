'use client';

/** ModalReroute - alihkan pekerjaan ke Supervisor / anggota tim lain. Semua keadaan tetap milik induk. Kerangka: ModalSetujui bersama. */
import { KotakInfo, ModalSetujui, PilihPenugasan } from '@/components/shared';
import { bolehDitugaskanOleh } from '@/lib/teams';
import { ProjectRequest } from './shared';

export interface ModalRerouteProps {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  rerouteSaving: boolean;
  rerouteTarget: ProjectRequest | null;
  rerouteTo: string;
  rosterPTS: { id: string; full_name: string; jabatan: string | null; phone_number: string | null; team_type?: string | null; bisa_ditugaskan?: boolean | null; }[];
  setRerouteTarget: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
  setRerouteTo: import("react").Dispatch<import("react").SetStateAction<string>>;
  simpanReroute: () => Promise<void>;
}

export function ModalReroute({ isAdmin, isSuperAdmin, rerouteSaving, rerouteTarget, rerouteTo, rosterPTS, setRerouteTarget, setRerouteTo, simpanReroute }: ModalRerouteProps) {
  if (!rerouteTarget) return null;
  return (
    <ModalSetujui buka onTutup={() => { if (!rerouteSaving) setRerouteTarget(null); }} judul="Alihkan Pekerjaan" keterangan={rerouteTarget.project_name}
      lapisan="atas" labelAksi="Alihkan Sekarang" sibuk={rerouteSaving} bisaKirim={!!rerouteTo} onSetujui={() => { void simpanReroute(); }}>
      <div className="space-y-4">
        <KotakInfo>Sekarang dikerjakan: <strong>{rerouteTarget.assign_name || 'belum ditugaskan'}</strong></KotakInfo>
        <PilihPenugasan label="Alihkan ke" nilai={rerouteTo} onUbah={setRerouteTo} kosong="- Pilih tujuan -" pilihan={[
          ...rosterPTS.filter(u => u.jabatan === 'Supervisor').map(u => ({ v: u.id, l: `${u.full_name} (Supervisor)`, grup: 'Supervisor' })),
          //  Toggle per akun + aturan Manager (hanya Admin murni yang boleh menugaskan Manager) - lib/teams.ts.
          ...rosterPTS.filter(u => u.jabatan !== 'Supervisor' && bolehDitugaskanOleh(u, isAdmin || isSuperAdmin)).map(u => ({ v: u.id, l: u.full_name, grup: 'Anggota Tim' })),
        ]} />
        <p className="text-[11px] text-slate-500">
          Kalau dialihkan ke Supervisor, request kembali ke tahap penugasan - Supervisor itu yang menentukan siapa yang
          mengerjakan. Tujuannya langsung dikabari lewat WA.
        </p>
      </div>
    </ModalSetujui>
  );
}
