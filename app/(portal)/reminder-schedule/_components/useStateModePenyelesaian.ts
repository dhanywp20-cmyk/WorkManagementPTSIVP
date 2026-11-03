'use client';

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
  const [modeEditSaja, setModeEditSaja]               = useState(false);

  const [resendingFormReview, setResendingFormReview] = useState(false);
  return { showModeModal, setShowModeModal, modePenyelesaian, setModePenyelesaian, installerName, setInstallerName, installerUserId, setInstallerUserId, ptsCabangUsers, setPtsCabangUsers, installerDaerah, setInstallerDaerah, bastDate, setBastDate, displayType, setDisplayType, requiresMiddleware, setRequiresMiddleware, requiresControllerAuto, setRequiresControllerAuto, controllerBrand, setControllerBrand, pendingPhotoUrl, setPendingPhotoUrl, savingMode, setSavingMode, modeEditSaja, setModeEditSaja, resendingFormReview, setResendingFormReview };
}
