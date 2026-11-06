'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { bisaDiklik } from '@/components/shared/bisaDiklik';
import { useSearchParams } from 'next/navigation';
import { PageHeader, ListEmptyState, ModalPortal, ConfirmDialog, type ConfirmState, ErrorState, Toast, type Notif } from '@/components/shared';
import { supabase } from '@/lib/supabase';
import type { PenggunaPortal as User } from '@/lib/tipe-pengguna';
import { getSession, startSessionWatcher } from '@/lib/auth/sesi';
import {
  TechNoteFolder, TechNote, TechNoteHistory,
  STATUS_CONFIG, ACTION_CONFIG, KKM_REQUIRED,
  formatDate, formatDateShort, getInitials,
} from './_components/shared';
import { logAudit } from '@/lib/audit';
import { sendWANotif } from '@/lib/wa/inti';
import { createNotification, createNotificationForAdmins } from '@/lib/notifications';
import { hasFullAccess } from '@/lib/constants';
import { appLink } from '@/lib/app-url';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { DOMAIN_ONEDRIVE, linkOneDriveSah, hrefAman, Spinner, Avatar, StatusBadge, TechNoteKPISummary, KATEGORI_FOLDER, KategoriFolder, FolderSidebar, HistoryTimeline, Modal, Field, inputCls, TechNotePageInner } from './_components/bagian-tech-note';

export default function TechNotePage() {
  return (
    <Suspense>
      <TechNotePageInner />
    </Suspense>
  );
}
