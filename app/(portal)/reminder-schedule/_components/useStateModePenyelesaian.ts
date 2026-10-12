'use client';

/** useStateModePenyelesaian - dipecah dari app/(portal)/reminder-schedule/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { useState } from 'react';

export function useStateModePenyelesaian() {
  const [showModeModal, setShowModeModal]             = useState(false);
  const [modePenyelesaian, setModePenyelesaian]       = useState<'onsite' | 'remote' | null>(null);
  const [installerName, setInstallerName]             = useState('');
  const [installerUserId, setInstallerUserId]         = useState<string | null>(null);
  const [ptsCabangUsers, setPtsCabangUsers]           = useState<{ id: string; full_name: string; pts_daerah: string | null }[]>([]);
  const [installerDaerah, setInstallerDaerah]         = useState('');
  const [bastDate, setBastDate]                       = useState<string>('');
  const [displayType, setDisplayType]                 = useState<'led' | 'lcd' | 'mix' | null>(null);
  const [requiresMiddleware, setRequiresMiddleware]   = useState(false);
  const [requiresControllerAuto, setRequiresControllerAuto] = useState(false);
  const [controllerBrand, setControllerBrand]         = useState<'cue' | 'extron' | 'wyrestorm' | null>(null);
  const [pendingPhotoUrl, setPendingPhotoUrl]         = useState<string | undefined>(undefined);
  const [savingMode, setSavingMode]                   = useState(false);
  /**
   * true = panel Mode dibuka untuk MENGISI/MENGUBAH detail jadwal yang sudah
   * Completed, bukan sebagai syarat sebelum menyelesaikannya.
   *
   * Kenapa perlu: dulu detail pelaksanaan HANYA bisa diisi tepat pada saat
   * menekan Completed. Begitu statusnya jadi Completed tombol statusnya
   * hilang ("tidak dapat diubah kembali"), jadi jadwal yang terlanjur selesai
   * tanpa detail - mis. diselesaikan sebelum fitur ini ada - tidak punya
   * jalan sama sekali untuk dilengkapi. Padahal jadwal itu tetap ikut ke
   * Incentive PTS, dan di sana tampil sebagai "Mode belum diset".
   */
  const [modeEditSaja, setModeEditSaja]               = useState(false);

  // Resend Form Review
  const [resendingFormReview, setResendingFormReview] = useState(false);
  return { showModeModal, setShowModeModal, modePenyelesaian, setModePenyelesaian, installerName, setInstallerName, installerUserId, setInstallerUserId, ptsCabangUsers, setPtsCabangUsers, installerDaerah, setInstallerDaerah, bastDate, setBastDate, displayType, setDisplayType, requiresMiddleware, setRequiresMiddleware, requiresControllerAuto, setRequiresControllerAuto, controllerBrand, setControllerBrand, pendingPhotoUrl, setPendingPhotoUrl, savingMode, setSavingMode, modeEditSaja, setModeEditSaja, resendingFormReview, setResendingFormReview };
}
